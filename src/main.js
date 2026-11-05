import * as THREE from 'three';
import { CityScene } from './CityScene.js';
import { CameraRig, PRESETS } from './CameraRig.js';
import { PostEffects } from './PostEffects.js';
import { GUIPanel } from './ui/GUIPanel.js';
import { HUD } from './ui/HUD.js';

// ---------- 渲染器 ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ---------- 相机 ----------
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.set(...PRESETS.A.pos);

// ---------- 场景 ----------
const cityScene = new CityScene(renderer);
const statusEl = document.getElementById('status');
if (statusEl) statusEl.textContent = '正在生成体素广州…';

const scene = cityScene.build();
if (statusEl) {
  statusEl.textContent =
    `建筑 ${cityScene.buildingCount} · 树 ${cityScene.treeCount} · 体素 ${cityScene.city.voxelCounts.total}`;
}

// ---------- 操控 / 后期 / UI ----------
const rig = new CameraRig(camera, renderer.domElement);
const post = new PostEffects(renderer, scene, camera);
const hud = new HUD();
const gui = new GUIPanel({ rig, post, renderer, sky: cityScene.sky });

rig.bindKeys((key) => gui.setCamera(key));
if (statusEl) {
  setTimeout(() => { statusEl.style.opacity = '0.5'; }, 2500);
}

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let elapsed = 0;

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  rig.update(dt);
  cityScene.update(dt, elapsed, camera);
  // 后期链会重置 info，先采样一帧场景数据
  renderer.info.reset();
  renderer.render(scene, camera);
  const infoSnapshot = {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  };
  post.render();
  hud.update(dt, infoSnapshot, cityScene.buildingCount, PRESETS[rig.current]?.name ?? rig.current);
  requestAnimationFrame(frame);
}
frame();

// ---------- 自适应 ----------
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  post.setSize(w, h);
});

// 调试挂载
window.__GZ = { scene, camera, renderer, cityScene, rig, post, gui, shared: null };
