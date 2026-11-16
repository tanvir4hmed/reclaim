import { PerspectiveCamera } from '@react-three/drei';
import { useFx } from '../fx/fxStore';
import { useHaunted } from '../store';

/**
 * Per-view light rig (design: Lighting and look). Warm key and rim by day; cold, low key
 * after the Reveal. The electric part follows `mains` (Requirement 34).
 */
export function Studio({ distance = 3.6, fov = 34 }: { distance?: number; fov?: number }) {
  const haunted = useHaunted();
  const mains = useFx((s) => s.mains);
  const k = haunted ? 0.55 * mains : 1;
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.25, distance]} fov={fov} />
      <ambientLight intensity={(haunted ? 0.12 : 0.35) * (haunted ? mains : 1)} color={haunted ? '#8ea0c8' : '#fff1de'} />
      <directionalLight position={[-2.2, 3, 2.4]} intensity={2.6 * k} color={haunted ? '#b8c6e6' : '#ffe2b8'} />
      <directionalLight position={[2.5, 1.5, -2]} intensity={1.4 * k} color={haunted ? '#5a6d9c' : '#ffd0a0'} />
      {haunted && <pointLight position={[1.4, -0.2, 1.4]} intensity={2.2} distance={4} color="#ffb060" />}
    </>
  );
}
