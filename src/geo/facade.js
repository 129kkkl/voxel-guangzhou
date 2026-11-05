/**
 * 程序化窗格发光贴图（CanvasTexture）+ 立面窗光材质。
 * 亮灯率 / 色温（暖黄 / 冷白）/ 楼层分组随 seed 变化；夜景缓慢换灯。
 */
import * as THREE from 'three';
import { injectShared } from '../core/shared.js';
import { makeRng } from '../core/rng.js';

const TEX_SIZE = 256;

function paintWindows(rng, litRate, warmBias) {
  const cv = document.createElement('canvas');
  cv.width = TEX_SIZE;
  cv.height = TEX_SIZE;
  const g = cv.getContext('2d');
  // 深灰墙身 + 明显格栅：远看是窗点，不是横向色带
  g.fillStyle = '#0e1116';
  g.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  const cols = 8;
  const rows = 14;
  const cw = TEX_SIZE / cols;
  const ch = TEX_SIZE / rows;
  const pad = 5; // 粗格栅，防止 mip/距离把整行糊成条

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + pad;
      const y = r * ch + pad;
      const w = cw - pad * 2;
      const h = ch - pad * 2;
      // 逐窗独立，禁止整行同色连成带
      const lit = rng() < litRate;
      if (lit) {
        const roll = rng();
        const b = rng.range(0.7, 1);
        if (roll < warmBias) {
          g.fillStyle = `rgb(${255},${Math.round(185 * b)},${Math.round(95 * b)})`;
        } else if (roll < warmBias + 0.1) {
          g.fillStyle = `rgb(${Math.round(60 * b)},${Math.round(210 * b)},${Math.round(230 * b)})`;
        } else if (roll < warmBias + 0.16) {
          g.fillStyle = `rgb(${Math.round(230 * b)},${Math.round(70 * b)},${Math.round(150 * b)})`;
        } else {
          g.fillStyle = `rgb(${Math.round(180 * b)},${Math.round(210 * b)},${Math.round(245 * b)})`;
        }
      } else {
        g.fillStyle = `rgb(16,20,28)`;
      }
      g.fillRect(x, y, w, h);
    }
    // 楼层线（加粗防糊）
    g.fillStyle = '#05070a';
    g.fillRect(0, r * ch + ch - 3, TEX_SIZE, 3);
  }
  // 竖向幕墙挺
  g.fillStyle = '#05070a';
  for (let c = 0; c <= cols; c++) {
    g.fillRect(c * cw - 1.5, 0, 3, TEX_SIZE);
  }
  return cv;
}

const cache = new Map();

export function getWindowTexture(seed = 1) {
  const key = seed | 0;
  if (cache.has(key)) return cache.get(key);
  const rng = makeRng(0x51f7 + key * 97);
  const litRate = rng.range(0.42, 0.65);
  // 降低暖窗占比，加入冷白/青窗，打破单色钠灯海
  const warmBias = rng.range(0.35, 0.55);
  const tex = new THREE.CanvasTexture(paintWindows(rng, litRate, warmBias));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // 禁止 mipmap：远距 mip 会把窗行糊成横向霓虹条
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 1;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/**
 * 立面材质：标准光照 + 程序 UV 展开窗光。
 * 实例缩放决定窗格铺贴密度；uNight 控制亮灯；缓慢换灯。
 */
export function createFacadeMaterial(opts = {}) {
  const {
    seed = 1,
    roughness = 0.7,
    metalness = 0.12,
    windowScale = 28, // 一贴图铺 28 m（约 6 开间 × 12 层），窗格约 4.6m×2.3m
  } = opts;

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness,
    metalness,
  });

  injectShared(mat, (shader) => {
    shader.uniforms.uWindowScale = { value: windowScale };
    shader.uniforms.uSeed = { value: seed };
    shader.uniforms.map = { value: getWindowTexture(seed) };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLocalPos;
        varying vec3 vInstScale;
        varying float vSeed;
        uniform float uSeed;
      `)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLocalPos = position;
        #ifdef USE_INSTANCING
          vInstScale = vec3(
            length(instanceMatrix[0].xyz),
            length(instanceMatrix[1].xyz),
            length(instanceMatrix[2].xyz));
        #else
          vInstScale = vec3(1.0);
        #endif
        vSeed = uSeed;
      `);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLocalPos;
        varying vec3 vInstScale;
        varying float vSeed;
        uniform float uWindowScale;
        uniform sampler2D map;
        float winHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
      `)
      .replace('#include <color_fragment>', `
        {
          vec3 wn = normalize(vNormal);
          vec2 faceUV;
          if (abs(wn.y) > 0.7) {
            faceUV = vLocalPos.xz * vInstScale.xz / uWindowScale;
          } else if (abs(wn.x) > abs(wn.z)) {
            faceUV = vec2(vLocalPos.z * vInstScale.z, vLocalPos.y * vInstScale.y) / uWindowScale;
          } else {
            faceUV = vec2(vLocalPos.x * vInstScale.x, vLocalPos.y * vInstScale.y) / uWindowScale;
          }
          vec2 tiled = abs(faceUV);
          vec4 texel = texture2D(map, tiled);
          // 夜：墙体压暗，让窗点跳出来；日：正常墙色
          float wallK = mix(0.75, 0.12, uNight);
          diffuseColor.rgb *= mix(vec3(wallK), vec3(wallK * 2.0), texel.rgb);
          vec2 cell = floor(tiled * 14.0);
          float h = winHash(cell + vSeed);
          float flip = step(0.94, winHash(cell + floor(uTime * 0.1) + vSeed));
          float lit = step(h, uLitRate);
          lit = mix(lit, 1.0 - lit, flip);
          if (abs(wn.y) > 0.7) lit *= 0.1;
          // 贴图已经画了窗色，发光直接取贴图亮部，不再叠一层色相
          float lum = max(max(texel.r, texel.g), texel.b);
          float glow = lit * uNight * 1.4 * smoothstep(0.15, 0.5, lum);
          totalEmissiveRadiance = texel.rgb * glow * 1.2;
        }
      `);
  });

  mat.userData.isFacade = true;
  return mat;
}

/** 简单发光体材质（霓虹 / 车流 / 信标） */
export function createGlowMaterial(color = 0xffffff, opacity = 1) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    toneMapped: false,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  injectShared(mat, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       diffuseColor.a *= mix(0.35, 1.0, uNight);
       diffuseColor.rgb *= mix(0.55, 1.0, uNight);`,
    );
  });
  return mat;
}
