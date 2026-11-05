/**
 * SkyEnvironment：夜景天空辉光（光污染天幕）+ 星空 + 探照灯束
 * 昼夜经 uNight / shared uniforms 一键切换。
 */
import * as THREE from 'three';
import { LAYOUT } from './layout.js';
import { makeRng } from './core/rng.js';
import { shaderUniforms, injectShared, shared, sharedShaderMaterial } from './core/shared.js';

export class SkyEnvironment {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'SkyEnvironment';
    this.sun = null;
    this.hemi = null;
    this.amb = null;
  }

  build() {
    this.group.add(this._skyDome());
    this.group.add(this._stars());
    this.group.add(this._lightPollution());
    this.group.add(this._searchlights());
    this._lights();
    return this.group;
  }

  _lights() {
    // 夜：低照度冷环境 + 自发光为主；日：暖平行光
    this.hemi = new THREE.HemisphereLight(0x3a4a78, 0x1a2030, 0.28);
    this.amb = new THREE.AmbientLight(0x1a2238, 0.12);
    this.sun = new THREE.DirectionalLight(0xffe0b0, 0.1);
    this.sun.position.set(-300, 500, 200);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -600, right: 600, top: 700, bottom: -400, near: 50, far: 2200,
    });
    this.sun.shadow.bias = -0.0005;
    this.group.add(this.hemi, this.amb, this.sun, this.sun.target);
    // 广州塔基座上打光：夜景仰拍时塔身剪影可读
    this.towerUplight = new THREE.PointLight(0xaaccff, 800, 500, 2);
    this.towerUplight.position.set(LAYOUT.cantonTower.x, 40, LAYOUT.cantonTower.z + 30);
    this.group.add(this.towerUplight);
  }

  /** 每帧根据 uNight 调光照 / 曝光 */
  update() {
    const n = shared.uNight.value;
    const day = 1 - n;
    if (this.sun) {
      this.sun.intensity = 0.05 + day * 1.05;
      this.sun.color.setRGB(1, 0.92 - day * 0.05, 0.78 + day * 0.1);
    }
    if (this.hemi) {
      this.hemi.intensity = 0.25 + day * 0.55;
      this.hemi.color.setHex(day > 0.5 ? 0x7aa0d0 : 0x3a4a78);
    }
    if (this.amb) this.amb.intensity = 0.1 + day * 0.25;
    if (this.towerUplight) this.towerUplight.intensity = 400 + n * 700;
  }

  _skyDome() {
    const mat = sharedShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: shaderUniforms(),
      vertexShader: /* glsl */`
        varying vec3 vP;
        void main() {
          vP = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vP;
        void main() {
          vec3 d = normalize(vP);
          float h = d.y;
          // 夜：深蓝黑；日：干净蔚蓝（不给曝光顶切留空间）
          vec3 nightTop = vec3(0.008, 0.01, 0.035);
          vec3 nightMid = vec3(0.015, 0.025, 0.07);
          vec3 nightHor = vec3(0.08, 0.05, 0.10);
          vec3 dayTop = vec3(0.18, 0.38, 0.72);
          vec3 dayMid = vec3(0.35, 0.55, 0.80);
          vec3 dayHor = vec3(0.70, 0.78, 0.88);
          vec3 top = mix(dayTop, nightTop, uNight);
          vec3 mid = mix(dayMid, nightMid, uNight);
          vec3 hor = mix(dayHor, nightHor, uNight);
          vec3 col = h > 0.15
            ? mix(mid, top, smoothstep(0.15, 0.7, h))
            : mix(hor, mid, smoothstep(-0.05, 0.15, h));
          // 城市光晕方向（中轴）
          float az = max(dot(normalize(d.xz), normalize(vec2(0.0, 1.0))), 0.0);
          col += vec3(0.35, 0.18, 0.12) * pow(az, 3.0) * (1.0 - smoothstep(0.0, 0.4, abs(h))) * uNight * 0.45;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), mat);
    sky.renderOrder = -10;
    sky.name = 'sky-dome';
    return sky;
  }

  _stars() {
    const rng = makeRng(42);
    const pos = [];
    for (let i = 0; i < 600; i++) {
      const a = rng.range(0, Math.PI * 2);
      const e = rng.range(0.15, 1.4);
      const r = 2200;
      pos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xcdd8ff, size: 1.5, sizeAttenuation: false, fog: false,
      transparent: true, opacity: 0.8, toneMapped: false,
    });
    injectShared(mat, (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         diffuseColor.a *= uNight * 0.85;`,
      );
    });
    const p = new THREE.Points(geo, mat);
    p.name = 'stars';
    return p;
  }

  /** 天空辉光：极轻 additive 光晕（不再用大片雾柱糊城） */
  _lightPollution() {
    const rng = makeRng(99);
    const g = new THREE.Group();
    g.name = 'light-pollution';
    const mat = sharedShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
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
          float a = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.25, vUv.y);
          a *= 0.04 + 0.02 * sin(uTime * 0.3 + vUv.x * 5.0);
          gl_FragColor = vec4(vec3(0.35, 0.18, 0.22), a * uNight);
        }`,
    });
    // 仅 8 根极淡光柱
    for (let i = 0; i < 8; i++) {
      const x = rng.range(-350, 350);
      const z = rng.range(-100, 450);
      const h = rng.range(200, 380);
      const w = rng.range(50, 90);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, h / 2, z);
      m.lookAt(x * 0.1, h / 2, z * 0.1);
      g.add(m);
    }
    return g;
  }

  /** 探照灯光束：从双塔扫过 */
  _searchlights() {
    const g = new THREE.Group();
    g.name = 'searchlights';
    const mat = sharedShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
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
          float a = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
          a *= (0.5 + 0.5 * sin(vUv.x * 10.0));
          vec3 col = vec3(0.55, 0.75, 1.0);
          gl_FragColor = vec4(col, a * 0.07 * uNight);
        }`,
    });
    const mkBeam = (from, name) => {
      // 细光柱：不再像白色裂痕
      const geo = new THREE.ConeGeometry(6, 520, 6, 1, true);
      geo.translate(0, -260, 0);
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(from);
      m.name = name;
      m.userData.from = from.clone();
      g.add(m);
      return m;
    };
    this.beamA = mkBeam(new THREE.Vector3(LAYOUT.ifc.x, LAYOUT.ifc.h - 20, LAYOUT.ifc.z), 'beam-A');
    this.beamB = mkBeam(new THREE.Vector3(LAYOUT.ctf.x, LAYOUT.ctf.h - 20, LAYOUT.ctf.z), 'beam-B');
    return g;
  }

  updateBeams(t) {
    if (this.beamA) {
      this.beamA.rotation.z = Math.sin(t * 0.15) * 0.55;
      this.beamA.rotation.x = Math.sin(t * 0.11 + 1) * 0.35;
    }
    if (this.beamB) {
      this.beamB.rotation.z = Math.sin(t * 0.13 + 2) * 0.5;
      this.beamB.rotation.x = Math.cos(t * 0.09) * 0.35;
    }
  }
}
