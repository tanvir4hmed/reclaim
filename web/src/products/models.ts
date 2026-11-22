import type { ComponentType } from 'react';
import type { ProductId } from '../core/ids';
import Cake from './cake/Model';
import Doll from './doll/Model';
import Letter from './letter/Model';
import Mirror from './mirror/Model';
import PhotoFrame from './photo-frame/Model';
import PocketWatch from './pocket-watch/Model';
import Shoes from './shoes/Model';
import { Candle, ChildsDrawing, ChocolateBox, GlassOrnament, MusicBox, SnowGlobe, TeddyBear } from './small/Models';
import { AdventCalendar, InstantCamera, RockingChair, TinSoldier, UnopenedGift, ValveRadio } from './small/TierA';
import Telephone from './telephone/Model';
import Typewriter from './typewriter/Model';

export interface ModelProps {
  /** Inspection only: the case is open (pocket watch), the box is open (music box), it rings (phone). */
  open?: boolean;
}

/** Live object for each product (Requirement 31). Every product has one. */
export const MODELS: Partial<Record<ProductId, ComponentType<ModelProps>>> = {
  'pocket-watch': PocketWatch,
  doll: Doll,
  letter: Letter,
  cake: Cake,
  shoes: Shoes,
  mirror: Mirror,
  'photo-frame': PhotoFrame,
  typewriter: Typewriter,
  telephone: Telephone,
  'advent-calendar': AdventCalendar,
  'tin-soldier': TinSoldier,
  'valve-radio': ValveRadio,
  'instant-camera': InstantCamera,
  'unopened-gift': UnopenedGift,
  'rocking-chair': RockingChair,
  'snow-globe': SnowGlobe,
  'chocolate-box': ChocolateBox,
  'music-box': MusicBox,
  'glass-ornament': GlassOrnament,
  candle: Candle,
  'teddy-bear': TeddyBear,
  'childs-drawing': ChildsDrawing,
};
