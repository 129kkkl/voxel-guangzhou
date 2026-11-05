/**
 * VoxelCity：CBD 体素城市肌理
 * - ≥1500 栋，每栋 3–8 个大立方体做退台 / 切角 / 错动
 * - 高度沿中轴 1/(1+|x|/1350) 衰减
 * - 立面窗光（CanvasTexture）+ 屋顶繁华层 + 全息广告
 */
import * as THREE from 'three';
import { LAYOUT, heightFactor } from './layout.js';
import { makeRng, hash2 } from './core/rng.js';
import { VoxelBuilder } from './geo/voxelBuilder.js';
import { voxelBox, shade, clamp, lerp, VOX } from './geo/helpers.js';
import { createFacadeMaterial, createGlowMaterial, getWindowTexture } from './geo/facade.js';
import { injectShared, shaderUniforms, sharedShaderMaterial } from './core/shared.js';

const PALETTE = {
  // 夜景下墙体会被再压暗，这里给干净的体素基色
  glassBlue: [0x152238, 0x1a2c48, 0x1e3452, 0x122038],
  glassWarm: [0x2a221c, 0x322820, 0x241e18],
  concrete: [0x3a3e46, 0x32363e, 0x42464e, 0x2e3238],
  ceramic: [0x4a4844, 0x52504c, 0x44423e],
  accent: [0x1a2438, 0x141e30],
};

