/**
 * RiverSystem：珠江前/后航道 + 二沙岛分流岸线
 * 分块体素波：8 m 网格阶梯化正弦起伏 + 法线扰动
 * 平面镜像反射：镜像虚拟相机 + 斜剪切面，隔帧渲染 HalfFloat RT
 */
import * as THREE from 'three';
import { LAYOUT } from './layout.js';
import { shaderUniforms, shared, sharedShaderMaterial } from './core/shared.js';

export class RiverSystem {
  constructor(renderer) {
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = 'RiverSystem';
    this.frame = 0;
    this.waters = [];
  }

  build() {
    this.group.add(this._waterPlane(
      LAYOUT.frontChannel.xMin,
      LAYOUT.frontChannel.xMax,
      LAYOUT.frontChannel.zMin,
      LAYOUT.frontChannel.zMax,
    ));
    const B = LAYOUT.backChannel;
    this.group.add(this._waterPlane(B.xMin, B.xMax, B.zMin, B.zMax));
    this.group.add(this._waterPlane(-650, -280, -430, -350));
    this._banks();
    return this.group;
  }

  _waterPlane(x0, x1, z0, z1) {
    const w = x1 - x0;
    const d = z1 - z0;
    const segX = Math.max(8, Math.round(w / 8));
    const segZ = Math.max(8, Math.round(d / 8));
    const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);

