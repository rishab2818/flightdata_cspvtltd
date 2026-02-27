import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const DEFAULT_LAZY_PAGE_SIZE = 30;

export function useLazyCollection({
  fetchPage,
  deps = [],
  enabled = true,
  pageSize = DEFAULT_LAZY_PAGE_SIZE,
  errorMessage = "Failed to load data.",
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(Boolean(enabled));

  const seqRef = useRef(0);

  const loadPage = useCallback(
    async (nextPage, { reset = false } = {}) => {
      if (!enabled) return [];

      const seq = ++seqRef.current;

      if (reset) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }

      try {
        const data = await fetchPage({ page: nextPage, limit: pageSize });
        const nextItems = Array.isArray(data) ? data : [];

        if (seqRef.current !== seq) return [];

        setItems((prev) => (reset ? nextItems : [...prev, ...nextItems]));
        setPage(nextPage);
        setHasMore(nextItems.length >= pageSize);
        return nextItems;
      } catch (err) {
        if (seqRef.current !== seq) return [];
        setError(errorMessage);
        if (reset) {
          setItems([]);
          setPage(1);
        }
        setHasMore(false);
        return [];
      } finally {
        if (seqRef.current === seq) {
          if (reset) {
            setLoading(false);
          } else {
            setLoadingMore(false);
          }
        }
      }
    },
    [enabled, errorMessage, fetchPage, pageSize]
  );

  const refresh = useCallback(() => loadPage(1, { reset: true }), [loadPage]);

  const loadMore = useCallback(() => {
    if (!enabled || loading || loadingMore || !hasMore) {
      return Promise.resolve([]);
    }
    return loadPage(page + 1);
  }, [enabled, hasMore, loadPage, loading, loadingMore, page]);

  const depsSignature = useMemo(() => JSON.stringify(deps), [deps]);

  useEffect(() => {
    seqRef.current += 1;
    setError("");

    if (!enabled) {
      setItems([]);
      setPage(1);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    setHasMore(true);
    void loadPage(1, { reset: true });
  }, [enabled, depsSignature, loadPage]);

  return {
    items,
    setItems,
    loading,
    loadingMore,
    error,
    hasMore,
    page,
    refresh,
    loadMore,
  };
}
