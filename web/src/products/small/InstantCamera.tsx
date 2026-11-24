import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { drawWitch, useCanvasTexture } from '../../gl/canvasTex';
import { M } from '../../gl/materials';
import { progress, useTaken } from '../../gl/useTaken';
import { useHaunted } from '../../store';
import { CAMERA } from './cameraTiming';

const REST: [number, number, number] = [0.15, -0.45, 0];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** The print slot's height on the body. */
const SLOT_Y = -0.36;
const DOWN = new THREE.Vector3(0, -1, 0);
const tmpN = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

/** Keep only what is below the slot, wherever the camera has turned (outside the component). */
function clipAtSlot(body: THREE.Object3D, plane: THREE.Plane) {
  body.updateWorldMatrix(true, false);
  body.getWorldQuaternion(tmpQ);
  tmpN.copy(DOWN).applyQuaternion(tmpQ);
  tmpP.set(0, SLOT_Y, 0.4);
  body.localToWorld(tmpP);
  plane.setFromNormalAndCoplanarPoint(tmpN, tmpP);
}

function enableLocalClipping(gl: THREE.WebGLRenderer) {
  gl.localClippingEnabled = true;
}

/**
 * The print: the same picture as before (a doorway behind you, your own dark shape in front),
 * and, as it develops, her, standing right behind you. White instant-film frame, a caption.
 */
function drawPrint(g: CanvasRenderingContext2D, w: number, h: number, dev: number) {
  g.fillStyle = '#ebe6da';
  g.fillRect(0, 0, w, h);
  const x0 = 16;
  const y0 = 16;
  const s = w - 32;
  const room = g.createLinearGradient(0, y0, 0, y0 + s);
  room.addColorStop(0, '#2a2622');
  room.addColorStop(1, '#0f0d0b');
  g.fillStyle = room;
  g.fillRect(x0, y0, s, s);
  // the doorway behind you, a little lighter
  g.fillStyle = '#3a3631';
  g.fillRect(x0 + s * 0.5, y0 + s * 0.08, s * 0.3, s * 0.78);
  // her, in the doorway, right behind you: she comes up last as the print develops
  g.save();
  g.globalAlpha = clamp01((dev - 0.45) / 0.4);
  drawWitch(g, x0 + s * 0.66, y0 + s * 0.94, s * 0.82);
  g.restore();
  // you, from behind: dark head and shoulders in the foreground
  g.fillStyle = '#060505';
  g.beginPath();
  g.ellipse(x0 + s * 0.3, y0 + s * 0.62, s * 0.12, s * 0.15, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x0 + s * 0.04, y0 + s);
  g.quadraticCurveTo(x0 + s * 0.08, y0 + s * 0.76, x0 + s * 0.3, y0 + s * 0.74);
  g.quadraticCurveTo(x0 + s * 0.52, y0 + s * 0.76, x0 + s * 0.56, y0 + s);
  g.closePath();
  g.fill();
  // developing: dark and brownish at first, clearing to the picture
  g.fillStyle = `rgba(20,14,8,${(1 - clamp01(dev)) * 0.96})`;
  g.fillRect(x0, y0, s, s);
  g.fillStyle = '#3a3330';
  g.font = '26px "Segoe Script", "Brush Script MT", cursive';
  g.textAlign = 'center';
  g.fillText('you, tonight', w / 2, h - 26);
}

/**
 * Instant camera, the kind that prints its picture: a cream body, a black front with a rainbow
 * stripe, a big lens, the flash window at the top and the print slot under the lens. After the
 * Reveal a print hangs out of it. Taken: whatever way it was turned, it slowly turns to look
 * straight out of the screen at you, flashes once, and the photograph slides out of the slot.
 */
