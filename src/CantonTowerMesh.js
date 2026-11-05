/**
 * CantonTowerMesh：广州塔
 * 逐层体素环逼近双曲面扭转轮廓 —— 每 8 m 一层椭圆环，
 * 半径采样 + 随高度扭转，腰细处约 2/3 高度，顶部斜切收口。
 * 外骨骼斜撑沿螺旋网格排布；塔身霓虹为 Y 轴滚动彩虹色带（可调）。
 * 保留 450 m 摩天轮（体素座舱）、观光球、塔桅与 5 盏红色障碍灯。
 */
import * as THREE from 'three';
import { LAYOUT } from './layout.js';
import { VoxelBuilder } from './geo/voxelBuilder.js';
import { voxelBox, voxelRing, voxelStrut, clamp, lerp, smoothstep } from './geo/helpers.js';
import { shaderUniforms, injectShared, sharedShaderMaterial } from './core/shared.js';

const BODY_H = 450;
const MAST_TOP = 604;
const LAYER = 8;       // 每 8 m 一层
const RING_COUNT = 28; // 每环体素数
const BLOCK = 3.2;     // 细节体素 3 m 级（接近 1–2 m 细节档）

/** 双曲面半径：腰细约在 2/3 高度 */
function radiusAt(h, t) {
  // t = h / BODY_H ∈ [0,1]，腰在 t≈0.62
  const waistT = 0.62;
  const top = 18;
  const bot = 32;
  const waist = 11;
  let r;
  if (t < waistT) {
    const u = t / waistT;
    r = lerp(bot, waist, smoothstep(0, 1, u));
  } else {
    const u = (t - waistT) / (1 - waistT);
    r = lerp(waist, top, smoothstep(0, 1, u) * 0.85 + u * 0.15);
  }
  // 椭圆：X 略扁
  return { rx: r * 1.05, rz: r * 0.82 };
}

