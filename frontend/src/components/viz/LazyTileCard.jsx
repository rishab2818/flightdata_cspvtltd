import React, { useEffect, useRef } from 'react'

export function LazyTileCard({ tile, seriesIndex, onLoadTile, children }) {
  const cardRef = useRef(null)
  const hasTriggered = useRef(false)

  useEffect(() => {
    if (!cardRef.current || !onLoadTile) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTriggered.current) {
            hasTriggered.current = true
            onLoadTile(seriesIndex, tile.level, { silent: true })
          }
        })
      },
      { threshold: 0.6 }
    )

    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [onLoadTile, seriesIndex, tile.level])

  return (
    <div ref={cardRef} className="viz-item viz-item--inline">
      {children}
    </div>
  )
}

export default LazyTileCard
