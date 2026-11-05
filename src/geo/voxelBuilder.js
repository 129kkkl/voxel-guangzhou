import * as THREE from 'three';

/**
 * 体素收集器：所有建筑由 InstancedMesh 的单位立方体批量拼装。
 * 记录格式 [cx, cy, cz, sx, sy, sz, colorHex, emissiveFlag]
 * 坐标与尺寸均为米（1 unit = 1 m）。
 */
const CHUNK = 256;
const HALF = 1280;
const COUNT = 10;

function chunkIndex(x, z) {
  const cx = Math.min(Math.max(Math.floor((x + HALF) / CHUNK), 0), COUNT - 1);
  const cz = Math.min(Math.max(Math.floor((z + HALF) / CHUNK), 0), COUNT - 1);
  return cx * COUNT + cz;
}

function bucket(list) {
  const map = new Map();
  for (const v of list) {
    const k = chunkIndex(v[0], v[2]);
    let arr = map.get(k);
    if (!arr) {
      arr = [];
      map.set(k, arr);
    }
    arr.push(v);
  }
  return map;
}

export class VoxelBuilder {
  constructor() {
    this.solid = [];
    this.glow = [];
    this.total = 0;
  }

  /** 体素块：中心 + 尺寸（米） */
  boxC(cx, cy, cz, sx, sy, sz, color, emissive = false) {
    (emissive ? this.glow : this.solid).push([cx, cy, cz, sx, sy, sz, color]);
    this.total++;
  }

  /** 对角点（米，含端点） */
  box(x0, y0, z0, x1, y1, z1, color, emissive = false) {
    this.boxC(
      (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2,
      Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0),
      color, emissive,
    );
  }

  /** 单个基准体素（默认 4 m） */
  add(x, y, z, size = 4, color = 0x888888, emissive = false) {
    this.boxC(x, y, z, size, size, size, color, emissive);
  }

  build() {
    const group = new THREE.Group();
    group.name = 'voxel-build';
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const solidMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.82, metalness: 0.08,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, toneMapped: false,
    });

    let solidN = 0, glowN = 0;
    if (this.solid.length) {
      for (const records of bucket(this.solid).values()) {
        const mesh = fillMesh(geo, solidMat, records);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        solidN += records.length;
      }
    }
    if (this.glow.length) {
      for (const records of bucket(this.glow).values()) {
        const mesh = fillMesh(geo, glowMat, records);
        group.add(mesh);
        glowN += records.length;
      }
    }
    this.solid.length = 0;
    this.glow.length = 0;
    return { group, counts: { solid: solidN, glow: glowN, total: solidN + glowN } };
  }
}

function fillMesh(geo, material, records) {
  const mesh = new THREE.InstancedMesh(geo, material, records.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const center = new THREE.Vector3();
  for (let i = 0; i < records.length; i++) {
    const v = records[i];
    p.set(v[0], v[1], v[2]);
    s.set(v[3], v[4], v[5]);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(v[6]));
    center.x += v[0]; center.y += v[1]; center.z += v[2];
  }
  center.multiplyScalar(1 / records.length);
  let radius = 0;
  for (let i = 0; i < records.length; i++) {
    const v = records[i];
    const d = Math.hypot(v[0] - center.x, v[1] - center.y, v[2] - center.z)
      + 0.5 * Math.hypot(v[3], v[4], v[5]);
    if (d > radius) radius = d;
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.boundingSphere = new THREE.Sphere(center, radius);
  mesh.frustumCulled = true;
  return mesh;
}
