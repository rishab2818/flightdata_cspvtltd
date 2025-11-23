import React, { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'

import { visualizationApi } from '../../../api/visualizationApi'
import StreamingPlot from '../../../components/app/StreamingPlot'

export default function ProjectVisualizationStream() {
  const { projectId, vizId } = useParams()
  const { project } = useOutletContext()
  const navigate = useNavigate()
  const [viz, setViz] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    ;(async () => {
      try {
        const detail = await visualizationApi.detail(vizId)
        if (!mounted) return
        if (detail?.project_id !== projectId) {
          setError('Visualization does not belong to this project')
          setViz(null)
        } else {
          setViz(detail)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err?.response?.data?.detail || err.message)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [vizId, projectId])

  return (
    <div className="project-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="actions-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <p className="summary-label" style={{ margin: 0 }}>
            Data window streaming
          </p>
          <h2 style={{ margin: '4px 0 0 0' }}>{project?.project_name || 'Project'} stream</h2>
          <p className="summary-label" style={{ margin: 0 }}>
            This view opens in a separate tab to avoid extra load on the workspace page.
          </p>
        </div>
        <button className="project-shell__nav-link" type="button" onClick={() => navigate(-1)}>
          Back to visualisations
        </button>
      </div>

      {loading && <div className="project-shell__loading">Loading visualization…</div>}
      {error && <div className="project-shell__error">{error}</div>}

      {!loading && !error && !viz && (
        <div className="empty-state">Visualization not found for this project.</div>
      )}

      {viz && <StreamingPlot viz={viz} autoStart />}
    </div>
  )
}
