/**
 * 全局共享 uniform：uTime / uNight 为唯一时间与昼夜源，
 * 其余可调参数亦集中于此，所有材质经 injectShared 注入。
 */
import * as THREE from 'three';

export const shared = {
  uTime: { value: 0 },
  uNight: { value: 1 },
  uNeonSpeed: { value: 1.0 },
  uNeonIntensity: { value: 1.35 },
  uNeonWidth: { value: 1.0 },
  uNeonHue: { value: 0.0 },
  uTrafficDensity: { value: 1.0 },
  uWaveAmp: { value: 1.0 },
  uReflect: { value: 1.0 },
  uLitRate: { value: 0.58 },
};

export const SHARED_DECL = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform float uNeonSpeed;
uniform float uNeonIntensity;
uniform float uNeonWidth;
uniform float uNeonHue;
uniform float uTrafficDensity;
uniform float uWaveAmp;
uniform float uReflect;
uniform float uLitRate;
`;

const KEYS = Object.keys(shared);

/** 把 shared uniforms 并入 material.uniforms（共享同一引用） */
export function bindShared(uniforms = {}) {
  const out = { ...uniforms };
  for (const k of KEYS) out[k] = shared[k];
  return out;
}

/**
 * 向已有材质注入共享 uniform 与公共声明。
 * onAfter(shader) 可继续改写 shader 源码。
 */
export function injectShared(material, onAfter = null) {
  material.onBeforeCompile = (shader, renderer) => {
    Object.assign(shader.uniforms, bindShared(shader.uniforms));
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${SHARED_DECL}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${SHARED_DECL}`,
    );
    if (onAfter) onAfter(shader, renderer);
  };
  material.customProgramCacheKey = () => 'shared:' + (onAfter ? onAfter.name || 'x' : '0');
  return material;
}

/** 纯 ShaderMaterial 便捷绑定 */
export function shaderUniforms(extra = {}) {
  return bindShared(extra);
}

/** 给 ShaderMaterial 源码补上 shared uniform 声明 */
export function withSharedDecl(vertexShader, fragmentShader) {
  return {
    vertexShader: vertexShader.replace('void main', `${SHARED_DECL}\nvoid main`),
    fragmentShader: fragmentShader.replace('void main', `${SHARED_DECL}\nvoid main`),
  };
}

/** 自动注入 shared uniforms / 声明的 ShaderMaterial */
export function sharedShaderMaterial(params) {
  const decl = withSharedDecl(params.vertexShader, params.fragmentShader);
  return new THREE.ShaderMaterial({
    ...params,
    ...decl,
    uniforms: bindShared(params.uniforms || {}),
  });
}
