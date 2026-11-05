/**
 * 无头浏览器验证：加载页面，收集 console / pageerror，截图。
 * 用法：node scripts/verify.mjs [url]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:5177/';
const outDir = path.resolve('output');
fs.mkdirSync(outDir, { recursive: true });

const errors = [];
const warnings = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on('console', (msg) => {
  const type = msg.type();
  const text = msg.text();
  if (type === 'error') errors.push(text);
  else if (type === 'warning') warnings.push(text);
  console.log(`[console.${type}] ${text}`);
});
page.on('pageerror', (err) => {
  errors.push(String(err));
  console.log(`[pageerror] ${err}`);
});

console.log(`verify -> ${url}`);
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
// 等场景生成
await page.waitForTimeout(5000);

const stats = await page.evaluate(() => {
  const el = document.getElementById('stats');
  const st = document.getElementById('status');
  const gz = window.__GZ;
  return {
    stats: el?.textContent ?? '',
    status: st?.textContent ?? '',
    hasScene: !!gz?.scene,
    buildings: gz?.cityScene?.buildingCount ?? 0,
    trees: gz?.cityScene?.treeCount ?? 0,
    calls: gz?.renderer?.info?.render?.calls ?? 0,
    tris: gz?.renderer?.info?.render?.triangles ?? 0,
  };
});
console.log('stats:', JSON.stringify(stats, null, 2));

// 初始关自动环绕，保证构图可复现
await page.evaluate(() => {
  const gz = window.__GZ;
  if (gz?.gui) {
    gz.gui.params.autoRotate = false;
    gz.gui.apply();
  }
});
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, 'gz-verify-night.png') });

// 切到日景
await page.evaluate(() => {
  const gz = window.__GZ;
  if (gz?.gui) {
    gz.gui.params.night = 0;
    gz.gui.params.exposure = 1.05;
    gz.gui.apply();
  }
});
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(outDir, 'gz-verify-day.png') });

// 回到夜景再拍镜 B
await page.evaluate(() => {
  const gz = window.__GZ;
  if (gz?.gui) {
    gz.gui.params.night = 1;
    gz.gui.params.exposure = 1.0;
    gz.gui.params.autoRotate = false;
    gz.gui.apply();
  }
});
await page.waitForTimeout(400);
await page.keyboard.press('2');
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(outDir, 'gz-verify-camB.png') });

// 镜 D 珠江全景（看倒影）
await page.keyboard.press('4');
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(outDir, 'gz-verify-camD.png') });

await browser.close();

const report = { errors, warnings, stats };
fs.writeFileSync(path.join(outDir, 'verify-report.json'), JSON.stringify(report, null, 2));

console.log(`\n=== VERIFY DONE ===`);
console.log(`errors: ${errors.length}, warnings: ${warnings.length}`);
if (errors.length) {
  console.log('ERRORS:');
  for (const e of errors) console.log(' -', e);
  process.exit(1);
}
console.log('ZERO console errors.');
