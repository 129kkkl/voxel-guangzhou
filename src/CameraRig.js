/**
 * CameraRig：5 组镜头预设 + 缓动补间 + 自动环绕
 * A 塔顶鸟瞰 / B 塔下仰望 / C 中轴漫游 / D 珠江全景 / E 二沙岛
 * 键盘 1–5 切镜
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LAYOUT } from './layout.js';

export const PRESETS = {
  A: {
    name: 'A 塔顶鸟瞰',
    // 退远压俯角，让南塔 / 北双塔都进画
    pos: [180, 380, -1080],
    target: [0, 120, -80],
  },
  B: {
    name: 'B 塔下仰望',
    // 后拉 + 降仰角，给塔尖留天空
    pos: [130, 55, -500],
    target: [0, 220, -820],
  },
  C: {
    name: 'C 中轴漫游',
    pos: [20, 70, -320],
    target: [0, 80, 220],
  },
  D: {
    name: 'D 珠江全景',
    pos: [520, 150, -720],
    target: [0, 90, -120],
  },
  E: {
    name: 'E 二沙岛',
    pos: [-520, 110, -280],
    target: [-420, 20, -60],
  },
};

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.minDistance = 30;
    this.controls.maxDistance = 2200;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.target.set(0, 40, -80);

    this.tween = null;
    this.current = 'A';
    this.applyPreset('A', 0);
  }

  applyPreset(key, duration = 1.6) {
    const p = PRESETS[key];
    if (!p) return;
    this.current = key;
    const toPos = new THREE.Vector3(...p.pos);
    const toTgt = new THREE.Vector3(...p.target);
    if (duration <= 0) {
      this.camera.position.copy(toPos);
      this.controls.target.copy(toTgt);
      this.controls.update();
      return;
    }
    this.tween = {
      t: 0,
      duration,
      fromPos: this.camera.position.clone(),
      toPos,
      fromTgt: this.controls.target.clone(),
      toTgt,
    };
    this.controls.autoRotate = false;
  }

  toggleAutoRotate() {
    this.controls.autoRotate = !this.controls.autoRotate;
    return this.controls.autoRotate;
  }

  update(dt) {
    if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const u = Math.min(1, tw.t / tw.duration);
      // 缓动 cubic out
      const e = 1 - Math.pow(1 - u, 3);
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
      this.controls.target.lerpVectors(tw.fromTgt, tw.toTgt, e);
      if (u >= 1) this.tween = null;
    }
    this.controls.update();
  }

  bindKeys(onPreset) {
    window.addEventListener('keydown', (e) => {
      const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' };
      const k = map[e.key];
      if (k) {
        this.applyPreset(k);
        onPreset?.(k);
      }
    });
  }
}
