import type { ProductId } from './ids';

export type Phase = 'day' | 'catching' | 'haunted' | 'closing' | 'checkout' | 'accepted';

/** 0 Open, 1 After hours, 2 Inventory, 3 Closing time, 4 Final sale (Requirement 37). */
export type Act = 0 | 1 | 2 | 3 | 4;

export type PaymentKind = 'time' | 'age' | 'memory';

export interface Payment {
  kind: PaymentKind;
  option: string;
}

/** A trace an Anomaly leaves behind, in page coordinates (CSS px from the document origin). */
export interface LastingMark {
  id: string;
  kind: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  product: ProductId | null;
}

export type EchoCondition = 'haunted' | 'taken';

export interface EchoRef {
  product: ProductId;
  condition: EchoCondition;
}

export type MotionSetting = 'system' | 'reduced' | 'full';

export interface Settings {
  motion: MotionSetting;
  sound: boolean;
}

export interface CheckoutState {
  payment: Payment | null;
  agreed: boolean;
  giftWrap: boolean;
}

export type Cart = Partial<Record<ProductId, number>>;

export interface StoryState {
  version: 1;
  phase: Phase;
  act: Act;
  cart: Cart;
  /** Products in the order they were last added, most recent last, no duplicates. */
  carted: ProductId[];
  /** Distinct products carted in the Haunted state. Its length is the Weight. */
  taken: ProductId[];
  /** Consequences already played in full this run. */
  played: Partial<Record<ProductId, true>>;
  closingPlayed: boolean;
  checkout: CheckoutState;
  marks: LastingMark[];
  clockDirection: 1 | -1;
  /** Products that joined the catalog during the run (haunted search). */
  extras: ProductId[];
  /** What this player leaves behind, fixed at Accept. */
  leftBehind: EchoRef | null;
  /** The object shown in the hero of the Day shop. */
  echo: EchoRef | null;
  settings: Settings;
}

export type StoryEvent =
  | { type: 'BAT_CAUGHT' }
  | { type: 'REVEAL_DONE' }
  | { type: 'ADD_TO_CART'; id: ProductId; qty?: number }
  | { type: 'SET_QTY'; id: ProductId; qty: number }
  | { type: 'REMOVE'; id: ProductId }
  | { type: 'SNEAK_INTO_CART'; id: ProductId }
  | { type: 'CATALOG_EXTRA'; id: ProductId }
  | { type: 'OPEN_CHECKOUT' }
  | { type: 'CLOSING_DONE' }
  | { type: 'SET_PAYMENT'; payment: Payment | null }
  | { type: 'SET_AGREEMENT'; agreed: boolean }
  | { type: 'SET_GIFT_WRAP'; on: boolean }
  | { type: 'DECLINE' }
  | { type: 'ACCEPT' }
  | { type: 'RETURN_DONE' }
  | { type: 'MARK_ADDED'; mark: LastingMark }
  | { type: 'ECHO_LOADED'; echo: EchoRef | null }
  | { type: 'SETTINGS'; settings: Partial<Settings> };

export type Cue =
  | { type: 'reveal' }
  | { type: 'consequence'; id: ProductId }
  | { type: 'reminder'; id: ProductId }
  | { type: 'act'; act: Act }
  | { type: 'closing' }
  | { type: 'accepted' }
  | { type: 'returned' };

export interface StepResult {
  state: StoryState;
  cues: Cue[];
}
