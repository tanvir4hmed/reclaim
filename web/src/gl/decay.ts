import * as THREE from 'three';
import { surfaceMaps, type SurfaceKind } from './surfaces';

/**
 * Shared decay uniforms (design: Decay material). `uDecay` goes 0 → 1 during the Reveal and
 * every material reads it, so all objects burn, rot, dust and tear in place at once.
 */
export const decayUniforms = {
  uDecay: { value: 0 },
  uTime: { value: 0 },
};

export interface DecayParams {
  burn?: number;
  tear?: number;
  rot?: number;
  dust?: number;
  age?: number;
}

export interface MatParams {
  color: string;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  sheen?: number;
  sheenColor?: string;
  transmission?: number;
  thickness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  side?: THREE.Side;
  /** Colour after the Reveal; the shader blends toward it with uDecay. */
  hauntedColor?: string;
  decay?: DecayParams;
  /** Code-made surface detail: grain, weave, pores, scratches (gl/surfaces.ts). */
  surface?: SurfaceKind;
  /**
   * 0..1: after the Reveal, how completely it loses its shine (clearcoat, specular) and how its
   * burn marks go cold (char, no glowing embers). For old, dusty, worn things.
   */
  matte?: number;
}

const NOISE = /* glsl */ `
varying vec3 vRcPos;
varying vec3 vRcN;
uniform float uDecay;
uniform float uTime;
uniform float uBurn;
uniform float uTear;
uniform float uRot;
uniform float uDust;
uniform float uAge;
uniform vec3 uHaunted;
uniform float uHasHaunted;
uniform float uMatte;
float rcHash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float rcNoise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(rcHash(i),rcHash(i+vec3(1,0,0)),f.x),mix(rcHash(i+vec3(0,1,0)),rcHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(rcHash(i+vec3(0,0,1)),rcHash(i+vec3(1,0,1)),f.x),mix(rcHash(i+vec3(0,1,1)),rcHash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float rcFbm(vec3 p){ return 0.55*rcNoise(p)+0.3*rcNoise(p*2.1)+0.15*rcNoise(p*4.3); }
`;

const cache = new Map<string, THREE.MeshPhysicalMaterial>();

function build(p: MatParams): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: p.color,
    roughness: p.roughness ?? 0.5,
    metalness: p.metalness ?? 0,
    clearcoat: p.clearcoat ?? 0,
    sheen: p.sheen ?? 0,
    sheenColor: new THREE.Color(p.sheenColor ?? '#ffffff'),
    transmission: p.transmission ?? 0,
    thickness: p.thickness ?? 0,
    emissive: new THREE.Color(p.emissive ?? '#000000'),
    emissiveIntensity: p.emissiveIntensity ?? 1,
    transparent: (p.opacity ?? 1) < 1,
    opacity: p.opacity ?? 1,
    side: p.side ?? THREE.FrontSide,
    envMapIntensity: 1,
  });
  const sm = p.surface ? surfaceMaps(p.surface) : null;
  if (sm) {
    m.map = sm.map;
    m.bumpMap = sm.bumpMap;
    m.bumpScale = sm.bumpScale;
    m.roughnessMap = sm.roughnessMap;
  }
  const d = p.decay ?? {};
  const own = {
    uBurn: { value: d.burn ?? 0 },
    uTear: { value: d.tear ?? 0 },
    uRot: { value: d.rot ?? 0 },
    uDust: { value: d.dust ?? 0.35 },
    uAge: { value: d.age ?? 0.6 },
    uHaunted: { value: new THREE.Color(p.hauntedColor ?? p.color) },
    uHasHaunted: { value: p.hauntedColor ? 1 : 0 },
    uMatte: { value: p.matte ?? 0 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, decayUniforms, own);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRcPos;\nvarying vec3 vRcN;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvRcPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRcN = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rcD = uDecay;
        float rcN1 = rcFbm(vRcPos * 9.0);
        if (uTear * rcD > 0.001 && rcFbm(vRcPos * 14.0 + 3.1) < uTear * rcD * 0.42) discard;
        diffuseColor.rgb = mix(diffuseColor.rgb, uHaunted, uHasHaunted * rcD);
        vec3 rcGrey = vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));
        diffuseColor.rgb = mix(diffuseColor.rgb, rcGrey * vec3(0.92, 0.84, 0.7), uAge * rcD);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.6, 0.32), uRot * rcD * smoothstep(0.35, 0.7, rcN1));
        float rcUp = smoothstep(0.2, 0.95, vRcN.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.48, 0.45), rcUp * uDust * rcD * (0.5 + 0.5 * rcN1));
        float rcB = uBurn * rcD;
        float rcChar = smoothstep(1.0 - rcB - 0.04, 1.0 - rcB + 0.02, rcN1);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.028, 0.024), rcChar);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.95, clamp(uAge * uDecay * 0.6 + uBurn * uDecay + uMatte * uDecay, 0.0, 1.0));`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat *= 1.0 - uMatte * uDecay;
        #endif
        material.specularColor *= 1.0 - 0.75 * uMatte * uDecay;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rcEdge = uBurn * uDecay;
        float rcN2 = rcFbm(vRcPos * 9.0);
        float rcEmber = smoothstep(1.0 - rcEdge - 0.06, 1.0 - rcEdge - 0.02, rcN2) - smoothstep(1.0 - rcEdge - 0.02, 1.0 - rcEdge + 0.01, rcN2);
        totalEmissiveRadiance += vec3(1.0, 0.35, 0.08) * rcEmber * 1.6 * (1.0 - uMatte) * (0.7 + 0.3 * sin(uTime * 3.0 + rcN2 * 20.0));`,
      );
  };
  m.customProgramCacheKey = () => 'reclaim-decay';
  return m;
}

/** Materials are cached by key and shared across every view that draws the same part. */
export function mat(key: string, p: MatParams): THREE.MeshPhysicalMaterial {
  let m = cache.get(key);
  if (!m) {
    m = build(p);
    cache.set(key, m);
  }
  return m;
}
