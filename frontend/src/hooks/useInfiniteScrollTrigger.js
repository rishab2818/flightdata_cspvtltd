import { useEffect, useRef } from "react";

export function useInfiniteScrollTrigger({
  enabled = true,
  hasMore = false,
  isLoading = false,
  onLoadMore,
  root = null,
  rootMargin = "160px",
  threshold = 0,
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!enabled || !hasMore || isLoading || !sentinelRef.current) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        onLoadMore?.();
      },
      {
        root,
        rootMargin,
        threshold,
      }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [enabled, hasMore, isLoading, onLoadMore, root, rootMargin, threshold]);

  return sentinelRef;
}