export class VoxelCity {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'VoxelCity';
    this.buildingCount = 0;
    this.bills = [];
  }

  build() {
    const rng = makeRng(20260924);
    const vox = new VoxelBuilder();
    const facades = new Map(); // seed -> records
    const roofGlow = [];

    this._layoutDistricts(rng, vox, facades, roofGlow);
    this._buildRoads(vox);
    this._buildGround(vox);

    // 屋顶 / 机房 / 天线等实体体素
    const { group: voxGroup, counts } = vox.build();
    this.group.add(voxGroup);

    // 立面窗光实例（按 seed 分组，减少材质切换）
    this._buildFacades(facades);

    // 屋顶信标 / 冠顶泛光
    this._buildRoofLights(roofGlow);

    // 全息广告牌
    this._buildHoloBillboards(rng);

    this.voxelCounts = counts;
    return this.group;
  }

  _layoutDistricts(rng, vox, facades, roofGlow) {
    const C = LAYOUT.city;
    const plots = [];

    // 生成地块网格，避开水面 / 广场 / 地标
    const step = 28;
    for (let x = C.xMin; x <= C.xMax; x += step) {
      for (let z = C.zMin; z <= C.zMax; z += step) {
        const jx = x + rng.range(-6, 6);
        const jz = z + rng.range(-6, 6);
        if (this._blocked(jx, jz)) continue;
        // 密度：中轴附近更高
        const dens = heightFactor(jx, jz);
        if (rng() > 0.25 + dens * 0.7) continue;
        plots.push({ x: jx, z: jz, dens, r: rng() });
      }
    }

    // 确保 ≥1500 栋：不够则在外围加密
    let guard = 0;
    while (plots.length < 1550 && guard++ < 8000) {
      const x = rng.range(C.xMin + 40, C.xMax - 40);
      const z = rng.range(C.zMin + 40, C.zMax - 40);
      if (this._blocked(x, z)) continue;
      let ok = true;
      for (const p of plots) {
        if (Math.hypot(p.x - x, p.z - z) < 18) { ok = false; break; }
      }
      if (ok) plots.push({ x, z, dens: heightFactor(x, z), r: rng() });
    }

    for (const p of plots) {
      this._placeBuilding(rng, p, vox, facades, roofGlow);
      this.buildingCount++;
    }
  }

  _blocked(x, z) {
    // 珠江前/后航道
    if (z >= LAYOUT.frontChannel.zMin && z <= LAYOUT.frontChannel.zMax) return true;
    const B = LAYOUT.backChannel;
    if (x >= B.xMin && x <= B.xMax && z >= B.zMin && z <= B.zMax) return true;
    // 海心沙 / 二沙岛体表（岛上放树与地标，不放 CBD 楼）
    const H = LAYOUT.haixinsha;
    if (x >= H.xMin - 10 && x <= H.xMax + 10 && z >= H.zMin - 10 && z <= H.zMax + 10) return true;
    const E = LAYOUT.ersha;
    if (x >= E.xMin && x <= E.xMax && z >= E.zMin && z <= E.zMax) return true;
    // 花城广场绿化轴
    const P = LAYOUT.huacheng;
    if (x >= P.xMin && x <= P.xMax && z >= P.zMin && z <= P.zMax) return true;
    // 地标保护圈
    const marks = [LAYOUT.operaHouse, LAYOUT.museum, LAYOUT.library, LAYOUT.ifc, LAYOUT.ctf, LAYOUT.cantonTower];
    for (const m of marks) {
      if (Math.hypot(x - m.x, z - m.z) < 70) return true;
    }
    // 主干道
    const R = LAYOUT.roads;
    if (Math.abs(x - R.huachengAve.x) < R.huachengAve.halfWidth + 8 && z > R.huachengAve.zMin && z < R.huachengAve.zMax) return true;
    if (Math.abs(z - R.linjiang.z) < R.linjiang.halfWidth + 8 && x > R.linjiang.xMin && x < R.linjiang.xMax) return true;
    if (Math.abs(z - R.jinsui.z) < R.jinsui.halfWidth + 8 && x > R.jinsui.xMin && x < R.jinsui.xMax) return true;
    return false;
  }

  _placeBuilding(rng, p, vox, facades, roofGlow) {
    const { x, z, dens } = p;
    // 高度：核区 60–280 m，外围 18–80 m
    let h = lerp(18, 90, dens) + rng.range(0, 40) * dens;
    if (dens > 0.55 && rng() < 0.08) h = rng.range(160, 320);
    h = clamp(h, 12, 340);
    // 体素对齐（4 m 基准），地标细节 1–2 m 由其他模块处理
    h = Math.round(h / VOX) * VOX;

    const w = Math.round(rng.range(16, 36) / VOX) * VOX;
    const d = Math.round(rng.range(16, 36) / VOX) * VOX;
    const seed = (hash2(x | 0, z | 0) * 8) | 0;

    const kind = rng();
    let wall;
    if (kind < 0.38) wall = rng.pick(PALETTE.glassBlue);
    else if (kind < 0.55) wall = rng.pick(PALETTE.glassWarm);
    else if (kind < 0.8) wall = rng.pick(PALETTE.concrete);
    else wall = rng.pick(PALETTE.ceramic);

    // 3–8 个大立方体：退台 / 切角 / 错动
    const steps = rng.int(3, 8);
    let y = 0;
    let cw = w;
    let cd = d;
    let cx = x;
    let cz = z;
    const boxes = [];
    for (let i = 0; i < steps; i++) {
      const remain = h - y;
      if (remain <= 4) break;
      const bh = Math.max(8, Math.round((remain * rng.range(0.18, 0.45)) / VOX) * VOX);
      const useH = Math.min(bh, remain);
      // 收分 / 错动
      if (i > 0) {
        cw = Math.max(8, cw - rng.int(0, 1) * VOX);
        cd = Math.max(8, cd - rng.int(0, 1) * VOX);
        if (rng() < 0.35) {
          cx += rng.range(-2, 2);
          cz += rng.range(-2, 2);
        }
      }
      boxes.push({ x: cx, y: y + useH / 2, z: cz, w: cw, h: useH, d: cd, wall: shade(wall, 0.9 + i * 0.04) });
      y += useH;
    }
    if (!boxes.length) return;

    // 主体走立面窗光实例
    for (const b of boxes) {
      this._pushFacade(facades, seed, b);
    }

    // 退台边缘体素描边（像素天际线）
    for (let i = 1; i < boxes.length; i++) {
      const b = boxes[i];
      const c = shade(b.wall, 0.55);
      voxelBox(vox, b.x, b.y + b.h / 2, b.z, b.w + 0.3, 0.6, b.d + 0.3, c, false);
    }

    // 底商裙房
    if (rng() < 0.55) {
      const pw = w + rng.int(1, 2) * VOX;
      const pd = d + rng.int(1, 2) * VOX;
      const ph = rng.int(1, 2) * VOX + 8;
      voxelBox(vox, x, ph / 2, z, pw, ph, pd, shade(wall, 0.75), false);
      voxelBox(vox, x, ph + 0.6, z, pw + 1, 1.2, pd + 1, 0x3a3e48, false);
    }

    this._roofKit(rng, vox, boxes[boxes.length - 1], roofGlow);
  }

  _pushFacade(facades, seed, b) {
    let arr = facades.get(seed);
    if (!arr) {
      arr = [];
      facades.set(seed, arr);
    }
    arr.push(b);
  }

  _buildFacades(facades) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (const [seed, list] of facades) {
      const mat = createFacadeMaterial({ seed, windowScale: 28 });
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const p = new THREE.Vector3();
      const s = new THREE.Vector3();
      const c = new THREE.Color();
      const center = new THREE.Vector3();
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        p.set(b.x, b.y, b.z);
        s.set(b.w, b.h, b.d);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, c.setHex(b.wall));
        center.add(p);
      }
      center.multiplyScalar(1 / list.length);
      let radius = 0;
      for (const b of list) {
        const d = Math.hypot(b.x - center.x, b.y - center.y, b.z - center.z)
          + 0.5 * Math.hypot(b.w, b.h, b.d);
        if (d > radius) radius = d;
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.boundingSphere = new THREE.Sphere(center, radius);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `facades-seed-${seed}`;
      this.group.add(mesh);
    }
  }

  _roofKit(rng, vox, top, roofGlow) {
    const { x, y, z, w, d, wall } = top;
    const roofY = y + top.h / 2;
    // 屋面板
    voxelBox(vox, x, roofY + 0.6, z, w, 1.2, d, shade(wall, 0.65), false);
    // 机房块
    if (rng.chance(0.75)) {
      const mw = w * rng.range(0.2, 0.4);
      const md = d * rng.range(0.2, 0.4);
      const mh = rng.range(3, 8);
      voxelBox(vox, x + rng.range(-w * 0.2, w * 0.2), roofY + mh / 2 + 1, z + rng.range(-d * 0.2, d * 0.2),
        mw, mh, md, 0x5a5e66, false);
    }
    // 水箱
    if (rng.chance(0.4)) {
      voxelBox(vox, x + rng.range(-w * 0.25, w * 0.25), roofY + 3, z + rng.range(-d * 0.25, d * 0.25),
        3, 4, 3, 0x4a6a7a, false);
    }
    // 天线
    if (rng.chance(0.35)) {
      const ah = rng.range(6, 18);
      voxelBox(vox, x + rng.range(-w * 0.15, w * 0.15), roofY + ah / 2 + 1, z + rng.range(-d * 0.15, d * 0.15),
        0.8, ah, 0.8, 0x8a8e96, false);
    }
    // 女儿墙
    if (rng.chance(0.6)) {
      const c = shade(wall, 0.8);
      const ry = roofY + 2;
      voxelBox(vox, x, ry, z + d / 2 - 0.4, w, 1.6, 0.8, c, false);
      voxelBox(vox, x, ry, z - d / 2 + 0.4, w, 1.6, 0.8, c, false);
      voxelBox(vox, x + w / 2 - 0.4, ry, z, 0.8, 1.6, d, c, false);
      voxelBox(vox, x - w / 2 + 0.4, ry, z, 0.8, 1.6, d, c, false);
    }
    // 红色航空障碍灯（呼吸）
    if (top.h > 80 || rng.chance(0.25)) {
      roofGlow.push({ x, y: roofY + 2.5, z, kind: 'red' });
    }
    // 蓝 / 金 / 青 / 品红冠顶泛光（只给最高一档，且条要细）
    if (top.h > 140 && rng.chance(0.4)) {
      const roll = rng();
      const neon = roll < 0.35 ? 0xffc878 : roll < 0.6 ? 0x7ad8ff : roll < 0.82 ? 0x00d4E6 : 0xff5a9a;
      voxelBox(vox, x, roofY + 1.8, z, w + 0.3, 0.8, d + 0.3, neon, true);
    }
  }

  _buildRoofLights(items) {
    if (!items.length) return;
    const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
    injectShared(mat, (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float breath = 0.55 + 0.45 * sin(uTime * 2.2);
         diffuseColor.rgb *= breath * mix(0.5, 1.4, uNight);`,
      );
    });
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const center = new THREE.Vector3();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      p.set(it.x, it.y, it.z);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      center.add(p);
    }
    center.multiplyScalar(1 / items.length);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingSphere = new THREE.Sphere(center, 400);
    mesh.name = 'roof-beacons';
    this.group.add(mesh);
  }

  _buildHoloBillboards(rng) {
    // 高楼顶部随机全息广告：发光面片 + 扫描线
    const items = [];
    const C = LAYOUT.city;
    for (let i = 0; i < 28; i++) {
      const x = rng.range(C.xMin * 0.5, C.xMax * 0.5);
      const z = rng.range(-200, 600);
      if (this._blocked(x, z)) continue;
      const dens = heightFactor(x, z);
      if (dens < 0.35) continue;
      items.push({
        x, z,
        y: lerp(40, 180, dens) + rng.range(0, 60),
        w: rng.range(10, 22),
        h: rng.range(6, 14),
        rot: rng.range(-0.4, 0.4),
        hue: rng(),
      });
    }

    for (const it of items) {
      const geo = new THREE.PlaneGeometry(it.w, it.h);
      const mat = sharedShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: shaderUniforms({
          uHue: { value: it.hue },
          uSize: { value: new THREE.Vector2(it.w, it.h) },
        }),
        vertexShader: /* glsl */`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */`
          varying vec2 vUv;
          uniform float uHue;
          vec3 hue2rgb(float h) {
            vec3 c = abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0);
            return clamp(c - 1.0, 0.0, 1.0);
          }
          void main() {
            vec2 uv = vUv;
            float scan = 0.55 + 0.45 * sin((uv.y * 18.0 - uTime * 3.0) * 3.14159);
            float edge = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x)
                       * smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);
            float grid = step(0.5, fract(uv.x * 6.0)) * step(0.5, fract(uv.y * 3.0));
            vec3 col = hue2rgb(fract(uHue + uTime * 0.05));
            // 优先青 / 品红霓虹
            if (uHue < 0.35) col = vec3(0.0, 0.9, 1.0);
            else if (uHue < 0.6) col = vec3(1.0, 0.18, 0.58);
            float a = edge * scan * (0.35 + 0.4 * grid) * uNight;
            gl_FragColor = vec4(col * 2.2, a * 0.95);
          }`,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(it.x, it.y, it.z);
      mesh.rotation.y = it.rot;
      mesh.name = 'holo-billboard';
      this.group.add(mesh);
    }
  }

  _buildRoads(vox) {
    const R = LAYOUT.roads;
    const asphalt = 0x1c1e24;
    const lane = 0x3a3e46;
    const strip = (x, y, z, w, h, d, c, e) => voxelBox(vox, x, y, z, w, h, d, c, e);

    // 花城大道（中轴）
    strip(R.huachengAve.x, 0.3, 0,
      R.huachengAve.halfWidth * 2, 0.6,
      R.huachengAve.zMax - R.huachengAve.zMin, asphalt, false);
    // 临江大道
    strip(0, 0.3, R.linjiang.z,
      R.linjiang.xMax - R.linjiang.xMin, 0.6, R.linjiang.halfWidth * 2, asphalt, false);
    // 金穗路
    strip(0, 0.3, R.jinsui.z,
      R.jinsui.xMax - R.jinsui.xMin, 0.6, R.jinsui.halfWidth * 2, asphalt, false);
    // 华夏路 / 珠江东路
    strip(R.huaxia.x, 0.3, 140,
      R.huaxia.halfWidth * 2, 0.6, R.huaxia.zMax - R.huaxia.zMin, asphalt, false);
    strip(R.lizhu.x, 0.3, 140,
      R.lizhu.halfWidth * 2, 0.6, R.lizhu.zMax - R.lizhu.zMin, asphalt, false);
    // 沿江次干
    strip(0, 0.28, R.yanjiang.z,
      R.yanjiang.xMax - R.yanjiang.xMin, 0.5, R.yanjiang.halfWidth * 2, 0x24262c, false);

    // 车道中线（微弱）
    strip(R.huachengAve.x, 0.62, 0, 0.4, 0.1, R.huachengAve.zMax - R.huachengAve.zMin, lane, false);
  }

  _buildGround(vox) {
    // 大地体素块（人行道 / 草地 / 广场铺装）
    const C = LAYOUT.city;
    const step = 32;
    for (let x = C.xMin; x <= C.xMax; x += step) {
      for (let z = C.zMin; z <= C.zMax; z += step) {
        if (z >= LAYOUT.frontChannel.zMin - 8 && z <= LAYOUT.frontChannel.zMax + 8) continue;
        const B = LAYOUT.backChannel;
        if (x >= B.xMin - 8 && x <= B.xMax + 8 && z >= B.zMin && z <= B.zMax) continue;
        const P = LAYOUT.huacheng;
        let c = 0x2a2e34;
        if (x >= P.xMin && x <= P.xMax && z >= P.zMin && z <= P.zMax) {
          c = (Math.floor(z / 24) % 2 === 0) ? 0x3a4048 : 0x323840;
        } else if (hash2(x, z) < 0.12) {
          c = 0x243028; // 零星绿地
        }
        voxelBox(vox, x, -1, z, step, 2, step, c, false);
      }
    }

    // 海心沙岛体
    const H = LAYOUT.haixinsha;
    voxelBox(vox, (H.xMin + H.xMax) / 2, 0.5, (H.zMin + H.zMax) / 2,
      H.xMax - H.xMin, 2.2, H.zMax - H.zMin, 0x2e3830, false);

    // 二沙岛岛体
    const E = LAYOUT.ersha;
    voxelBox(vox, (E.xMin + E.xMax) / 2, 0.5, (E.zMin + E.zMax) / 2,
      E.xMax - E.xMin, 2.4, E.zMax - E.zMin, 0x28382c, false);
  }
}

