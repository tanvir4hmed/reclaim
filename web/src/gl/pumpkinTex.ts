import * as THREE from 'three';

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Orange rind with dark grooves, mottling and black rot, painted on a canvas (no image files). */
export function rindTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const base = g.createLinearGradient(0, 0, 0, 256);
    base.addColorStop(0, '#6a300a');
    base.addColorStop(0.5, '#b8571a');
    base.addColorStop(1, '#4a2006');
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * 512 + 32;
      g.fillStyle = 'rgba(50,16,3,0.35)';
      g.fillRect(x - 6, 0, 12, 256);
    }
    const rnd = seeded(7);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,170,80,0.08)' : 'rgba(60,25,6,0.12)';
      g.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 6);
    }
    for (let i = 0; i < 6; i++) {
      const x = rnd() * 512;
      const y = 150 + rnd() * 90;
      const r = 6 + rnd() * 16;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(12,6,2,0.85)');
      grd.addColorStop(1, 'rgba(12,6,2,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
