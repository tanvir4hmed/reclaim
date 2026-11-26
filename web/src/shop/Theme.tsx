import { useEffect } from 'react';
import { useFx } from '../fx/fxStore';
import { useHaunted, useStory } from '../store';
import { DAY, HAUNTED, cssVars } from './tokens';

function setAttr(el: HTMLElement, name: string, on: boolean, value = '1') {
  if (on) el.setAttribute(name, value);
  else el.removeAttribute(name);
}

/** Writes the active palette and effect flags to :root for CSS. */
export function Theme() {
  const haunted = useHaunted();
  const mains = useFx((s) => s.mains);
  const sign = useFx((s) => s.sign);
  const quiet = useFx((s) => s.quiet);
  const played = useStory((s) => s.story.played);
  const flags = useFx((s) => s.flags);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.state = haunted ? 'haunted' : 'day';
    for (const [k, v] of Object.entries(cssVars(haunted ? HAUNTED : DAY))) root.style.setProperty(k, v);
  }, [haunted]);

  useEffect(() => {
    document.documentElement.style.setProperty('--mains', String(mains));
  }, [mains]);

  useEffect(() => {
    const root = document.documentElement;
    setAttr(root, 'data-sign', sign !== 'none' && !haunted, sign);
    setAttr(root, 'data-quiet', quiet);
    setAttr(root, 'data-telephone-played', haunted && played.telephone === true);
    setAttr(root, 'data-gift-heavy', haunted && played['unopened-gift'] === true);
    setAttr(root, 'data-doors-slam', flags['doors-slam'] !== undefined);
    setAttr(root, 'data-stuffing', flags['stuffing-fall'] !== undefined);
  }, [sign, quiet, played, haunted, flags]);

  return null;
}
