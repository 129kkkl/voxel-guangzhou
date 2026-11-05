/**
 * GUIPanel：lil-gui 控制面板
 * 昼夜 mix、曝光、霓虹四参数、车流密度、波纹/倒影、Bloom 三参数、SMAA、5 组镜头 + 自动环绕
 */
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { shared } from '../core/shared.js';
import { PRESETS } from '../CameraRig.js';

export class GUIPanel {
  constructor({ rig, post, renderer, sky }) {
    this.rig = rig;
    this.post = post;
    this.renderer = renderer;
    this.sky = sky;

    this.params = {
      night: 1.0,
      exposure: 1.0,
      neonSpeed: 1.0,
      neonIntensity: 0.95,
      neonWidth: 1.0,
      neonHue: 0.0,
      trafficDensity: 1.0,
      waveAmp: 1.0,
      reflect: 1.0,
      bloomStrength: 0.42,
      bloomRadius: 0.25,
      bloomThreshold: 0.82,
      smaa: true,
      autoRotate: false,
      camera: 'A',
    };

    this.gui = new GUI({ title: '体素广州' });
    this.gui.close();
    this._bind();
    this.apply();
  }

  _bind() {
    const p = this.params;
    const g = this.gui;

    const fEnv = g.addFolder('昼夜 / 曝光');
    fEnv.add(p, 'night', 0, 1, 0.01).name('uNight 昼夜 mix').listen();
    fEnv.add(p, 'exposure', 0.4, 2.2, 0.01).name('曝光');

    const fNeon = g.addFolder('霓虹');
    fNeon.add(p, 'neonSpeed', 0, 3, 0.01).name('速度');
    fNeon.add(p, 'neonIntensity', 0, 3, 0.01).name('强度');
    fNeon.add(p, 'neonWidth', 0.2, 3, 0.01).name('色带宽');
    fNeon.add(p, 'neonHue', 0, 1, 0.01).name('色相');

    const fFlow = g.addFolder('车流 / 水面');
    fFlow.add(p, 'trafficDensity', 0, 1.5, 0.01).name('车流密度');
    fFlow.add(p, 'waveAmp', 0, 2, 0.01).name('波纹');
    fFlow.add(p, 'reflect', 0, 1, 0.01).name('倒影');

    const fBloom = g.addFolder('Bloom / SMAA');
    fBloom.add(p, 'bloomStrength', 0, 2.5, 0.01).name('强度');
    fBloom.add(p, 'bloomRadius', 0, 2, 0.01).name('半径');
    fBloom.add(p, 'bloomThreshold', 0, 1, 0.01).name('阈值');
    fBloom.add(p, 'smaa').name('SMAA');

    const fCam = g.addFolder('镜头');
    fCam.add(p, 'camera', ['A', 'B', 'C', 'D', 'E']).name('预设 1-5').listen()
      .onChange((v) => {
        this.rig.applyPreset(v);
        this.apply();
      });
    fCam.add(p, 'autoRotate').name('自动环绕').onChange((v) => {
      this.rig.controls.autoRotate = v;
    });

    g.onChange(() => this.apply());
  }

  apply() {
    const p = this.params;
    shared.uNight.value = p.night;
    shared.uNeonSpeed.value = p.neonSpeed;
    shared.uNeonIntensity.value = p.neonIntensity;
    shared.uNeonWidth.value = p.neonWidth;
    shared.uNeonHue.value = p.neonHue;
    shared.uTrafficDensity.value = p.trafficDensity;
    shared.uWaveAmp.value = p.waveAmp;
    shared.uReflect.value = p.reflect;

    this.renderer.toneMappingExposure = p.exposure;
    // 写入手动 bloom，避免 PostEffects.update 覆盖
    this.post.manualBloom.strength = p.bloomStrength * (0.55 + 0.55 * p.night);
    this.post.manualBloom.radius = p.bloomRadius;
    this.post.manualBloom.threshold = p.bloomThreshold;
    this.post.enabledSMAA = p.smaa;
    this.rig.controls.autoRotate = p.autoRotate;
  }

  setCamera(key) {
    this.params.camera = key;
    this.apply();
  }
}
