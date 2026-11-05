/**
 * PostEffects：EffectComposer + UnrealBloom（夜景加强）+ 暗角/饱和调色 + SMAA
 * Bloom 手动参数由 GUI 写入 manualBloom；update 只在未手动覆盖时按昼夜加权。
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { shared } from './core/shared.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.18 },
    uSaturation: { value: 1.08 },
    uContrast: { value: 1.06 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uContrast;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, uSaturation);
      c.rgb = (c.rgb - 0.5) * uContrast + 0.5;
      vec2 q = vUv - 0.5;
      float vig = 1.0 - uVignette * dot(q, q) * 2.2;
      c.rgb *= clamp(vig, 0.0, 1.0);
      gl_FragColor = c;
    }`,
};

export class PostEffects {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabledSMAA = true;
    /** GUI 手动 bloom；null 表示跟随昼夜 */
    this.manualBloom = { strength: null, radius: null, threshold: null };

    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(size.x, size.y);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.3, 0.7);
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);

    this.output = new OutputPass();
    this.composer.addPass(this.output);

    this.smaa = new SMAAPass(size.x * pr, size.y * pr);
    this.smaa.enabled = true;
    this.composer.addPass(this.smaa);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.smaa.setSize(w, h);
  }

  /** 优先用 GUI 手动值，否则按昼夜自动 */
  update() {
    const n = shared.uNight.value;
    const m = this.manualBloom;
    this.bloom.strength = m.strength ?? (0.28 + n * 0.18);
    this.bloom.radius = m.radius ?? (0.18 + n * 0.1);
    this.bloom.threshold = m.threshold ?? (0.85 - n * 0.08);
    this.smaa.enabled = this.enabledSMAA;
  }

  render() {
    this.update();
    this.composer.render();
  }
}
