import { PerspectiveCamera, View } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFx } from '../fx/fxStore';
import PhotoFrame from '../products/photo-frame/Model';
import { SnowGlobe } from '../products/small/Models';
import { UnopenedGift } from '../products/small/TierA';
import { useHaunted } from '../store';
import { mat } from './decay';
import { SceneEnv } from './env';
import { M } from './materials';
import { Ruins } from './Ruins';
import { Shadow } from './Shadow';

const needles = () =>
  mat('needles', { surface: 'fur', color: '#2c5a36', roughness: 0.9, sheen: 0.4, sheenColor: '#7fb37a', hauntedColor: '#1c211d', decay: { dust: 0.6, age: 0.8, burn: 0.25 } });

/** A fir built from drooping tiers of needle cones, with warm bulbs, a gold star and a pot. */
function Tree({ haunted }: { haunted: boolean }) {
  const tiers = [0, 1, 2, 3, 4, 5];
  const bulbs = useMemo(() => {
    const out: { p: THREE.Vector3; c: string }[] = [];
    const colors = ['#ffcf7a', '#ff6b5a', '#ffe9b0', '#7fc4ff', '#ffcf7a'];
    for (let i = 0; i < 46; i++) {
      const t = i / 46;
      const y = -0.85 + t * 2.0;
      const r = 0.92 * (1 - t) + 0.08;
      const a = i * 2.4;
      out.push({ p: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), c: colors[i % colors.length] ?? '#ffcf7a' });
    }
    return out;
  }, []);
  const mains = useFx((s) => s.mains);
  return (
    <group>
      {tiers.map((i) => {
        const h = 0.75;
        const r = 1.0 - i * 0.15;
        return (
          <mesh key={i} material={needles()} position-y={-0.75 + i * 0.36} castShadow>
            <coneGeometry args={[r, h, 28, 3, true]} />
          </mesh>
        );
      })}
      {bulbs.map((b, i) => {
        // After the Reveal most bulbs are dead; a few still glow, one flickers with the mains.
        const alive = !haunted || i % 9 === 0;
        return (
          <mesh key={i} position={b.p}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial
              color={alive ? b.c : '#2a2622'}
              emissive={alive ? b.c : '#000000'}
              emissiveIntensity={alive ? (haunted ? 1.2 * mains : 2.4) : 0}
              roughness={0.3}
            />
          </mesh>
        );
      })}
      <mesh material={M.gilt()} position-y={1.38} rotation-z={haunted ? 0.5 : 0}>
        <octahedronGeometry args={[0.13, 0]} />
      </mesh>
      <mesh material={M.wood()} position-y={-1.2}>
        <cylinderGeometry args={[0.32, 0.26, 0.36, 24]} />
      </mesh>
    </group>
  );
}

/** A brass storm lantern with glass panes and a living candle flame. */
function Lantern() {
  const flame = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const t = setInterval(() => invalidate(), 70);
    return () => clearInterval(t);
  }, [invalidate]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const k = 1 + Math.sin(t * 13) * 0.07 + Math.sin(t * 5.7) * 0.05;
    if (flame.current) flame.current.scale.set(1, k, 1);
    if (light.current) light.current.intensity = 2.6 * k;
  });
  return (
    <group>
      <mesh material={M.darkBrass()} position-y={-0.42}>
        <cylinderGeometry args={[0.26, 0.3, 0.1, 24]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} material={M.darkBrass()} position={[Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22]}>
            <cylinderGeometry args={[0.018, 0.018, 0.78, 8]} />
          </mesh>
        );
      })}
      <mesh material={M.glass()}>
        <cylinderGeometry args={[0.2, 0.2, 0.74, 24, 1, true]} />
      </mesh>
      <mesh material={M.darkBrass()} position-y={0.44}>
        <coneGeometry args={[0.3, 0.2, 24]} />
      </mesh>
      <mesh material={M.darkBrass()} position-y={0.62}>
        <torusGeometry args={[0.12, 0.02, 8, 24]} />
      </mesh>
      <mesh material={M.candleWax()} position-y={-0.22}>
        <cylinderGeometry args={[0.07, 0.07, 0.3, 16]} />
      </mesh>
      <mesh ref={flame} material={M.flame()} position-y={0.0}>
        <coneGeometry args={[0.04, 0.16, 12]} />
      </mesh>
      <pointLight ref={light} position-y={0.05} intensity={2.6} distance={3.5} color="#ffb257" />
    </group>
  );
}

/**
 * The hero as a live 3D still life (replaces the flat CSS shapes when WebGL2 is available):
 * tree, gifts, lantern, snow globe and the family photo on the wall. The same objects decay
 * in place at the Reveal, lit by the lantern in a cold night.
 */
export function HeroScene() {
  return (
    <View className="hero-live">
      <HeroContent />
    </View>
  );
}

function HeroContent() {
  const haunted = useHaunted();
  const mains = useFx((s) => s.mains);
  // Wide banner: objects on the right half. Narrow (phone): smaller, in the lower half, under the copy.
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const wide = aspect > 1.6;
  return (
    <>
      <SceneEnv intensity={haunted ? 0.35 : 0.9} />
      <PerspectiveCamera makeDefault position={[0, 0.2, 7.2]} fov={30} />
      <ambientLight intensity={haunted ? 0.08 : 0.35} color={haunted ? '#7d8fb8' : '#ffe8cf'} />
      <directionalLight position={[-3, 4, 4]} intensity={(haunted ? 0.6 : 2.2) * (haunted ? mains : 1)} color={haunted ? '#9fb3dd' : '#ffe2b5'} />
      <directionalLight position={[4, 2, -2]} intensity={haunted ? 0.5 : 1.1} color={haunted ? '#4d5f8e' : '#ffc78f'} />
      {/* After the Reveal the wall behind the still life is gone: the ruined street shows through. */}
      {haunted && <Ruins wide={wide} />}
      {/* Right half of the banner; the copy sits on the left. */}
      <group position={wide ? [Math.min(2.6, aspect * 0.78), 0.1, 0] : [0.1, -1.1, 0]} scale={wide ? 0.82 : 0.55}>
        <group position={[0.2, 0.15, -0.6]} scale={0.95}>
          <Tree haunted={haunted} />
        </group>
        <group position={[-1.7, -0.75, 0.6]} scale={0.95}>
          <Lantern />
        </group>
        <group position={[-0.65, -1.05, 1.0]} scale={0.5}>
          <UnopenedGift />
        </group>
        <group position={[0.95, -1.15, 1.1]} scale={0.36} rotation-y={0.6}>
          <UnopenedGift />
        </group>
        <group position={[2.0, -0.8, 0.8]} scale={0.6}>
          <SnowGlobe />
        </group>
        <group position={[2.1, 1.05, -1]} scale={0.62} rotation-z={haunted ? -0.07 : 0}>
          <PhotoFrame glass={false} />
        </group>
        <group position-y={-1.4}>
          <Shadow y={0} scale={5} />
        </group>
      </group>
    </>
  );
}