export class CantonTowerMesh {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'CantonTowerMesh';
  }

  build() {
    const { x: ox, z: oz } = LAYOUT.cantonTower;
    const vox = new VoxelBuilder();

    // ---- 塔身：逐层体素环 ----
    const layers = Math.floor(BODY_H / LAYER);
    const twistPerLayer = 0.075; // 扭转
    for (let i = 0; i <= layers; i++) {
      const h = i * LAYER;
      const t = h / BODY_H;
      const { rx, rz } = radiusAt(h, t);
      const twist = t * Math.PI * 0.55 + i * twistPerLayer * 0.15;
      // 顶部斜切收口
      let cut = 0;
      if (t > 0.9) {
        cut = (t - 0.9) / 0.1;
      }
      const bodyCol = i % 5 === 0 ? 0xe8eef4 : 0xc8d2dc;
      const n = Math.max(10, Math.round(RING_COUNT * (0.75 + 0.25 * (rx / 32))));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + twist;
        // 斜切：半侧抬高
        const slice = cut * 14 * Math.max(0, Math.sin(a + 0.6));
        voxelBox(
          vox,
          ox + Math.cos(a) * rx,
          h + 2 + slice,
          oz + Math.sin(a) * rz,
          BLOCK, BLOCK * 0.9, BLOCK,
          bodyCol, false,
        );
      }
    }

    // ---- 外骨骼斜撑（螺旋网格）----
    const strutCol = 0xd0d6dc;
    const braceRows = 18;
    for (let r = 0; r < braceRows; r++) {
      const t0 = r / braceRows;
      const t1 = (r + 1) / braceRows;
      const h0 = t0 * BODY_H;
      const h1 = t1 * BODY_H;
      const { rx: rx0, rz: rz0 } = radiusAt(h0, t0);
      const { rx: rx1, rz: rz1 } = radiusAt(h1, t1);
      const twists = 3; // 每段绕 3 个方位
      for (let k = 0; k < twists; k++) {
        const a0 = t0 * Math.PI * 0.55 + (k / twists) * Math.PI * 2;
        const a1 = t1 * Math.PI * 0.55 + ((k + 0.55) / twists) * Math.PI * 2;
        voxelStrut(
          vox,
          ox + Math.cos(a0) * rx0, h0, oz + Math.sin(a0) * rz0,
          ox + Math.cos(a1) * rx1, h1, oz + Math.sin(a1) * rz1,
          1.8, strutCol, false,
        );
      }
    }

    // ---- 塔基 ----
    voxelBox(vox, ox, 4, oz, 70, 8, 58, 0x6a7078, false);
    voxelBox(vox, ox, 10, oz, 52, 5, 44, 0x7a828c, false);

    // ---- 观光球（约 450 m）----
    const ballY = 450;
    this._voxBall(vox, ox, ballY, oz, 16, 0xc8d0d8);
    voxelBox(vox, ox, ballY - 14, oz, 22, 8, 18, 0x8a94a0, false);

    // ---- 450 m 摩天轮（体素座舱）----
    this._ferrisWheel(vox, ox, 455, oz + 20);

    // ---- 塔桅 ----
    voxelBox(vox, ox, (BODY_H + MAST_TOP) / 2 + 10, oz, 3.5, MAST_TOP - BODY_H - 10, 3.5, 0xc0c8d0, false);
    // 桅顶
    voxelBox(vox, ox, MAST_TOP - 4, oz, 1.6, 10, 1.6, 0xff4444, true);

    // ---- 5 盏红色障碍灯 ----
    const obstacleYs = [120, 240, 350, 460, 580];
    for (const oy of obstacleYs) {
      const t = oy / BODY_H;
      const { rx, rz } = radiusAt(Math.min(oy, BODY_H), Math.min(t, 1));
      voxelBox(vox, ox + rx + 2, oy, oz, 2.5, 2.5, 2.5, 0xff2222, true);
      voxelBox(vox, ox - rx - 2, oy, oz, 2.5, 2.5, 2.5, 0xff2222, true);
    }

    const { group: voxGroup } = vox.build();
    this.group.add(voxGroup);

    // ---- 塔身霓虹彩虹带（自定义 shader 圆柱壳）----
    this.group.add(this._neonShell(ox, oz));
    return this.group;
  }

  _voxBall(vox, x, y, z, r, color) {
    const step = 3;
    for (let dx = -r; dx <= r; dx += step) {
      for (let dy = -r; dy <= r; dy += step) {
        for (let dz = -r; dz <= r; dz += step) {
          const d = Math.hypot(dx, dy, dz);
          if (d > r || d < r - 4.5) continue;
          voxelBox(vox, x + dx, y + dy, z + dz, step, step, step, color, false);
        }
      }
    }
  }

  _ferrisWheel(vox, cx, cy, cz) {
    // 竖直圆环 + 座舱（体素）
    const R = 22;
    const n = 36;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      // 轮缘：XY 平面
      voxelBox(vox, cx + Math.cos(a) * R, cy + Math.sin(a) * R, cz,
        2.2, 2.2, 2.2, 0xe0e4e8, false);
      if (i % 3 === 0) {
        // 座舱
        voxelBox(vox, cx + Math.cos(a) * (R + 2.5), cy + Math.sin(a) * (R + 2.5), cz,
          3.2, 2.6, 2.6, 0xffd27a, true);
        // 辐条
        voxelStrut(vox, cx, cy, cz,
          cx + Math.cos(a) * R, cy + Math.sin(a) * R, cz,
          1.2, 0x9aa0a8, false);
      }
    }
    voxelBox(vox, cx, cy, cz, 4, 4, 6, 0x606870, false);
  }

  /** 塔身霓虹：Y 轴滚动彩虹色带 */
  _neonShell(ox, oz) {
    // 用多个环壳片近似双曲面，便于贴合体素轮廓
    const layers = 48;
    const geos = [];
    for (let i = 0; i < layers; i++) {
      const t0 = i / layers;
      const t1 = (i + 1) / layers;
      const h0 = t0 * BODY_H;
      const h1 = t1 * BODY_H;
      const { rx, rz } = radiusAt((h0 + h1) / 2, (t0 + t1) / 2);
      const geo = new THREE.CylinderGeometry(1, 1, h1 - h0 + 0.5, 24, 1, true);
      geo.scale(rx + 1.2, 1, rz + 1.2);
      geo.translate(ox, (h0 + h1) / 2, oz);
      geos.push(geo);
    }
    // 合并不必要 —— 共享一个 ShaderMaterial 的多个 mesh 也可；为控 drawcall 合并
    const merged = mergeSimple(geos);
    const mat = sharedShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: shaderUniforms(),
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying float vY;
        void main() {
          vUv = uv;
          vY = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        varying float vY;
        vec3 hue2rgb(float h) {
          vec3 c = abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0);
          return clamp(c - 1.0, 0.0, 1.0);
        }
        void main() {
          float band = fract(vY / 60.0 * uNeonWidth - uTime * 0.35 * uNeonSpeed);
          float h = fract(band + uNeonHue);
          vec3 col = hue2rgb(h);
          // 体素台阶感：竖向量化
          float stepX = step(0.35, fract(vUv.x * 14.0));
          float a = (0.35 + 0.3 * sin(vUv.x * 22.0)) * stepX;
          a *= uNight * uNeonIntensity;
          a *= smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
          a *= mix(0.35, 1.0, smoothstep(0.0, 0.12, vUv.y));
          // 只做色带，不遮体素环
          a *= 0.55;
          gl_FragColor = vec4(col * 1.2, a * 0.22);
        }`,
    });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = 'canton-neon';
    mesh.renderOrder = 6;
    return mesh;
  }
}

/** 极简几何合并（位置/uv/normal） */
function mergeSimple(geos) {
  let vCount = 0;
  for (const g of geos) vCount += g.attributes.position.count;
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = [];
  let vOff = 0;
  for (const g of geos) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const u = g.attributes.uv.array;
    pos.set(p, vOff * 3);
    nor.set(n, vOff * 3);
    uv.set(u, vOff * 2);
    const gi = g.index;
    if (gi) {
      for (let i = 0; i < gi.count; i++) idx.push(gi.array[i] + vOff);
    } else {
      for (let i = 0; i < g.attributes.position.count; i++) idx.push(i + vOff);
    }
    vOff += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
