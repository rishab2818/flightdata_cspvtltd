import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { visualizationApi } from '../../api/visualizationApi'

const palette = ['#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9', '#14b8a6']

const findSeriesRange = (viz, index) => {
  const stats = viz?.series_stats || []
  const series = viz?.series?.[index]
  if (!series) return null
  const match = stats.find((item) => {
    const meta = item?.series || {}
    return meta.job_id === series.job_id && meta.y_axis === series.y_axis
  })
  if (!match) return null
  return match.stats || match
}

const extractRangeFromHeaders = (headers = {}) => {
  const min = headers['x-range-min']
  const max = headers['x-range-max']
  if (min === undefined || max === undefined) return null
  return { x_min: Number(min), x_max: Number(max) }
}

const extractTotalRowsFromHeaders = (headers = {}) => {
  const total = headers['x-total-rows']
  if (total === undefined || total === null) return null
  const parsed = Number(total)
  return Number.isFinite(parsed) ? parsed : null
}

const dedupeMerge = (current, incoming, xKey, yKey) => {
  if (!incoming?.length) return current
  const seen = new Set(current.map((row) => `${row[xKey]}::${row[yKey]}`))
  const merged = [...current]
  incoming.forEach((row) => {
    const key = `${row[xKey]}::${row[yKey]}`
    if (!seen.has(key)) {
      merged.push(row)
      seen.add(key)
    }
  })
  return merged
}

