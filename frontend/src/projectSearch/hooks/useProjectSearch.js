import { useEffect, useMemo, useRef, useState } from 'react'

import { projectSearchApi } from '../api/projectSearchApi'
import { filterSectionResults } from '../utils/sectionResults'

const SEARCH_DEBOUNCE_MS = 220
const MIN_REMOTE_QUERY_LEN = 2

export function useProjectSearch({
  projectId,
  query,
  enabled = true,
  limit = 25,
}) {
  const [remoteResults, setRemoteResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const cacheRef = useRef(new Map())
  const requestSeqRef = useRef(0)

  const safeProjectId = String(projectId || '').trim()
  const safeQuery = String(query || '').trim()
  const normalized = safeQuery.toLowerCase()

  const sectionResults = useMemo(
    () => (safeProjectId ? filterSectionResults(safeProjectId, safeQuery) : []),
    [safeProjectId, safeQuery]
  )

  useEffect(() => {
    if (!enabled || !safeProjectId) {
      setRemoteResults([])
      setError('')
      setLoading(false)
      return
    }

    if (normalized.length < MIN_REMOTE_QUERY_LEN) {
      setRemoteResults([])
      setError('')
      setLoading(false)
      return
    }

    const cacheKey = `${safeProjectId}:${normalized}:${limit}`
    const cached = cacheRef.current.get(cacheKey)
    if (Array.isArray(cached)) {
      setRemoteResults(cached)
      setError('')
      setLoading(false)
      return
    }

    const seq = requestSeqRef.current + 1
    requestSeqRef.current = seq
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const rows = await projectSearchApi.search(safeProjectId, safeQuery, limit)
        if (requestSeqRef.current !== seq) return
        cacheRef.current.set(cacheKey, rows)
        setRemoteResults(rows)
      } catch (err) {
        if (requestSeqRef.current !== seq) return
        setRemoteResults([])
        setError(err?.response?.data?.detail || err?.message || 'Search failed')
      } finally {
        if (requestSeqRef.current === seq) {
          setLoading(false)
        }
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [enabled, limit, normalized, safeProjectId, safeQuery])

  const results = useMemo(() => {
    const merged = [...sectionResults, ...remoteResults]
    const deduped = []
    const seen = new Set()

    for (const item of merged) {
      const key = `${item?.kind || 'item'}:${item?.id || item?.route || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(item)
      if (deduped.length >= limit) break
    }
    return deduped
  }, [limit, remoteResults, sectionResults])

  return {
    results,
    loading,
    error,
    isRemoteEnabled: normalized.length >= MIN_REMOTE_QUERY_LEN,
  }
}
