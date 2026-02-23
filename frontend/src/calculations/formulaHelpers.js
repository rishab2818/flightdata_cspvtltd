export const flattenFormulaTemplates = (catalog = []) => {
  const map = {}
  for (const category of catalog || []) {
    for (const template of category?.templates || []) {
      map[template.key] = {
        ...template,
        category_key: category.key,
        category_label: category.label,
      }
    }
  }
  return map
}

export const getFormulaTokenPrefix = (formula = '', cursor = 0) => {
  const safeCursor = Math.max(0, Math.min(cursor, formula.length))
  const beforeCursor = formula.slice(0, safeCursor)
  const match = beforeCursor.match(/([A-Za-z_][A-Za-z0-9_]*)$/)
  if (!match) return null
  const token = match[1]
  return {
    token,
    start: safeCursor - token.length,
    end: safeCursor,
  }
}

export const applyFunctionSuggestion = (formula = '', cursor = 0, functionName = '') => {
  const safeName = String(functionName || '').trim()
  if (!safeName) {
    return { formula, cursor }
  }
  const prefix = getFormulaTokenPrefix(formula, cursor)
  const start = prefix ? prefix.start : cursor
  const end = prefix ? prefix.end : cursor
  const insertion = `${safeName}()`
  const nextFormula = `${formula.slice(0, start)}${insertion}${formula.slice(end)}`
  const nextCursor = start + safeName.length + 1
  return { formula: nextFormula, cursor: nextCursor }
}

export const tokenizeFormula = (formula = '', functionNames = [], variableNames = []) => {
  const fnSet = new Set((functionNames || []).map((n) => String(n || '').trim()).filter(Boolean))
  const variableSet = new Set((variableNames || []).map((n) => String(n || '').trim()).filter(Boolean))
  const tokenRe = /([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[()+\-*/%^,<>!=&|]+)/g
  const out = []
  let lastIndex = 0
  let match = tokenRe.exec(formula)
  while (match) {
    const [token] = match
    const start = match.index
    if (start > lastIndex) {
      out.push({ token: formula.slice(lastIndex, start), kind: 'plain' })
    }
    let kind = 'plain'
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
      if (fnSet.has(token)) kind = 'function'
      else if (variableSet.has(token)) kind = 'variable'
      else kind = 'identifier'
    } else if (/^\d/.test(token)) {
      kind = 'number'
    } else if (/^[()]+$/.test(token)) {
      kind = 'paren'
    } else if (/^[+\-*/%^,<>!=&|]+$/.test(token)) {
      kind = 'operator'
    }
    out.push({ token, kind })
    lastIndex = start + token.length
    match = tokenRe.exec(formula)
  }
  if (lastIndex < formula.length) {
    out.push({ token: formula.slice(lastIndex), kind: 'plain' })
  }
  return out
}
