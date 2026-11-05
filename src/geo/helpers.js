/** 体素几何小工具：全部以米为单位，1 unit = 1 m */

export const VOX = 4; // 基准体素 4 m

/** 量化到基准体素网格 */
export function snap(v, s = VOX) {
  return Math.round(v / s) * s;
}

export function snapFloor(v, s = VOX) {
  return Math.floor(v / s) * s;
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 颜色工具 */
export function shade(hex, k) {
  let r = (hex >> 16) & 255;
  let g = (hex >> 8) & 255;
  let b = hex & 255;
  r = clamp(Math.round(r * k), 0, 255);
  g = clamp(Math.round(g * k), 0, 255);
  b = clamp(Math.round(b * k), 0, 255);
  return (r << 16) | (g << 8) | b;
}

export function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

/**
 * voxelBox(x, y, z, w, h, d, color)
 * 中心点 + 尺寸（米）。写入 VoxelBuilder。
 */
export function voxelBox(vox, x, y, z, w, h, d, color, emissive = false) {
  vox.boxC(x, y, z, w, h, d, color, emissive);
}

/** 两点角点盒（米） */
export function voxelSpan(vox, x0, y0, z0, x1, y1, z1, color, emissive = false) {
  vox.boxC(
    (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2,
    Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0),
    color, emissive,
  );
}

/** 椭圆环体素：绕中心一圈放块，返回放置数量 */
export function voxelRing(vox, cx, cy, cz, rx, rz, count, blockSize, color, twist = 0, emissive = false) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + twist;
    const x = cx + Math.cos(a) * rx;
    const z = cz + Math.sin(a) * rz;
    voxelBox(vox, x, cy, z, blockSize, blockSize, blockSize, color, emissive);
  }
  return count;
}

/** 沿线段布体素短棒（用于斜撑 / 拉索） */
export function voxelStrut(vox, x0, y0, z0, x1, y1, z1, thickness, color, emissive = false) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz) || 1;
  const steps = Math.max(1, Math.round(len / (thickness * 1.2)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    voxelBox(
      vox,
      x0 + dx * t, y0 + dy * t, z0 + dz * t,
      thickness, thickness, thickness,
      color, emissive,
    );
  }
}
