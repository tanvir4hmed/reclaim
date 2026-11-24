import type { ProductId } from '../core/ids';
import { LiveView } from '../gl/LiveView';
import { hasWebGL2 } from '../gl/webgl';
import { productById } from '../products/catalog';
import { MODELS } from '../products/models';
import { ShoePrints } from '../fx/ShoePrints';
import { useHaunted } from '../store';

/**
 * The image area of a card. With WebGL2 it hosts the product's live object, drawn by the
 * shared shop canvas; otherwise (or for thumbnails) it shows the velvet backdrop and name.
 */
export function ObjectBox({ id, size = 'card' }: { id: ProductId; size?: 'card' | 'large' | 'thumb' }) {
  const haunted = useHaunted();
  const p = productById(id);
  const name = haunted ? p.haunted.name : p.day.name;
  const live = size === 'card' && hasWebGL2() && MODELS[id] !== undefined;
  return (
    <div className={`object-box object-box-${size}`} data-object={id} data-live={live} aria-hidden="true">
      <div className="velvet" />
      {live ? <LiveView id={id} className="live-wrap" /> : size !== 'thumb' && <span className="object-placeholder">{name}</span>}
      {id === 'shoes' && size !== 'thumb' && <ShoePrints />}
    </div>
  );
}
