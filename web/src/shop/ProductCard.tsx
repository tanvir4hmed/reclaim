import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { currentSearch } from './useQuery';
import type { ProductMeta } from '../products/catalog';
import { useFx } from '../fx/fxStore';
import { useHaunted, useUi } from '../store';
import { addToCart, limitFor } from './cartActions';
import { discountPercent, priceLabel, money } from './format';
import { CartIcon, HeartIcon } from './icons';
import { ObjectBox } from './ObjectBox';
import { Stepper } from './Stepper';
import { CartNoteLine } from './Toast';
import { LetterOpen, useRollCallName } from '../fx/Extras';
import { useChocolateCountdown } from '../fx/Haunts';
import { CATALOG } from '../products/catalog';

export function Rating({ p }: { p: ProductMeta }) {
  return (
    <span className="rating" aria-label={`Rated ${p.rating} out of 5, ${p.reviews} reviews`}>
      <span aria-hidden="true">{'◆'.repeat(p.rating)}</span>
      <span className="rating-count" aria-hidden="true">
        ({p.reviews})
      </span>
    </span>
  );
}

export function ProductCard({ p }: { p: ProductMeta }) {
  const haunted = useHaunted();
  const location = useLocation();
  const [qty, setQty] = useState(1);
  const wished = useUi((s) => s.wishlist.includes(p.id));
  const toggleWish = useUi((s) => s.toggleWish);
  const copy = haunted ? p.haunted : p.day;
  const off = discountPercent(p);
  const titleId = `title-${p.id}`;
  const rollName = useRollCallName(p.id, CATALOG.indexOf(p));
  const choc = useChocolateCountdown(p.id);
  const playing = useFx((s) => s.playing === p.id || s.flags[`remind-${p.id}`] !== undefined);

  return (
    <article className={`card${playing ? ' is-playing' : ''}`} data-product={p.id} data-perch={`card-${p.id}`} aria-labelledby={titleId} onPointerLeave={choc.onLeave}>
      <Link
        to={`/product/${p.id}${currentSearch()}`}
        state={{ background: location }}
        className="card-media"
        tabIndex={-1}
        aria-hidden="true"
      >
        <ObjectBox id={p.id} />
      </Link>
      {!haunted && off !== null && (
        <span className="starburst" aria-label={`${off}% off`}>
          −{off}%
        </span>
      )}
      <button
        type="button"
        className="wish"
        aria-pressed={wished}
        aria-label={wished ? `Remove ${copy.name} from wishlist` : `Save ${copy.name} to wishlist`}
        onClick={() => toggleWish(p.id)}
      >
        <HeartIcon filled={wished} />
      </button>
      <div className="card-body">
        <h3 className="card-title" id={titleId}>
          <Link to={`/product/${p.id}${currentSearch()}`} state={{ background: location }}>
            {rollName ?? copy.name}
          </Link>
        </h3>
        <p className="card-blurb">{copy.blurb}</p>
        {p.id === 'letter' && <LetterOpen />}
        <div className="card-meta">
          <Rating p={p} />
          {!haunted && p.day.stock !== undefined && <span className="stock">Only {p.day.stock} left</span>}
          {choc.left !== null && <span className="stock" data-testid="choc-left">Only {choc.left} left</span>}
        </div>
        <p className="price">
          <span className="price-now" data-price-tag>
            {priceLabel(p, haunted)}
          </span>
          {!haunted && p.day.was && (
            <s className="price-was">
              <span className="sr-only">was </span>
              {money(p.day.was)}
            </s>
          )}
        </p>
        <div className="card-actions">
          <Stepper value={qty} onChange={setQty} label={`Quantity for ${copy.name}`} max={limitFor(p.id, haunted)} />
          <button
            type="button"
            className="btn btn-primary btn-cart"
            data-testid={`add-${p.id}`}
            aria-label={`Add ${copy.name} to cart`}
            onClick={() => {
              addToCart(p.id, qty);
              setQty(1);
            }}
          >
            <CartIcon size={18} />
            <span className="btn-cart-text">Add</span>
          </button>
        </div>
        <CartNoteLine id={p.id} haunted={haunted} />
      </div>
    </article>
  );
}