    const rtSize = 512;
    const reflectRT = new THREE.WebGLRenderTarget(rtSize, rtSize, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const reflectCam = new THREE.PerspectiveCamera();
    const textureMatrix = new THREE.Matrix4();

    const mat = sharedShaderMaterial({
      uniforms: shaderUniforms({
        uReflectMap: { value: reflectRT.texture },
        uTexMatrix: { value: textureMatrix },
      }),
      vertexShader: /* glsl */`
        uniform mat4 uTexMatrix;
        varying vec3 vWorld;
        varying vec4 vReflectUv;
        varying float vWave;
        void main() {
          vec3 p = position;
          float gx = floor(p.x / 8.0);
          float gz = floor(p.z / 8.0);
          float w1 = sin(gx * 0.35 + uTime * 1.1) * cos(gz * 0.28 - uTime * 0.7);
          float w2 = sin(gx * 0.12 - gz * 0.18 + uTime * 0.5) * 0.5;
          float wave = (w1 * 0.45 + w2 * 0.35) * uWaveAmp;
          wave = floor(wave * 3.0) / 3.0;
          p.y += wave;
          vWave = wave;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          vReflectUv = uTexMatrix * wp;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uReflectMap;
        varying vec3 vWorld;
        varying vec4 vReflectUv;
        varying float vWave;
        void main() {
          vec2 cell = floor(vWorld.xz / 8.0);
          float n1 = sin(cell.x * 0.7 + uTime * 1.3) * 0.04;
          float n2 = cos(cell.y * 0.6 - uTime * 0.9) * 0.04;
          vec2 uv = vReflectUv.xy / max(vReflectUv.w, 0.0001);
          uv += vec2(n1, n2) * uWaveAmp;
          // 竖向拖尾：多 tap 沿 Y 拉长，形成霓虹光带
          vec3 refl = vec3(0.0);
          float wsum = 0.0;
          for (int i = -3; i <= 3; i++) {
            float w = 1.0 - abs(float(i)) / 4.0;
            vec2 uo = vec2(n1, n2) * uWaveAmp + vec2(0.0, float(i) * 0.012 * uWaveAmp);
            refl += texture2D(uReflectMap, uv + uo).rgb * w;
            wsum += w;
          }
          refl /= max(wsum, 0.001);
          vec3 dayCol = vec3(0.12, 0.22, 0.28);
          vec3 nightCol = vec3(0.02, 0.04, 0.09);
          vec3 base = mix(dayCol, nightCol, uNight);
          vec3 reflBoost = refl * mix(0.8, 1.4, uNight);
          vec3 col = mix(base, reflBoost, clamp(uReflect * mix(0.65, 0.95, uNight), 0.0, 1.0));
          col += vec3(0.06, 0.03, 0.05) * uNight * uReflect;
          col += vec3(0.4, 0.5, 0.6) * max(vWave, 0.0) * 0.15;
          gl_FragColor = vec4(col, 0.94);
        }`,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'water';
    mesh.renderOrder = 1;
    mesh.userData.reflect = { reflectRT, reflectCam, textureMatrix };
    this.waters.push(mesh);
    return mesh;
  }

  /** 隔帧渲染镜像反射 */
  updateReflections(scene, camera) {
    this.frame++;
    if (this.frame % 2 !== 0) return;
    if (shared.uReflect.value < 0.02) return;

    const prevRT = this.renderer.getRenderTarget();
    const prevShadow = this.renderer.shadowMap.autoUpdate;
    this.renderer.shadowMap.autoUpdate = false;

    for (const water of this.waters) {
      water.visible = false;
    }
    for (const water of this.waters) {
      const { reflectRT, reflectCam, textureMatrix } = water.userData.reflect;
      this._renderMirror(scene, camera, reflectCam, reflectRT, textureMatrix);
    }
    for (const water of this.waters) {
      water.visible = true;
    }

    this.renderer.shadowMap.autoUpdate = prevShadow;
    this.renderer.setRenderTarget(prevRT);
  }

  _renderMirror(scene, camera, virtualCam, rt, textureMatrix) {
    const normal = new THREE.Vector3(0, 1, 0);
    const planeY = 0;
    const camPos = camera.position.clone();
    const dist = camPos.y - planeY;
    virtualCam.copy(camera, false);
    virtualCam.position.set(camPos.x, planeY - dist, camPos.z);

    const look = new THREE.Vector3();
    camera.getWorldDirection(look);
    look.y *= -1;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    up.y *= -1;
    const target = virtualCam.position.clone().add(look);
    virtualCam.up.copy(up);
    virtualCam.lookAt(target);
    virtualCam.near = camera.near;
    virtualCam.far = camera.far;
    virtualCam.updateMatrixWorld();
    virtualCam.projectionMatrix.copy(camera.projectionMatrix);

    textureMatrix.set(
      0.5, 0, 0, 0.5,
      0, 0.5, 0, 0.5,
      0, 0, 0.5, 0.5,
      0, 0, 0, 1,
    );
    textureMatrix.multiply(virtualCam.projectionMatrix);
    textureMatrix.multiply(virtualCam.matrixWorldInverse);

    // 斜剪切面
    const clipBias = 0.003;
    const clipPlane = new THREE.Plane(normal, -planeY + clipBias);
    clipPlane.applyMatrix4(virtualCam.matrixWorldInverse);
    const cp = new THREE.Vector4(
      clipPlane.normal.x, clipPlane.normal.y, clipPlane.normal.z, clipPlane.constant,
    );
    const proj = virtualCam.projectionMatrix;
    const q = new THREE.Vector4();
    q.x = (Math.sign(cp.x) + proj.elements[8]) / proj.elements[0];
    q.y = (Math.sign(cp.y) + proj.elements[9]) / proj.elements[5];
    q.z = -1.0;
    q.w = (1.0 + proj.elements[10]) / proj.elements[14];
    cp.multiplyScalar(2.0 / cp.dot(q));
    proj.elements[2] = cp.x;
    proj.elements[6] = cp.y;
    proj.elements[10] = cp.z + 1.0 - 0.003;
    proj.elements[14] = cp.w;

    this.renderer.setRenderTarget(rt);
    this.renderer.clear();
    this.renderer.render(scene, virtualCam);
    this.renderer.setRenderTarget(null);
  }

  _banks() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.9 });
    const mk = (x, y, z, w, h, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const F = LAYOUT.frontChannel;
    this.group.add(mk(0, 0.8, F.zMax + 2, F.xMax - F.xMin, 2.4, 4));
    this.group.add(mk(0, 0.8, F.zMin - 2, F.xMax - F.xMin, 2.4, 4));
    const B = LAYOUT.backChannel;
    this.group.add(mk(B.xMax + 2, 0.8, (B.zMin + B.zMax) / 2, 4, 2.4, B.zMax - B.zMin));
    const E = LAYOUT.ersha;
    this.group.add(mk((E.xMin + E.xMax) / 2, 1, E.zMax - 2, E.xMax - E.xMin, 2.8, 5));
  }
}
