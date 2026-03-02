import { useCallback, useEffect, useMemo, useState } from 'react'

import { matPlotApi } from '../api/matPlotApi'

const parseError = (err, fallback) => err?.response?.data?.detail || err?.message || fallback

export function useMatVariables(jobId) {
  const [variables, setVariables] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const safeJobId = String(jobId || '').trim()
    if (!safeJobId) {
      setVariables([])
      setError('')
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await matPlotApi.listVariables(safeJobId)
      setVariables(Array.isArray(response?.variables) ? response.variables : [])
    } catch (err) {
      setVariables([])
      setError(parseError(err, 'Failed to load MAT variables'))
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const numericVariables = useMemo(
    () => variables.filter((item) => item?.kind === 'numeric_array'),
    [variables]
  )

  return {
    variables,
    numericVariables,
    loading,
    error,
    refresh,
  }
}
