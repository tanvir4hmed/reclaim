export type AnomalySize = 'major' | 'minor' | 'quirk';

export interface StageState {
  /** The major Anomaly holding the Stage, if any. */
  holder: { id: string; visitor: boolean } | null;
  /** When the last major Anomaly ended (ms). */
  lastEnd: number;
}

export const initialStage: StageState = { holder: null, lastEnd: -Infinity };

/** Quiet gap after a major Anomaly: 6 s at act 1, shrinking with the act, never under 4 s (Req 12.3b). */
export function quietGap(act: number): number {
  return Math.max(4000, 6000 - Math.max(0, act - 1) * 700);
}

/**
 * Whether an Anomaly may start now. Visitor-triggered ones always may (they pre-empt ambient
 * ones). Ambient majors need an empty Stage and the quiet gap. Minor and quirk Anomalies may
 * run only while no major one holds the Stage.
 */
export function canStart(s: StageState, size: AnomalySize, visitor: boolean, now: number, act: number): boolean {
  if (visitor) return !s.holder?.visitor;
  if (s.holder) return false;
  if (size === 'major') return now - s.lastEnd >= quietGap(act);
  return true;
}

export function begin(s: StageState, id: string, size: AnomalySize, visitor: boolean): StageState {
  if (size !== 'major' && !visitor) return s;
  return { ...s, holder: { id, visitor } };
}

export function end(s: StageState, id: string, now: number): StageState {
  if (s.holder?.id !== id) return s;
  return { holder: null, lastEnd: now };
}
