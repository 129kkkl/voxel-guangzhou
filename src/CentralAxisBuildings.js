/**
 * CentralAxisBuildings：中轴地标
 * - 西塔 IFC 432 m：深蓝灰玻璃体素 + 菱形斜撑暗纹，阶梯退台
 * - 东塔 CTF 530 m：浅色陶板竖向体素肋 + 不对称切削冠顶
 * - 广州大剧院「双砾」/ 省博物馆「月光宝盒」/ 图书馆「之」形 / 海心沙帆屏
 * - 二沙岛体素树 ≥2000 + 星海音乐厅双穹壳
 */
import * as THREE from 'three';
import { LAYOUT } from './layout.js';
import { VoxelBuilder } from './geo/voxelBuilder.js';
import { voxelBox, voxelStrut, shade, lerp } from './geo/helpers.js';
import { makeRng, hash2 } from './core/rng.js';
import { createGlowMaterial } from './geo/facade.js';
import { injectShared, shaderUniforms, sharedShaderMaterial } from './core/shared.js';

export class CentralAxisBuildings {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'CentralAxisBuildings';
    this.treeCount = 0;
  }

  build() {
    const rng = makeRng(8877123);
    const vox = new VoxelBuilder();
    this._ifc(vox);
    this._ctf(vox);
    this._operaHouse(vox);
    this._museum(vox);
    this._library(vox);
    this._sailScreen(vox);
    this._trees(vox, rng);
    this._xinghai(vox);
    const { group } = vox.build();
    this.group.add(group);

    // 博物馆内芯发光
    this.group.add(this._museumCore());
    // 帆屏膜体
    this.group.add(this._sailMembrane());
    return this.group;
  }

  /** 西塔 IFC：阶梯退台 + 深蓝灰玻璃 + 菱形斜撑暗纹 */
  _ifc(vox) {
    const { x, z, h } = LAYOUT.ifc;
    const glass = 0x1c2c48;
    const edge = 0x2a3c5c;
    const floors = 8;
    let y = 0;
    let w = 46;
    let d = 40;
    for (let i = 0; i < floors; i++) {
      const bh = Math.round(((h - y) / (floors - i)) / 4) * 4;
      const use = Math.min(bh, h - y);
      voxelBox(vox, x, y + use / 2, z, w, use, d, shade(glass, 0.9 + i * 0.03), false);
      // 菱形斜撑暗纹（简化：对角短线）
      if (i < floors - 1) {
        const n = 3;
        for (let k = 0; k < n; k++) {
          const zz = z - d / 2 + ((k + 0.5) / n) * d;
          voxelStrut(vox, x - w / 2, y + 2, zz, x + w / 2, y + use - 2, zz, 1.2, shade(edge, 0.7), false);
          voxelStrut(vox, x + w / 2, y + 2, zz, x - w / 2, y + use - 2, zz, 1.2, shade(edge, 0.7), false);
        }
      }
      y += use;
      w = Math.max(18, w - 3);
      d = Math.max(16, d - 3);
    }
    // 冠顶：加强存在感（冷白/青轮廓）
    voxelBox(vox, x, y + 4, z, w + 4, 3, d + 4, 0x9ad8ff, true);
    voxelBox(vox, x, y + 8, z, w * 0.7, 2, d * 0.7, 0x00e5ff, true);
    voxelBox(vox, x, y + 12, z, 3, 10, 3, 0xff3333, true);
    // 横向窗带：让双塔不再是纯黑板
    for (let fy = 16; fy < h - 20; fy += 12) {
      const t = fy / h;
      const ww = Math.max(18, 46 - t * 24);
      const dd = Math.max(16, 40 - t * 20);
      const warm = (fy / 12) % 3 < 1.6;
      voxelBox(vox, x, fy, z + dd / 2 + 0.4, ww - 6, 1.6, 0.5, warm ? 0xffd9a0 : 0x9adcff, true);
      voxelBox(vox, x, fy, z - dd / 2 - 0.4, ww - 6, 1.6, 0.5, warm ? 0xffd9a0 : 0x9adcff, true);
    }
  }

  /** 东塔 CTF：浅色陶板竖肋 + 不对称切削冠顶 */
  _ctf(vox) {
    const { x, z, h } = LAYOUT.ctf;
    const terra = 0xc8c2b6;
    const rib = 0x8a8478;
    // 主体收分
    const segs = 10;
    let y = 0;
    let w = 52;
    let d = 44;
    for (let i = 0; i < segs; i++) {
      const use = Math.round(((h * 0.88) - y) / (segs - i) / 4) * 4;
      if (use <= 0) break;
      voxelBox(vox, x, y + use / 2, z, w, use, d, shade(terra, 0.92 + i * 0.015), false);
      // 竖向体素肋
      const ribs = Math.floor(w / 5);
      for (let r = 0; r <= ribs; r++) {
        const rx = x - w / 2 + (r / ribs) * w;
        voxelBox(vox, rx, y + use / 2, z + d / 2 + 0.4, 1.2, use, 0.8, rib, false);
        voxelBox(vox, rx, y + use / 2, z - d / 2 - 0.4, 1.2, use, 0.8, rib, false);
      }
      y += use;
      w = Math.max(20, w - 2.5);
      d = Math.max(18, d - 2);
    }
    // 不对称切削冠顶
    const crownH = h - y;
    voxelBox(vox, x - 4, y + crownH / 2, z, w * 0.55, crownH, d, shade(terra, 1.05), false);
    voxelBox(vox, x + 8, y + crownH / 2 - 4, z, w * 0.35, crownH - 10, d * 0.8, shade(terra, 0.95), false);
    voxelBox(vox, x - 4, y + crownH + 1, z, w * 0.55, 3, d * 0.85, 0xffd27a, true);
    voxelBox(vox, x + 10, y + crownH + 2.5, z, w * 0.3, 2, d * 0.5, 0xff2d95, true);
    voxelBox(vox, x + 10, y + crownH + 6, z, 2, 14, 2, 0xff3333, true);
    // 横向窗带
    for (let fy = 18; fy < h - 24; fy += 12) {
      const t = fy / h;
      const ww = Math.max(20, 52 - t * 28);
      const dd = Math.max(18, 44 - t * 22);
      const warm = (fy / 12) % 3 < 1.8;
      voxelBox(vox, x, fy, z + dd / 2 + 0.4, ww - 8, 1.6, 0.5, warm ? 0xffe0b0 : 0xb8e8ff, true);
      voxelBox(vox, x, fy, z - dd / 2 - 0.4, ww - 8, 1.6, 0.5, warm ? 0xffe0b0 : 0xb8e8ff, true);
    }
  }

  /** 广州大剧院「双砾」：黑 / 白低体素砾石块 */
  _operaHouse(vox) {
    const { x, z } = LAYOUT.operaHouse;
    // 大砾（黑）
    this._pebble(vox, x - 22, z + 8, 34, 18, 28, 0x1a1c20);
    // 小砾（白）
    this._pebble(vox, x + 28, z - 10, 22, 12, 18, 0xd8d4cc);
    // 基座
    voxelBox(vox, x, 1, z, 100, 2, 70, 0x2a2c30, false);
  }

  _pebble(vox, x, z, rx, h, rz, color) {
    // 体素化砾石：分层椭圆收缩
    const layers = Math.ceil(h / 3);
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const y = 2 + t * h;
      const k = Math.sin(Math.PI * (0.15 + t * 0.7));
      const sx = rx * k * 1.6;
      const sz = rz * k * 1.6;
      voxelBox(vox, x, y + 1.5, z, sx, 3, sz, shade(color, 0.85 + t * 0.2), false);
    }
  }

  /** 广东省博物馆「月光宝盒」：悬浮体素方盒 + 透光刻槽 */
  _museum(vox) {
    const { x, z } = LAYOUT.museum;
    // 悬浮盒
    const w = 70, h = 28, d = 52;
    voxelBox(vox, x, 18 + h / 2, z, w, h, d, 0x8a2030, false);
    // 刻槽（横向透光缝）
    for (let i = 0; i < 6; i++) {
      const y = 22 + i * 4;
      voxelBox(vox, x, y, z + d / 2 + 0.3, w - 4, 1.2, 0.6, 0xffcc88, true);
      voxelBox(vox, x, y, z - d / 2 - 0.3, w - 4, 1.2, 0.6, 0xffcc88, true);
      voxelBox(vox, x + w / 2 + 0.3, y, z, 0.6, 1.2, d - 4, 0xffcc88, true);
      voxelBox(vox, x - w / 2 - 0.3, y, z, 0.6, 1.2, d - 4, 0xffcc88, true);
    }
    // 底部支撑（悬浮感）
    voxelBox(vox, x, 8, z, w * 0.4, 14, d * 0.4, 0x2a2c32, false);
    voxelBox(vox, x, 2, z, w * 0.7, 4, d * 0.7, 0x3a3c42, false);
  }

  /** 博物馆内芯发光 */
  _museumCore() {
    const { x, z } = LAYOUT.museum;
    const geo = new THREE.BoxGeometry(50, 18, 36);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffaa55, toneMapped: false, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    injectShared(mat, (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         diffuseColor.a *= uNight * (0.7 + 0.3 * sin(uTime * 1.2));`,
      );
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 32, z);
    m.name = 'museum-core';
    return m;
  }

  /** 广州图书馆：错位堆叠「之」形体素板 */
  _library(vox) {
    const { x, z } = LAYOUT.library;
    const stone = 0xb0aaa0;
    const glass = 0x2a3848;
    const boards = 7;
    for (let i = 0; i < boards; i++) {
      const y = 4 + i * 7;
      const off = (i % 2 === 0 ? 1 : -1) * 6;
      const w = 56 - i * 1.5;
      const d = 34;
      // 之字错位
      voxelBox(vox, x + off, y + 3, z, w, 6, d, shade(stone, 0.9 + i * 0.02), false);
      // 玻璃带
      voxelBox(vox, x + off, y + 3, z + d / 2 + 0.4, w - 6, 3.2, 0.8, glass, true);
      voxelBox(vox, x + off, y + 3, z - d / 2 - 0.4, w - 6, 3.2, 0.8, glass, true);
    }
    voxelBox(vox, x, 2, z, 70, 4, 48, 0x8a8680, false);
  }

  /** 海心沙帆屏：阶梯化白色膜体素帆，面向水面 */
  _sailScreen(vox) {
    const { x, z } = LAYOUT.sailScreen;
    const col = 0xe8e4dc;
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const y = 2 + t * 42;
      const w = 28 * (1 - t * 0.55);
      // 阶梯帆：向前（南）展开
      voxelBox(vox, x, y + 1.5, z - t * 10, w, 3, 3, shade(col, 0.85 + t * 0.15), false);
    }
    // 桅
    voxelBox(vox, x, 24, z + 4, 2, 48, 2, 0xc0c0c0, false);
    voxelBox(vox, x, 2, z, 40, 2, 20, 0x3a3e44, false);
  }

  /** 帆屏膜体（发光面片） */
  _sailMembrane() {
    const { x, z } = LAYOUT.sailScreen;
    const geo = new THREE.PlaneGeometry(26, 40, 1, 12);
    // 轻微弧面
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setZ(i, Math.sin((y / 40 + 0.5) * Math.PI) * 3);
    }
    geo.computeVertexNormals();
    const mat = sharedShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: shaderUniforms(),
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          float scan = 0.6 + 0.4 * sin(vUv.y * 30.0 - uTime * 2.0);
          float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
          vec3 base = vec3(0.92, 0.94, 0.96);
          vec3 col = base * (0.35 + 0.65 * scan);
          float a = edge * mix(0.55, 0.9, uNight);
          gl_FragColor = vec4(col, a);
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 24, z - 6);
    m.name = 'sail-membrane';
    return m;
  }

  /** 二沙岛体素树 ≥2000 + 海心沙若干 */
  _trees(vox, rng) {
    const E = LAYOUT.ersha;
    const H = LAYOUT.haixinsha;
    const place = (xMin, xMax, zMin, zMax, n) => {
      for (let i = 0; i < n; i++) {
        const x = rng.range(xMin, xMax);
        const z = rng.range(zMin, zMax);
        this._tree(vox, x, z, rng);
        this.treeCount++;
      }
    };
    // 二沙岛 1800
    place(E.xMin + 16, E.xMax - 16, E.zMin + 16, E.zMax - 16, 1800);
    // 海心沙 250
    place(H.xMin + 8, H.xMax - 8, H.zMin + 8, H.zMax - 8, 250);
    // 广场边缘 200
    const P = LAYOUT.huacheng;
    for (let i = 0; i < 200; i++) {
      const side = rng.chance(0.5) ? -1 : 1;
      this._tree(vox, P.xMin * side + rng.range(-20, 20), rng.range(P.zMin, P.zMax), rng);
      this.treeCount++;
    }
  }

  _tree(vox, x, z, rng) {
    const th = rng.range(2, 4);
    const cr = rng.range(2, 3.2);
    // 棕色干
    voxelBox(vox, x, th / 2 + 1, z, 0.8, th, 0.8, 0x5a4030, false);
    // 绿色立方冠（轻微风摇由 shader 注入实体材质——此处静态体素 + 随机偏移近似）
    const sway = rng.range(-0.4, 0.4);
    voxelBox(vox, x + sway, th + 1 + cr / 2, z + sway * 0.5,
      cr * 2, cr, cr * 2, rng.pick([0x2f6a3a, 0x3a7a44, 0x2a5a34, 0x448850]), false);
  }

  /** 星海音乐厅：双体素穹壳 */
  _xinghai(vox) {
    const { x, z } = LAYOUT.xinghai;
    this._dome(vox, x - 14, z, 16, 12, 0xd8d0c0);
    this._dome(vox, x + 16, z + 6, 12, 9, 0xc8c0b0);
    voxelBox(vox, x, 1.5, z, 60, 3, 40, 0x8a8478, false);
  }

  _dome(vox, x, z, r, h, color) {
    const layers = Math.ceil(h / 2.5);
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const k = Math.cos(t * Math.PI * 0.5);
      const rr = Math.max(1.5, r * k);
      voxelBox(vox, x, 3 + t * h + 1.2, z, rr * 2, 2.5, rr * 2, shade(color, 0.85 + t * 0.2), false);
    }
  }
}

/** 树冠轻微风摇材质（InstancedMesh 备用） */
export function createTreeSwayMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  injectShared(mat, (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       transformed.x += sin(uTime * 1.3 + position.y * 0.5) * 0.15;`,
    );
  });
  return mat;
}
