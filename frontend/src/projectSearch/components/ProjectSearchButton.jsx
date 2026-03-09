import React, { useEffect, useState } from 'react'
import { FiSearch } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'

import { useProjectSearch } from '../hooks/useProjectSearch'
import ProjectSearchPanel from './ProjectSearchPanel'

import '../styles/projectSearch.css'

export default function ProjectSearchButton({ projectId }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { results, loading, error, isRemoteEnabled } = useProjectSearch({
    projectId,
    query,
    enabled: open,
    limit: 30,
  })

  useEffect(() => {
    const onKeyDown = (event) => {
      const isK = event.key?.toLowerCase() === 'k'
      if (!isK) return
      if (!(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const handleSelectResult = (item) => {
    const route = String(item?.route || '').trim()
    if (!route) return
    close()
    navigate(route)
  }

  return (
    <>
      <button
        type="button"
        className="project-search__trigger"
        onClick={() => setOpen(true)}
      >
        <FiSearch size={14} />
        Search
      </button>

      <ProjectSearchPanel
        open={open}
        query={query}
        onQueryChange={setQuery}
        onClose={close}
        onSelectResult={handleSelectResult}
        results={results}
        loading={loading}
        error={error}
        isRemoteEnabled={isRemoteEnabled}
      />
    </>
  )
}
