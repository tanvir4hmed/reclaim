import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { parseQuery, toSearchParams, type Query } from './query';

/** The shop view lives in the URL so reloads and shared links keep it (Requirement 4.6). */
export function useShopQuery(): [Query, (patch: Partial<Query>) => void] {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseQuery(params), [params]);
  const update = useCallback(
    (patch: Partial<Query>) => {
      setParams((prev) => toSearchParams({ ...parseQuery(prev), ...patch }), { replace: true });
    },
    [setParams],
  );
  return [query, update];
}
