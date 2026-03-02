export const normalizeSliceExpr = (value) => String(value || '').trim()

export const displaySliceExpr = (value) => {
  const normalized = normalizeSliceExpr(value)
  return normalized || ':'
}

export const formatVariableSliceText = (variableName, sliceExpr) => {
  const varName = String(variableName || '').trim()
  if (!varName) return ''
  return `${varName}(${displaySliceExpr(sliceExpr)})`
}
