import type { ComponentType } from 'react';
import type { ProductId } from '../core/ids';
import Candle from './candle/Model';
import Doll from './doll/Model';
import Hourglass from './hourglass/Model';
import JackInTheBox from './jack-in-the-box/Model';
import Letter from './letter/Model';
import Mirror from './mirror/Model';
import Nutcracker from './nutcracker/Model';
import OilLamp from './oil-lamp/Model';
import PhotoFrame from './photo-frame/Model';
import PocketWatch from './pocket-watch/Model';
import Shoes from './shoes/Model';
import Sleigh from './sleigh/Model';
import { ChildsDrawing, ChocolateBox, MusicBox, SnowGlobe, TeddyBear } from './small/Models';
import { AdventCalendar, InstantCamera, RockingChair, UnopenedGift } from './small/TierA';
import Telephone from './telephone/Model';
import Television from './television/Model';
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
  shoes: Shoes,
  mirror: Mirror,
  'photo-frame': PhotoFrame,
  typewriter: Typewriter,
  telephone: Telephone,
  'advent-calendar': AdventCalendar,
  television: Television,
  'instant-camera': InstantCamera,
  'unopened-gift': UnopenedGift,
  'rocking-chair': RockingChair,
  hourglass: Hourglass,
  sleigh: Sleigh,
  'oil-lamp': OilLamp,
  'snow-globe': SnowGlobe,
  'chocolate-box': ChocolateBox,
  'music-box': MusicBox,
  candle: Candle,
  'teddy-bear': TeddyBear,
  'jack-in-the-box': JackInTheBox,
  nutcracker: Nutcracker,
  'childs-drawing': ChildsDrawing,
};
