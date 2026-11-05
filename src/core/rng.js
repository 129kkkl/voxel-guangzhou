/** 可复现随机数 */
export function makeRng(seed = 1) {
  let s = (seed >>> 0) || 1;
  const fn = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.range = (a, b) => a + (b - a) * fn();
  fn.int = (a, b) => a + Math.floor(fn() * (b - a + 1));
  fn.pick = (arr) => arr[Math.floor(fn() * arr.length) % arr.length];
  fn.chance = (p) => fn() < p;
  return fn;
}

export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function hash3(x, y, z) {
  return hash2(Math.imul(x | 0, 73856093) ^ (z | 0), y | 0);
}
