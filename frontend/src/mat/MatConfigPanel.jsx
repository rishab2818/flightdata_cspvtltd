import React from 'react'

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

export default function MatConfigPanel({ meta, config, onChange, loading, error }) {
  if (loading) return <div className="EmptyState">Loading MAT variables…</div>
  if (error) return <div className="EmptyState">{error}</div>
  if (!meta?.length) return <div className="EmptyState">No numeric arrays found in MAT file.</div>

  const activeVar = meta.find((v) => v.name === config?.variable) || meta[0]
  const shape = activeVar?.shape || []

  const axes = Array.isArray(config?.axes) ? config.axes : []
  const fixed = typeof config?.fixed === 'object' && config?.fixed ? config.fixed : {}

  const toggleAxis = (dim) => {
    const next = axes.includes(dim) ? axes.filter((a) => a !== dim) : [...axes, dim]
    if (next.length > 3) return
    onChange({ ...config, variable: activeVar.name, axes: next.sort((a, b) => a - b), fixed })
  }

  const updateFixed = (dim, value) => {
    const max = (shape[dim] || 1) - 1
    const nextFixed = { ...fixed, [dim]: clamp(Number(value || 0), 0, Math.max(max, 0)) }
    onChange({ ...config, variable: activeVar.name, axes, fixed: nextFixed })
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="summaryLabel" style={{ marginBottom: 6 }}>MAT Variable</div>
      <select
        className="input-data"
        value={activeVar.name}
        onChange={(e) => {
          const next = meta.find((v) => v.name === e.target.value)
          if (!next) return
          const nextAxes = [0, 1, 2].filter((i) => i < next.ndims)
          const nextFixed = {}
          for (let i = 0; i < next.ndims; i += 1) {
            if (!nextAxes.includes(i)) nextFixed[i] = 0
          }
          onChange({
            variable: next.name,
            axes: nextAxes,
            fixed: nextFixed,
          })
        }}
      >
        {meta.map((v) => (
          <option key={v.name} value={v.name}>
            {v.name} ({v.shape.join('×')})
          </option>
        ))}
      </select>

      <div className="summaryLabel" style={{ marginTop: 10 }}>Axes / Slices</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shape.map((size, dim) => {
          const isAxis = axes.includes(dim)
          return (
            <div key={`dim-${dim}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={isAxis}
                  onChange={() => toggleAxis(dim)}
                />
                <span className="summaryLabel" style={{ margin: 0 }}>Dim {dim} (size {size})</span>
              </label>
              {!isAxis && (
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, size - 1)}
                  value={fixed?.[dim] ?? 0}
                  onChange={(e) => updateFixed(dim, e.target.value)}
                  style={{ width: 120 }}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="summaryLabel" style={{ marginTop: 8 }}>
        Choose up to 3 axes for plotting; other dims are fixed to a single index.
      </div>
    </div>
  )
}
