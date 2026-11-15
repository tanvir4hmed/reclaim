import { useMemo } from 'react';
import { useHaunted, useStory, useUi } from '../store';
import { Dialog } from './Dialog';
import { Filters } from './Filters';
import { FilterIcon, GridIcon, ListIcon } from './icons';
import { ProductCard } from './ProductCard';
import { DEFAULT_QUERY, runQuery, type SortKey } from './query';
import { useShopQuery } from './useQuery';

const SORT_LABELS: Record<SortKey, string> = {
  featured: 'Featured',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  rating: 'Best rated',
};

export function ProductGrid() {
  const haunted = useHaunted();
  const extras = useStory((s) => s.story.extras);
  const [query, update] = useShopQuery();
  const filtersOpen = useUi((s) => s.filtersOpen);
  const setFiltersOpen = useUi((s) => s.setFiltersOpen);
  const rows = useMemo(() => runQuery(query, { haunted, extras }), [query, haunted, extras]);

  return (
    <section className="shop" id="shop" aria-labelledby="shop-title">
      <aside className="sidebar" aria-label="Filters">
        <Filters />
      </aside>
      <div className="shop-main">
        <div className="toolbar">
          <h2 id="shop-title" className="toolbar-title">
            {haunted ? 'What was left behind' : 'All gifts'}{' '}
            <span className="count">({rows.length})</span>
          </h2>
          <button type="button" className="btn btn-quiet filters-button" onClick={() => setFiltersOpen(true)}>
            <FilterIcon /> Filters
          </button>
          <div className="view-toggle" role="group" aria-label="View">
            <button type="button" aria-pressed={query.view === 'grid'} aria-label="Grid view" onClick={() => update({ view: 'grid' })}>
              <GridIcon />
            </button>
            <button type="button" aria-pressed={query.view === 'list'} aria-label="List view" onClick={() => update({ view: 'list' })}>
              <ListIcon />
            </button>
          </div>
          <label className="sort">
            <span className="sr-only">Sort by</span>
            <select value={query.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
              {Object.entries(SORT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        {rows.length === 0 ? (
          <div className="empty" role="status">
            <p>{haunted ? 'Nothing here answers to that.' : 'No gifts match your search.'}</p>
            <button type="button" className="btn btn-quiet" onClick={() => update({ ...DEFAULT_QUERY, view: query.view })}>
              Clear search and filters
            </button>
          </div>
        ) : (
          <ul className={`grid grid-${query.view}`} data-testid="product-grid">
            {rows.map((p) => (
              <li key={p.id}>
                <ProductCard p={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} labelledBy="filters-title" className="sheet sheet-left">
        <h2 id="filters-title" className="sheet-title">
          Filters
        </h2>
        <Filters onDone={() => setFiltersOpen(false)} />
      </Dialog>
    </section>
  );
}
