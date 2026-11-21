import { useEffect, useRef, useState } from 'react';
import { reducedMotion, wait } from '../director/runtime';
import { useHaunted, useStory } from '../store';
import { BatSvg } from './BatSvg';
import { useFx } from './fxStore';
import { nearbyPerches, perchSpot, type PerchSpot } from './perches';

interface Bat {
  perch: string;
  flying: boolean;
  eyes: boolean;
  seed: number;
}

const START = ['hero-tree', 'hero-photo', 'tile-sweets'];

/**
 * Haunted bats (Requirement 11.1–11.3): hang still with wings wrapped while the light is up,
 * fly only in darkness, glow their eyes now and then, drop into the grid to hang from cards,
 * and take off when the pointer reaches the card they hang from.
 */
export function HauntedBats() {
  const haunted = useHaunted();
  const phase = useStory((s) => s.story.phase);
  const mains = useFx((s) => s.mains);
  const [bats, setBats] = useState<Bat[]>(() => START.map((perch, i) => ({ perch, flying: false, eyes: false, seed: 0.2 + i * 0.25 })));
  const [, force] = useState(0);
  const batsRef = useRef(bats);
  useEffect(() => {
    batsRef.current = bats;
  });
  const active = haunted && phase !== 'accepted';

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => force((n) => n + 1), 1200);
    return () => clearInterval(t);
  }, [active]);

  // Darkness makes them fly; at most two in flight (Req 11.3).
  useEffect(() => {
    if (!active || mains > 0.5 || reducedMotion()) return;
    const flying = batsRef.current.filter((b) => b.flying).length;
    if (flying >= 2) return;
    const options = nearbyPerches();
    const idx = Math.floor(Math.random() * batsRef.current.length);
    const target = options.find((p) => p.startsWith('card-') && !batsRef.current.some((b) => b.perch === p)) ?? options[0];
    if (!target) return;
    void (async () => {
      setBats((bs) => bs.map((b, i) => (i === idx ? { ...b, flying: true } : b)));
      await wait(900);
      setBats((bs) => bs.map((b, i) => (i === idx ? { ...b, perch: target } : b)));
      await wait(900);
      setBats((bs) => bs.map((b, i) => (i === idx ? { ...b, flying: false } : b)));
    })();
  }, [mains, active]);

  // Eyes glow briefly in the dark (Req 11.1b).
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      const dark = useFx.getState().mains < 0.6;
      setBats((bs) => bs.map((b) => ({ ...b, eyes: dark && Math.random() < 0.4 })));
    }, 1500);
    return () => clearInterval(t);
  }, [active]);

  // Take off when the pointer reaches the card a bat hangs from.
  useEffect(() => {
    if (!active) return;
    const onOver = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-perch]') as HTMLElement | null;
      const id = el?.dataset.perch;
      if (!id?.startsWith('card-')) return;
      const i = batsRef.current.findIndex((b) => b.perch === id && !b.flying);
      if (i < 0) return;
      const next = START[i] ?? 'hero-tree';
      void (async () => {
        setBats((bs) => bs.map((b, j) => (j === i ? { ...b, flying: true } : b)));
        await wait(700);
        setBats((bs) => bs.map((b, j) => (j === i ? { ...b, perch: next } : b)));
        await wait(900);
        setBats((bs) => bs.map((b, j) => (j === i ? { ...b, flying: false } : b)));
      })();
    };
    document.addEventListener('pointerover', onOver);
    return () => document.removeEventListener('pointerover', onOver);
  }, [active]);

  if (!active) return null;
  return (
    <>
      {bats.map((b, i) => {
        const spot: PerchSpot | null = perchSpot(b.perch, b.seed);
        if (!spot) return null;
        return (
          <div key={i} className={`haunted-bat${b.flying ? ' is-flying' : ''}`} style={{ left: spot.x - 27, top: spot.y }} aria-hidden="true" data-testid="haunted-bat">
            <BatSvg pose={b.flying ? 'fly' : 'hang'} eyes={b.eyes} />
          </div>
        );
      })}
    </>
  );
}
