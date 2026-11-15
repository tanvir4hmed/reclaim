import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { isHauntedPhase } from '../core';
import { useFx } from '../fx/fxStore';
import { onCues, useStory, useUi } from '../store';
import { nav } from './bridge';
import { playConsequence, playReminder } from './consequences';
import { dayLoop, hauntedLoop } from './ambient';
import { loadEcho } from './echo';
import { stormPattern } from './flash';
import { onStage, playLight } from './runtime';
import { acceptedSequence, closingSequence, revealSequence } from './sequences';

/** Wires story cues to sequences and runs the ambient loops (design: The Director). */
export function Director() {
  const navigate = useNavigate();
  const phase = useStory((s) => s.story.phase);
  const batHover = useFx((s) => s.batHover);
  const lastStorm = useRef(0);

  useEffect(() => {
    nav.go = (to) => navigate(to);
  }, [navigate]);

  useEffect(
    () =>
      onCues((cues) => {
        for (const c of cues) {
          if (c.type === 'reveal') void revealSequence();
          else if (c.type === 'consequence') void onStage(`c-${c.id}`, 'major', true, () => playConsequence(c.id));
          else if (c.type === 'reminder') void playReminder(c.id);
          else if (c.type === 'closing') void closingSequence();
          else if (c.type === 'accepted') void acceptedSequence();
        }
      }),
    [],
  );

  // Reloading mid-climax resumes at checkout; the store already maps the phase.
  useEffect(() => {
    if (phase === 'day') void loadEcho();
  }, [phase]);

  // Storm flicker when reaching for the Day bat, at most every 3 s (Req 9.1, 9.4).
  useEffect(() => {
    if (!batHover) {
      document.documentElement.removeAttribute('data-reaching');
      return;
    }
    document.documentElement.setAttribute('data-reaching', '1');
    const now = performance.now();
    if (now - lastStorm.current < 3000) return;
    lastStorm.current = now;
    void playLight(stormPattern());
  }, [batHover]);

  useEffect(() => {
    const ctrl = new AbortController();
    if (phase === 'day') void dayLoop(ctrl.signal);
    if (isHauntedPhase(phase)) void hauntedLoop(ctrl.signal);
    return () => ctrl.abort();
  }, [phase]);

  // Tab away (Requirement 32.9).
  useEffect(() => {
    const original = document.title;
    const onVis = () => {
      const haunted = isHauntedPhase(useStory.getState().story.phase);
      document.title = document.hidden ? (haunted ? 'Come back…' : 'Your cart misses you') : original;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Exit intent, once per visit, never blocking (Requirement 32.10).
  useEffect(() => {
    let shown = false;
    const onOut = (e: MouseEvent) => {
      if (shown || e.relatedTarget || e.clientY > 4) return;
      shown = true;
      const haunted = isHauntedPhase(useStory.getState().story.phase);
      useFx.getState().flag(haunted ? 'exit-haunted' : 'exit-day');
      useUi.getState().announce(haunted ? "Don't leave us here." : 'Wait! Take 10% off your first order.');
      setTimeout(() => {
        useFx.getState().unflag('exit-haunted');
        useFx.getState().unflag('exit-day');
      }, 5000);
    };
    document.addEventListener('mouseout', onOut);
    return () => document.removeEventListener('mouseout', onOut);
  }, []);

  return null;
}
