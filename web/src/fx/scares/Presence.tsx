import { reducedMotion } from '../../director/runtime';

/**
 * Instant camera: once it has turned to face you, its flash goes off, once, over the whole
 * window. (The picture it takes prints out of the camera itself, in its model.) Under reduced
 * motion there is no flash at all.
 */
export function CameraFlash() {
  if (reducedMotion()) return null;
  return <div className="ts-flash" />;
}
