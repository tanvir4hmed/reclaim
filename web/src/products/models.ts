import type { ComponentType } from 'react';
import type { ProductId } from '../core/ids';
import PocketWatch from './pocket-watch/Model';

export interface ModelProps {
  /** Inspection only: the case is open (pocket watch) or the object is being handled. */
  open?: boolean;
}

/** Live object for each product. Products without a model fall back to their still card. */
export const MODELS: Partial<Record<ProductId, ComponentType<ModelProps>>> = {
  'pocket-watch': PocketWatch,
};
