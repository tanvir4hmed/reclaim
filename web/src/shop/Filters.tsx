import { useId } from 'react';
import { CATEGORIES, type CategoryId } from '../products/catalog';
import { useHaunted } from '../store';
import { DEFAULT_QUERY, PRICE_CEIL, PRICE_FLOOR } from './query';
import { useShopQuery } from './useQuery';

function PriceRange() {
  const [query, update] = useShopQuery();
  const id = useId();
  const span = PRICE_CEIL - PRICE_FLOOR;
  const left = ((query.min - PRICE_FLOOR) / span) * 100;
  const right = ((query.max - PRICE_FLOOR) / span) * 100;
  return (
    <fieldset className="filter-group">
      <legend className="filter-title">Price</legend>
      <div className="range" style={{ ['--from' as string]: `${left}%`, ['--to' as string]: `${right}%` }}>
        <label className="sr-only" htmlFor={`${id}-min`}>
          Minimum price in dollars
        </label>
        <input
          id={`${id}-min`}
          type="range"
          min={PRICE_FLOOR}
          max={PRICE_CEIL}
          step={5}
          value={query.min}
          onChange={(e) => update({ min: Math.min(Number(e.target.value), query.max) })}
        />
        <label className="sr-only" htmlFor={`${id}-max`}>
          Maximum price in dollars
        </label>
        <input
          id={`${id}-max`}
          type="range"
          min={PRICE_FLOOR}
          max={PRICE_CEIL}
          step={5}
          value={query.max}
          onChange={(e) => update({ max: Math.max(Number(e.target.value), query.min) })}
        />
      </div>
      <p className="range-values" aria-live="polite">
        ${query.min} – ${query.max}
      </p>
    </fieldset>
  );
}

export function Filters({ onDone }: { onDone?: () => void }) {
  const haunted = useHaunted();
  const [query, update] = useShopQuery();
  const id = useId();

  function toggle(cat: CategoryId) {
    const has = query.categories.includes(cat);
    update({ categories: has ? query.categories.filter((c) => c !== cat) : [...query.categories, cat] });
  }

  const dirty =
    query.categories.length > 0 || query.min !== DEFAULT_QUERY.min || query.max !== DEFAULT_QUERY.max;

  return (
    <div className="filters">
      <fieldset className="filter-group">
        <legend className="filter-title">{haunted ? 'What it was' : 'Category'}</legend>
        <ul>
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <label className="check" htmlFor={`${id}-${c.id}`}>
                <input
                  id={`${id}-${c.id}`}
                  type="checkbox"
                  checked={query.categories.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span>{haunted ? c.haunted : c.day}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <PriceRange />
      <div className="filter-actions">
        {dirty && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => update({ categories: [], min: DEFAULT_QUERY.min, max: DEFAULT_QUERY.max })}
          >
            Clear filters
          </button>
        )}
        {onDone && (
          <button type="button" className="btn btn-primary" onClick={onDone}>
            Show results
          </button>
        )}
      </div>
    </div>
  );
}