export default function StreamingPlot({ viz, autoStart = true }) {
  const [seriesData, setSeriesData] = useState([])
  const [fullRange, setFullRange] = useState(null)
  const [windowSize, setWindowSize] = useState(null)
  const [nextStart, setNextStart] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const [totalRows, setTotalRows] = useState(null)
  const [rowsLoaded, setRowsLoaded] = useState(0)
  const [rowsPerSecond, setRowsPerSecond] = useState(null)

  const fullRangeRef = useRef(null)
  const pendingWindows = useRef(new Set())
  const scrollThrottle = useRef(null)
  const scrollRef = useRef(null)

  const yAxis = useMemo(() => viz?.series?.[0]?.y_axis, [viz])

  const loadWindow = useCallback(
    async (start, end) => {
      if (!viz?.viz_id || !viz?.series?.length) return

      const key = `${start}:${end}`
      if (pendingWindows.current.has(key)) return
      pendingWindows.current.add(key)
      setLoading(true)
      setError(null)

      const requestStartedAt = performance.now()
      const previousCount = seriesData[0]?.length || 0

      try {
        const responses = await Promise.all(
          viz.series.map((_, idx) =>
            visualizationApi.windowData(viz.viz_id, {
              series: idx,
              start,
              end,
            })
          )
        )

        const headerRange = extractRangeFromHeaders(responses[0]?.headers)
        const payloadRange = responses[0]?.data?.range
        const resolvedRange = payloadRange || headerRange || fullRangeRef.current
        if (resolvedRange) {
          setFullRange((prev) => prev || resolvedRange)
          if (!fullRangeRef.current) fullRangeRef.current = resolvedRange
        }

        const headerTotalRows = extractTotalRowsFromHeaders(responses[0]?.headers)
        const payloadTotalRows = payloadRange?.rows
        const resolvedTotalRows = payloadTotalRows ?? headerTotalRows ?? totalRows
        if (resolvedTotalRows) setTotalRows(resolvedTotalRows)

        let mergedData = []
        setSeriesData((prev) => {
          const base = prev.length === viz.series.length ? prev : viz.series.map(() => [])
          mergedData = base.map((items, idx) =>
            dedupeMerge(
              items,
              responses[idx]?.data?.rows || [],
              viz.x_axis,
              viz.series[idx].y_axis
            )
          )
          return mergedData
        })

        const mergedPrimary = mergedData[0] || []
        const newRowsLoaded = mergedPrimary.length
        setRowsLoaded(newRowsLoaded)
        const added = Math.max(0, newRowsLoaded - previousCount)
        const durationSec = Math.max((performance.now() - requestStartedAt) / 1000, 0.001)
        if (added > 0) {
          const instantRate = Math.round(added / durationSec)
          setRowsPerSecond((prev) => Math.round((prev || instantRate) * 0.5 + instantRate * 0.5))
        }

        const moreAvailable = responses.some((res) => res?.data?.has_more)
        const rangeLimit = resolvedRange?.x_max
        const anyRows = responses.some((res) => (res?.data?.rows || []).length > 0)
        const rangeSuggestsMore = rangeLimit === undefined ? anyRows : end < rangeLimit
        const rowsRemaining = resolvedTotalRows ? resolvedTotalRows - newRowsLoaded : null
        const moreByCount = rowsRemaining === null ? rangeSuggestsMore : rowsRemaining > 0
        setHasMore(Boolean(moreAvailable) || moreByCount)
        setNextStart(end)
      } catch (err) {
        setError(err?.response?.data?.detail || err.message || 'Failed to load data window')
        setHasMore(false)
        setNextStart(null)
      } finally {
        pendingWindows.current.delete(key)
        setLoading(false)
      }
    },
    [viz, totalRows, seriesData]
  )

  useEffect(() => {
    if (!viz?.viz_id || !viz?.series?.length) {
      setSeriesData([])
      setFullRange(null)
      fullRangeRef.current = null
      setWindowSize(null)
      setNextStart(null)
      setHasMore(false)
      setError(null)
      setTotalRows(null)
      setRowsLoaded(0)
      setRowsPerSecond(null)
      pendingWindows.current.clear()
      return
    }

    const firstRange = findSeriesRange(viz, 0)
    const start = firstRange?.x_min ?? 0
    const end = firstRange?.x_max ?? start + 100
    const span = Math.max((end - start) / 8, 1)

    setSeriesData(viz.series.map(() => []))
    setFullRange(firstRange || null)
    fullRangeRef.current = firstRange || null
    setWindowSize(span)
    setNextStart(start)
    setHasMore(true)
    setError(null)
    setTotalRows(firstRange?.rows ?? null)
    setRowsLoaded(0)
    setRowsPerSecond(null)
    pendingWindows.current.clear()

    if (autoStart) {
      loadWindow(start, start + span)
    }
  }, [viz, loadWindow, autoStart])

  useEffect(() => () => {
    if (scrollThrottle.current) clearTimeout(scrollThrottle.current)
  }, [])

  const maybeLoadNext = useCallback(() => {
    if (!viz?.viz_id || loading || !hasMore || !windowSize || nextStart === null) return
    const el = scrollRef.current
    if (!el) return
    const nearRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 80
    if (nearRight) {
      loadWindow(nextStart, nextStart + windowSize)
    }
  }, [viz, loading, hasMore, windowSize, nextStart, loadWindow])

  const handleScroll = () => {
    if (scrollThrottle.current) return
    scrollThrottle.current = setTimeout(() => {
      scrollThrottle.current = null
      maybeLoadNext()
    }, 180)
  }

  const chartWidth = useMemo(() => {
    const primaryLength = seriesData[0]?.length || 1
    return Math.max(1200, primaryLength * 6)
  }, [seriesData])

  const progress = useMemo(() => {
    if (!totalRows || totalRows <= 0) return null
    return Math.min(100, (rowsLoaded / totalRows) * 100)
  }, [rowsLoaded, totalRows])

  if (!viz?.viz_id || !viz?.series?.length) {
    return <div className="empty-state">Select a visualization to stream tiles.</div>
  }

  return (
    <div className="project-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="actions-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="summary-label" style={{ margin: 0 }}>Data window streaming</p>
          <h4 style={{ margin: '4px 0 0 0' }}>Scroll to load additional tiles</h4>
          <p className="summary-label" style={{ margin: 0 }}>
            Streaming starts automatically and prefetches as you scroll.
          </p>
          {fullRange && (
            <p className="summary-label" style={{ margin: 0 }}>
              Range {fullRange.x_min?.toFixed?.(2) ?? fullRange.x_min} – {fullRange.x_max?.toFixed?.(2) ?? fullRange.x_max}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
          <div className="summary-label" style={{ margin: 0 }}>
            Loaded {rowsLoaded.toLocaleString()} {totalRows ? `of ${totalRows.toLocaleString()}` : ''} points
            {rowsPerSecond ? ` · ~${rowsPerSecond.toLocaleString()} rows/s` : ''}
          </div>
          <div style={{ height: 8, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
            <div
              style={{
                width: `${progress ?? 0}%`,
                background: '#4f46e5',
                height: '100%',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
          {loading && <span className="badge">Loading…</span>}
        </div>
      </div>

      {error && <div className="project-shell__error">{error}</div>}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleScroll}
        style={{
          overflowX: 'auto',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
          padding: 8,
          background: 'white',
        }}
      >
        <div style={{ minWidth: chartWidth }}>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey={viz.x_axis}
                name={viz.x_axis}
                domain={fullRange ? [fullRange.x_min, fullRange.x_max] : ['auto', 'auto']}
              />
              <YAxis type="number" dataKey={yAxis} name={yAxis} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              {viz.series.map((serie, idx) => (
                <Scatter
                  key={`scatter-${idx}`}
                  name={serie.label || serie.y_axis}
                  data={seriesData[idx] || []}
                  dataKey={serie.y_axis}
                  fill={palette[idx % palette.length]}
                  line
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="actions-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="summary-label">
          Window size: {windowSize ? windowSize.toFixed(2) : '-'} · Loaded points: {rowsLoaded.toLocaleString()}
          {totalRows ? ` (${progress?.toFixed?.(1) ?? 0}% of ${totalRows.toLocaleString()})` : ''}
        </span>
        {!hasMore && <span className="summary-label">End of plot reached</span>}
      </div>
    </div>
  )
}

