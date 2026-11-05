/**
 * HUD：FPS / draw call / 三角面 / 建筑数
 */
export class HUD {
  constructor() {
    this.el = document.getElementById('stats');
    this.fps = 0;
    this.acc = 0;
    this.frames = 0;
  }

  update(dt, info, buildingCount, presetName) {
    this.acc += dt;
    this.frames++;
    if (this.acc >= 0.5) {
      this.fps = Math.round(this.frames / this.acc);
      this.acc = 0;
      this.frames = 0;
    }
    if (!this.el) return;
    const tris = info?.triangles ?? info?.render?.triangles ?? 0;
    const calls = info?.calls ?? info?.render?.calls ?? 0;
    this.el.textContent =
      `FPS ${this.fps} · draw ${calls} · tri ${(tris / 1000).toFixed(0)}k · 建筑 ${buildingCount} · ${presetName}`;
  }
}
