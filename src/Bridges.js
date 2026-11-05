/**
 * Bridges：三座桥体素化剪影
 * - 海心桥：倾斜提篮拱 + S 形桥面，纯白 + 青色轮廓灯带
 * - 猎德大桥「珠江之贝」：贝壳形体素塔柱 + 扇形拉索
 * - 广州大桥：多跨平直梁 + 路灯
 */
import * as THREE from 'three';
import { LAYOUT } from './layout.js';
import { VoxelBuilder } from './geo/voxelBuilder.js';
import { voxelBox, voxelStrut, shade } from './geo/helpers.js';
import { injectShared } from './core/shared.js';

export class Bridges {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Bridges';
  }

  build() {
    const vox = new VoxelBuilder();
    this._haixinBridge(vox);
    this._liedeBridge(vox);
    this._guangzhouBridge(vox);
    const { group } = vox.build();
    this.group.add(group);

    // 海心桥青色轮廓灯带
    this.group.add(this._haixinStrip());
    return this.group;
  }

  /** 海心桥：倾斜提篮拱 + S 形桥面 */
  _haixinBridge(vox) {
    const { z, xMin, xMax } = LAYOUT.bridges.haixin;
    const white = 0xe8e8e8;
    const span = xMax - xMin;
    // S 形桥面
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = xMin + t * span;
      // S 弯
      const zz = z + Math.sin(t * Math.PI * 2) * 18;
      const y = 6 + Math.sin(t * Math.PI) * 3;
      voxelBox(vox, x, y, zz, span / steps + 1.2, 1.6, 10, white, false);
      // 栏杆
      voxelBox(vox, x, y + 1.2, zz + 5, span / steps, 1.2, 0.6, shade(white, 0.9), false);
      voxelBox(vox, x, y + 1.2, zz - 5, span / steps, 1.2, 0.6, shade(white, 0.9), false);
    }
    // 倾斜提篮拱
    const archSeg = 16;
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 1 : -1;
      for (let i = 0; i <= archSeg; i++) {
        const t = i / archSeg;
        const x = xMin + 6 + t * (span - 12);
        const zz = z + Math.sin(t * Math.PI * 2) * 18 + side * 9 + side * t * 4; // 倾斜
        const y = 8 + Math.sin(t * Math.PI) * 22;
        voxelBox(vox, x, y, zz, 2.2, 2.2, 2.2, white, false);
        // 吊杆
        if (i % 2 === 0) {
          const deckZ = z + Math.sin(t * Math.PI * 2) * 18;
          const deckY = 6 + Math.sin(t * Math.PI) * 3;
          voxelStrut(vox, x, y - 1, zz, x, deckY + 1, deckZ, 0.9, shade(white, 0.85), false);
        }
      }
    }
  }

  /** 海心桥青色轮廓灯带 */
  _haixinStrip() {
    const { z, xMin, xMax } = LAYOUT.bridges.haixin;
    const span = xMax - xMin;
    const pts = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = xMin + t * span;
      const zz = z + Math.sin(t * Math.PI * 2) * 18;
      const y = 7 + Math.sin(t * Math.PI) * 3;
      pts.push(new THREE.Vector3(x, y, zz + 5.2));
      pts.push(new THREE.Vector3(x, y, zz - 5.2));
    }
    // 两条轮廓
    const groups = [];
    for (let s = 0; s < 2; s++) {
      const arr = pts.filter((_, i) => i % 2 === s);
      const geo = new THREE.BufferGeometry().setFromPoints(arr);
      const mat = new THREE.LineBasicMaterial({
        color: 0x30f0e0, toneMapped: false, transparent: true, opacity: 0.95,
      });
      injectShared(mat, (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           diffuseColor.a *= mix(0.4, 1.0, uNight);`,
        );
      });
      groups.push(new THREE.Line(geo, mat));
    }
    const g = new THREE.Group();
    g.name = 'haixin-cyan-strip';
    for (const l of groups) g.add(l);
    return g;
  }

  /** 猎德大桥「珠江之贝」 */
  _liedeBridge(vox) {
    const { z, xMin, xMax } = LAYOUT.bridges.liede;
    const stone = 0xc8c2b8;
    const deck = 0x5a5e64;
    const span = xMax - xMin;
    // 桥面
    voxelBox(vox, 0, 8, z, span, 2.2, 16, deck, false);
    // 贝壳塔柱（中央偏心）
    const tx = 30;
    this._shellTower(vox, tx, z, stone);
    // 扇形拉索
    for (let i = -10; i <= 10; i++) {
      const dx = i * 16;
      if (Math.abs(dx) < 8) continue;
      const deckX = tx + dx;
      if (deckX < xMin + 4 || deckX > xMax - 4) continue;
      const topY = 38 - Math.abs(i) * 1.2;
      voxelStrut(vox, tx, topY, z + (i > 0 ? 2 : -2), deckX, 9.5, z + (dx > 0 ? 6 : -6),
        0.8, 0xd0d0d0, false);
    }
  }

  _shellTower(vox, x, z, color) {
    // 贝壳：两片弧形体素壳
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? 1 : -1;
      const layers = 14;
      for (let i = 0; i < layers; i++) {
        const t = i / layers;
        const y = 8 + t * 42;
        const bulge = Math.sin(t * Math.PI) * 14;
        voxelBox(vox, x + side * (4 + bulge), y, z, 4, 3.6, 5, shade(color, 0.85 + t * 0.15), false);
      }
    }
    voxelBox(vox, x, 8, z, 12, 2, 14, shade(color, 0.7), false);
  }

  /** 广州大桥：多跨平直梁 + 路灯 */
  _guangzhouBridge(vox) {
    const { z, xMin, xMax } = LAYOUT.bridges.guangzhou;
    const span = xMax - xMin;
    const deck = 0x4a4e54;
    voxelBox(vox, (xMin + xMax) / 2, 7, z, span, 2, 14, deck, false);
    // 桥墩
    const piers = 5;
    for (let i = 0; i <= piers; i++) {
      const x = xMin + (i / piers) * span;
      voxelBox(vox, x, 3, z, 4, 8, 6, 0x6a6e74, false);
    }
    // 路灯
    for (let i = 0; i <= 12; i++) {
      const x = xMin + (i / 12) * span;
      voxelBox(vox, x, 10, z + 6, 0.6, 5, 0.6, 0x8a8e94, false);
      voxelBox(vox, x, 12.5, z + 5, 1.2, 0.6, 1.2, 0xffe0a0, true);
      voxelBox(vox, x, 10, z - 6, 0.6, 5, 0.6, 0x8a8e94, false);
      voxelBox(vox, x, 12.5, z - 5, 1.2, 0.6, 1.2, 0xffe0a0, true);
    }
  }
}
