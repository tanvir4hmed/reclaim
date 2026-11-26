import { create } from 'zustand';
import { parseQuery, toSearchParams, type Query } from './query';

function fromUrl(): Query {
  return parseQuery(new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search));
}

/**
 * The shop view (search, filters, sort, view) lives in one store and is mirrored into the URL
 * with replaceState (Requirement 4.6). Writes are synchronous, so fast typing and an Escape
 * right after can never land out of order (found by e2e: async router navigations raced).
 */
const useQueryStore = create<{ query: Query }>(() => ({ query: fromUrl() }));

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => useQueryStore.setState({ query: fromUrl() }));
}

export function updateQuery(patch: Partial<Query>) {
  const query = { ...useQueryStore.getState().query, ...patch };
  useQueryStore.setState({ query });
  const search = toSearchParams(query).toString();
  const { pathname, hash } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search ? `?${search}` : ''}${hash}`);
}

export function currentSearch(): string {
  const s = toSearchParams(useQueryStore.getState().query).toString();
  return s ? `?${s}` : '';
}

export function useShopQuery(): [Query, (patch: Partial<Query>) => void] {
  const query = useQueryStore((s) => s.query);
  return [query, updateQuery];
}
