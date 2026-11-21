import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { isProductId } from '../core/ids';
import { categoryById, productById } from '../products/catalog';
import { useHaunted, useUi } from '../store';
import { addToCart, limitFor } from './cartActions';
import { Dialog } from './Dialog';
import { discountPercent, money, priceLabel } from './format';
import { CloseIcon, EyeIcon, GiftIcon, HeartIcon, ShieldIcon, TruckIcon } from './icons';
import { ObjectBox } from './ObjectBox';
import { Rating } from './ProductCard';
import { Stepper } from './Stepper';
import { LargeView } from './Inspection';
import { currentSearch } from './useQuery';
import { HauntedProductNotes } from '../fx/Haunts';

const VIEWS = ['Front', 'Side', 'Detail', 'Box'] as const;

/** Keyed by product so its local state resets when the product changes. */
export function ProductViewRoute() {
  const { id } = useParams();
  return <ProductView key={id} />;
}

export function ProductView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const haunted = useHaunted();
  const [qty, setQty] = useState(1);
  const [view, setView] = useState<(typeof VIEWS)[number]>('Front');
  const [inspecting, setInspecting] = useState(false);
  const wished = useUi((s) => (id ? s.wishlist.includes(id) : false));
  const toggleWish = useUi((s) => s.toggleWish);

  if (!id || !isProductId(id)) return null;
  const p = productById(id);
  if (p.hiddenByDay && !haunted) return null;
  const copy = haunted ? p.haunted : p.day;
  const cat = categoryById(p.category);
  const off = discountPercent(p);
  // With a shop page behind us, Back closes; on a direct visit, go to the shop instead of leaving.
  const fromShop = Boolean((location.state as { background?: unknown } | null)?.background);
  const close = () => (fromShop ? navigate(-1) : navigate({ pathname: '/', search: currentSearch() }));

  return (
    <Dialog open onClose={close} labelledBy="pv-title" className="product-view" testId="product-view">
      <button type="button" className="icon-button pv-close" aria-label="Close" onClick={close}>
        <CloseIcon />
      </button>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>Home</li>
          <li>{haunted ? cat.haunted : cat.day}</li>
          {haunted && p.id === 'shoes' && <li>Found near the station</li>}
          <li aria-current="page">{copy.name}</li>
        </ol>
      </nav>
      <div className="pv-layout">
        <div className="pv-thumbs" role="tablist" aria-label="Views">
          {VIEWS.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} aria-label={`${v} view`} onClick={() => setView(v)}>
              <ObjectBox id={p.id} size="thumb" />
            </button>
          ))}
        </div>
        <div className="pv-media" data-view={view}>
          <LargeView id={p.id} inspecting={inspecting} />
        </div>
        <div className="pv-info">
          <h2 id="pv-title" className="pv-title">
            {copy.name}
            {!haunted && off !== null && <span className="starburst starburst-inline">−{off}%</span>}
          </h2>
          <Rating p={p} />
          <p className="pv-blurb">{copy.blurb}</p>
          <p className="price price-large">
            {!haunted && p.day.was && <s className="price-was">{money(p.day.was)}</s>}
            <span className="price-now" data-price-tag data-testid="pv-price">
              {priceLabel(p, haunted)}
            </span>
          </p>
          {!haunted && p.day.stock !== undefined && <p className="stock">Only {p.day.stock} left. 9 people have this in their basket.</p>}
          {haunted && <p className="stock">1 person is standing behind you.</p>}
          <Stepper value={qty} onChange={setQty} label="Quantity" max={limitFor(p.id, haunted)} />
          <button
            type="button"
            className="btn btn-primary btn-block"
            data-testid="pv-add"
            onClick={() => {
              addToCart(p.id, qty);
              setQty(1);
            }}
          >
            {haunted ? 'Take it' : 'Add to cart'}
          </button>
          <div className="pv-row">
            <button type="button" className="btn btn-outline btn-grow" data-testid="pv-inspect" aria-pressed={inspecting} onClick={() => setInspecting((v) => !v)}>
              <EyeIcon /> {inspecting ? 'Stop inspecting' : 'Inspect'}
            </button>
            <button type="button" className="btn btn-outline" aria-pressed={wished} aria-label="Save to wishlist" onClick={() => toggleWish(p.id)}>
              <HeartIcon filled={wished} />
            </button>
          </div>
          <HauntedProductNotes id={p.id} />
          <ul className="services">
            <li>
              <TruckIcon /> {haunted ? 'Delivery: never' : 'Free delivery by Christmas Eve'}
            </li>
            <li>
              <GiftIcon /> {haunted ? 'Already wrapped, by someone else' : 'Gift wrap included'}
            </li>
            <li>
              <ShieldIcon /> {haunted ? 'No returns. Nothing is returned.' : '30-day happiness guarantee'}
            </li>
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
