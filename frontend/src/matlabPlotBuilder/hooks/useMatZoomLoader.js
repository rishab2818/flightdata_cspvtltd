import { useEffect, useRef, useState } from 'react'

export function useMatZoomLoader({
  iframeRef,
  enabled,
  onZoomUpdate,
  debounceMs = 260,
  minLoaderMs = 120,
  showDelayMs = 140,
}) {
  const [isLoading, setIsLoading] = useState(false)
  const debounceTimerRef = useRef(null)
  const settleTimerRef = useRef(null)
  const showTimerRef = useRef(null)

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return undefined
    }

    const iframeEl = iframeRef?.current
    if (!iframeEl) return undefined

    let cancelled = false
    let pollTimer = null
    let detachGraphHandlers = null

    const clearTimers = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current)
        showTimerRef.current = null
      }
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current)
        settleTimerRef.current = null
      }
      if (pollTimer) {
        clearTimeout(pollTimer)
        pollTimer = null
      }
    }

    const scheduleUpdate = (eventPayload) => {
      if (cancelled) return

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(async () => {
        let loaderVisible = false
        if (showTimerRef.current) {
          clearTimeout(showTimerRef.current)
        }
        showTimerRef.current = setTimeout(() => {
          if (cancelled) return
          loaderVisible = true
          setIsLoading(true)
        }, Math.max(0, showDelayMs))

        try {
          if (typeof onZoomUpdate === 'function') {
            await onZoomUpdate(eventPayload)
          }
        } finally {
          if (showTimerRef.current) {
            clearTimeout(showTimerRef.current)
            showTimerRef.current = null
          }
          if (settleTimerRef.current) {
            clearTimeout(settleTimerRef.current)
          }
          if (loaderVisible) {
            settleTimerRef.current = setTimeout(() => {
              if (!cancelled) setIsLoading(false)
            }, Math.max(0, minLoaderMs))
          } else if (!cancelled) {
            setIsLoading(false)
          }
        }
      }, Math.max(120, debounceMs))
    }

    const tryAttachPlotlyHandlers = () => {
      const frameDoc = iframeEl.contentDocument || iframeEl.contentWindow?.document
      if (!frameDoc) return false

      const graphDiv = frameDoc.querySelector('.plotly-graph-div')
      if (!graphDiv || typeof graphDiv.on !== 'function') return false

      if (typeof graphDiv.__matZoomDetach === 'function') {
        graphDiv.__matZoomDetach()
      }

      const relayoutHandler = (eventPayload) => {
        scheduleUpdate(eventPayload)
      }
      const doubleClickHandler = () => {
        scheduleUpdate({ reset: true })
      }

      graphDiv.on('plotly_relayout', relayoutHandler)
      graphDiv.on('plotly_doubleclick', doubleClickHandler)

      const detach = () => {
        if (typeof graphDiv.removeListener === 'function') {
          graphDiv.removeListener('plotly_relayout', relayoutHandler)
          graphDiv.removeListener('plotly_doubleclick', doubleClickHandler)
        }
      }
      graphDiv.__matZoomDetach = detach
      detachGraphHandlers = detach
      return true
    }

    const bindWithRetry = () => {
      if (cancelled) return
      const attached = tryAttachPlotlyHandlers()
      if (!attached) {
        pollTimer = setTimeout(bindWithRetry, 140)
      }
    }

    const handleLoad = () => {
      bindWithRetry()
    }

    iframeEl.addEventListener('load', handleLoad)
    bindWithRetry()

    return () => {
      cancelled = true
      iframeEl.removeEventListener('load', handleLoad)
      if (typeof detachGraphHandlers === 'function') {
        detachGraphHandlers()
      }
      clearTimers()
      setIsLoading(false)
    }
  }, [debounceMs, enabled, iframeRef, minLoaderMs, onZoomUpdate, showDelayMs])

  return {
    isLoading,
  }
}