export function InstantCamera() {
  const haunted = useHaunted();
  const { taken, since } = useTaken('instant-camera');
  const body = useRef<THREE.Group>(null);
  const print = useRef<THREE.Group>(null);
  const flashLight = useRef<THREE.PointLight>(null);
  const flashWin = useRef<THREE.MeshBasicMaterial>(null);
  const [dev, setDev] = useState(() => (taken && since() === Infinity ? 1 : 0));
  useEffect(() => {
    if (!taken) return;
    const id = setInterval(() => {
      const d = clamp01((since() - CAMERA.printFrom) / CAMERA.developFor);
      setDev(d);
      if (d >= 1) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [taken, since]);
  const photo = useCanvasTexture(256, 304, (g, w, h) => drawPrint(g, w, h, taken ? dev : 1), [dev, taken]);
  const gl = useThree((s) => s.gl);
  const [slotPlane] = useState(() => new THREE.Plane());
  useEffect(() => enableLocalClipping(gl), [gl]);
  useFrame(() => {
    const s = since();
    const k = taken ? progress(s, CAMERA.turnFor, CAMERA.turnFrom) : 0;
    if (body.current) {
      body.current.rotation.set(REST[0] * (1 - k), REST[1] * (1 - k), REST[2] * (1 - k));
      body.current.position.y = 0.18 * k;
    }
    // One flash, a quarter of a second, once it is looking at you.
    const f = taken && s !== Infinity && s > CAMERA.flashAt && s < CAMERA.flashAt + 0.25 ? 1 - (s - CAMERA.flashAt) / 0.25 : 0;
    if (flashLight.current) flashLight.current.intensity = f * 30;
    if (flashWin.current) flashWin.current.color.setScalar(0.8 + f * 6);
    if (print.current) {
      const out = taken ? progress(s, CAMERA.printFor, CAMERA.printFrom) : 0;
      print.current.visible = taken && out > 0;
      // It starts inside the body and slides down out of the slot until its top edge is at the
      // slot; everything of it above the slot is cut away, so only what has come out shows.
      print.current.position.set(0, 0.35 - out * 0.71, 0.39);
      print.current.rotation.x = -0.06 * out;
      if (body.current) clipAtSlot(body.current, slotPlane);
    }
  });
  return (
    <group position-y={-0.08} scale={0.9}>
      <group ref={body} rotation={REST}>
        {/* the body: cream top, sloping black front */}
        <mesh material={M.enamel()} position-y={0.12}>
          <boxGeometry args={[1.3, 0.62, 0.7]} />
        </mesh>
        {/*
          The lower body, with the print slot, is the same cream as the top: on the dark shop
          after the Reveal a black base vanished into the background, from the lens down.
        */}
        <mesh material={M.enamel()} position={[0, -0.24, 0]}>
          <boxGeometry args={[1.3, 0.3, 0.7]} />
        </mesh>
        <mesh material={M.bakelite()} position={[0, 0.12, 0.36]}>
          <boxGeometry args={[1.26, 0.6, 0.04]} />
        </mesh>
        {/* a bright steel trim along the bottom edge of the black front */}
        <mesh material={M.silver()} position={[0, -0.18, 0.385]}>
          <boxGeometry args={[1.26, 0.018, 0.012]} />
        </mesh>
        {/* the rainbow stripe down the front */}
        {['#c8352e', '#e07b2c', '#e8c23a', '#3e8e4a', '#2f63a8'].map((c, i) => (
          <mesh key={c} position={[-0.42 + i * 0.045, 0.06, 0.383]}>
            <planeGeometry args={[0.04, 0.7]} />
            <meshStandardMaterial color={haunted ? '#3a3430' : c} roughness={0.5} />
          </mesh>
        ))}
        {/* the lens: a big barrel, glass and the dark inside */}
        <mesh material={M.bakelite()} position={[0.12, 0.08, 0.43]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.22, 0.24, 0.12, 40]} />
        </mesh>
        <mesh material={M.silver()} position={[0.12, 0.08, 0.49]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.2, 0.015, 8, 40]} />
        </mesh>
        <mesh material={M.glass()} position={[0.12, 0.08, 0.492]}>
          <circleGeometry args={[0.18, 32]} />
        </mesh>
        <mesh material={M.ink()} position={[0.12, 0.08, 0.488]}>
          <circleGeometry args={[0.11, 32]} />
        </mesh>
        {/* flash window, viewfinder, shutter button */}
        <mesh position={[-0.28, 0.33, 0.385]}>
          <planeGeometry args={[0.34, 0.12]} />
          <meshBasicMaterial ref={flashWin} color="#d8d4cc" toneMapped={false} />
        </mesh>
        <pointLight ref={flashLight} position={[-0.28, 0.33, 0.9]} color="#f4f6ff" distance={5} intensity={0} />
        <mesh material={M.ink()} position={[0.42, 0.33, 0.385]}>
          <planeGeometry args={[0.14, 0.1]} />
        </mesh>
        <mesh material={M.wax()} position={[0.52, 0.0, 0.39]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.04, 0.04, 0.03, 16]} />
        </mesh>
        {/* the print slot under the lens */}
        <mesh material={M.ink()} position={[0, -0.36, 0.41]}>
          <boxGeometry args={[0.68, 0.025, 0.02]} />
        </mesh>
        <group ref={print} visible={false}>
          <mesh position-y={-0.355}>
            <planeGeometry args={[0.6, 0.71]} />
            <meshStandardMaterial map={photo} roughness={0.55} clippingPlanes={[slotPlane]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