/** 光流车流：GPU shader 双向流动粒子河 */
export class TrafficRivers {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'TrafficRivers';
  }

  build() {
    const R = LAYOUT.roads;
    const paths = [
      { x0: R.huachengAve.x - 8, x1: R.huachengAve.x - 8, z0: R.huachengAve.zMin, z1: R.huachengAve.zMax, density: 1.0, dir: 1 },
      { x0: R.huachengAve.x + 8, x1: R.huachengAve.x + 8, z0: R.huachengAve.zMin, z1: R.huachengAve.zMax, density: 1.0, dir: -1 },
      { x0: R.linjiang.xMin, x1: R.linjiang.xMax, z0: R.linjiang.z - 6, z1: R.linjiang.z - 6, density: 0.95, dir: 1 },
      { x0: R.linjiang.xMin, x1: R.linjiang.xMax, z0: R.linjiang.z + 6, z1: R.linjiang.z + 6, density: 0.95, dir: -1 },
      { x0: R.jinsui.xMin, x1: R.jinsui.xMax, z0: R.jinsui.z - 6, z1: R.jinsui.z - 6, density: 0.7, dir: 1 },
      { x0: R.jinsui.xMin, x1: R.jinsui.xMax, z0: R.jinsui.z + 6, z1: R.jinsui.z + 6, density: 0.7, dir: -1 },
      { x0: R.huaxia.x - 5, x1: R.huaxia.x - 5, z0: R.huaxia.zMin, z1: R.huaxia.zMax, density: 0.5, dir: 1 },
      { x0: R.huaxia.x + 5, x1: R.huaxia.x + 5, z0: R.huaxia.zMin, z1: R.huaxia.zMax, density: 0.5, dir: -1 },
      { x0: R.lizhu.x - 5, x1: R.lizhu.x - 5, z0: R.lizhu.zMin, z1: R.lizhu.zMax, density: 0.5, dir: 1 },
      { x0: R.lizhu.x + 5, x1: R.lizhu.x + 5, z0: R.lizhu.zMin, z1: R.lizhu.zMax, density: 0.5, dir: -1 },
    ];

    for (const p of paths) {
      this.group.add(this._ribbon(p));
    }
    return this.group;
  }

  _ribbon(p) {
    const horizontal = Math.abs(p.x1 - p.x0) < 1;
    const len = horizontal ? Math.hypot(0, p.z1 - p.z0) : Math.hypot(p.x1 - p.x0, 0);
    const w = 2.4;
    const geo = new THREE.PlaneGeometry(horizontal ? w : len, horizontal ? len : w, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const cx = (p.x0 + p.x1) / 2;
    const cz = (p.z0 + p.z1) / 2;
    geo.translate(cx, 0.55, cz);

    // uv.y 作为流向参数
    const mat = sharedShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: shaderUniforms({
        uDir: { value: p.dir },
        uDensity: { value: p.density },
        uLen: { value: len },
        uAlongX: { value: !horizontal ? 1 : 0 },
      }),
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vPos;
        void main() {
          vUv = uv;
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vPos;
        uniform float uDir;
        uniform float uDensity;
        uniform float uLen;
        uniform float uAlongX;
        float hash(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          float along = mix(vUv.y, vUv.x, uAlongX);
          float across = mix(vUv.x, vUv.y, uAlongX);
          // 双向：一侧金、一侧红
          float side = step(0.5, across);
          float dir = mix(uDir, -uDir, side);
          float speed = 0.12 + 0.08 * hash(along * 40.0);
          float t = along * (uLen / 28.0) - uTime * speed * dir * 6.0;
          // 粒子河：多次采样
          float acc = 0.0;
          for (int i = 0; i < 3; i++) {
            float fi = float(i) * 17.0;
            float lane = floor(t * 0.55 + fi);
            float h = hash(lane + fi + side * 31.0);
            float ph = fract(t * 0.55 + fi * 0.13);
            float spark = smoothstep(0.12, 0.0, abs(ph - 0.5)) * step(h, uDensity * uTrafficDensity);
            acc += spark * (0.5 + 0.5 * h);
          }
          float edge = smoothstep(0.0, 0.15, across) * smoothstep(1.0, 0.85, across);
          vec3 gold = vec3(1.0, 0.72, 0.28);
          vec3 red = vec3(1.0, 0.22, 0.18);
          vec3 col = mix(gold, red, side);
          float glow = acc * edge * uNight;
          // 日景减弱
          glow *= mix(0.15, 1.0, uNight);
          gl_FragColor = vec4(col * 2.2 * glow, glow * 0.9);
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'traffic-river';
    mesh.renderOrder = 5;
    return mesh;
  }
}
