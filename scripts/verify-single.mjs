/**
 * 验证单文件 HTML 可直接打开（file://）
 */
import { chromium } from 'playwright';
import path from 'node:path';

const fileUrl = 'file:///' + path.resolve('体素广州-新中轴.html').replace(/\\/g, '/');
const errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

console.log('open', fileUrl);
await page.goto(fileUrl, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(5000);
const stats = await page.evaluate(() => ({
  stats: document.getElementById('stats')?.textContent ?? '',
  status: document.getElementById('status')?.textContent ?? '',
  hasScene: !!window.__GZ?.scene,
  buildings: window.__GZ?.cityScene?.buildingCount ?? 0,
}));
console.log(JSON.stringify(stats, null, 2));
await page.screenshot({ path: path.resolve('output/gz-single-file.png') });
await browser.close();
console.log('errors', errors.length);
for (const e of errors.slice(0, 8)) console.log(' -', e);
process.exit(errors.length ? 1 : 0);
