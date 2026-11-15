import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * One code-generated environment map per renderer (Requirement 31.4, no CDN). Materials are
 * shared between the shop canvas and the inspection canvas, so the environment is set on each
 * scene instead of on the materials: a PMREM texture lives on the GPU of one context only.
 */
const envs = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

export function envFor(gl: THREE.WebGLRenderer): THREE.Texture {
  let t = envs.get(gl);
  if (!t) {
    const pmrem = new THREE.PMREMGenerator(gl);
    t = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    envs.set(gl, t);
  }
  return t;
}

/** Put inside a View or a Canvas: lights the scene it is in with the renderer's environment. */
export function SceneEnv({ intensity = 1 }: { intensity?: number }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene, invalidate } = get();
    scene.environment = envFor(gl);
    scene.environmentIntensity = intensity;
    invalidate();
  }, [get, intensity]);
  return null;
}
