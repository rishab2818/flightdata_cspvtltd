const DEFAULT_CHUNK_SIZE = 256 * 1024
const DEFAULT_COUNT_CHUNK_SIZE = 1024 * 1024
export const DEFAULT_PREVIEW_LINE_LIMIT = 500

const pause = () => new Promise((resolve) => window.setTimeout(resolve, 0))

async function scanLocalTextFile(file, onLine, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE
  const decoder = new TextDecoder('utf-8')
  let carry = ''
  let lineNumber = 0
  let offset = 0

  while (offset < file.size) {
    const buffer = await file.slice(offset, offset + chunkSize).arrayBuffer()
    offset += chunkSize

    const text = decoder.decode(buffer, { stream: offset < file.size })
    const combined = carry + text
    const segments = combined.split(/\r?\n/)
    carry = segments.pop() ?? ''

    for (const line of segments) {
      lineNumber += 1
      const shouldContinue = await onLine(line, lineNumber)
      if (shouldContinue === false) {
        return { complete: false, lineCount: lineNumber }
      }
    }
  }

  const tail = carry + decoder.decode()
  if (tail.length > 0) {
    lineNumber += 1
    const shouldContinue = await onLine(tail, lineNumber)
    if (shouldContinue === false) {
      return { complete: false, lineCount: lineNumber }
    }
  }

  return { complete: true, lineCount: lineNumber }
}

export async function readLocalTextHead(file, options = {}) {
  const maxLines = options.maxLines || DEFAULT_PREVIEW_LINE_LIMIT
  const captured = []

  const result = await scanLocalTextFile(
    file,
    (line, lineNumber) => {
      captured.push({ number: lineNumber, text: line })
      return lineNumber < maxLines + 1
    },
    options
  )

  const visibleLines = captured.slice(0, maxLines)
  return {
    lineItems: visibleLines,
    totalLines: result.complete ? result.lineCount : null,
    truncated: !result.complete || captured.length > maxLines,
  }
}

export async function readLocalTextRange(file, range, options = {}) {
  const start = Math.max(1, Number(range?.start) || 1)
  const end = Math.max(start, Number(range?.end) || start)
  const displayLimit = options.displayLimit || DEFAULT_PREVIEW_LINE_LIMIT
  const visibleEnd = Math.min(end, start + displayLimit - 1)
  const lineItems = []

  const result = await scanLocalTextFile(
    file,
    (line, lineNumber) => {
      if (lineNumber >= start && lineNumber <= visibleEnd) {
        lineItems.push({ number: lineNumber, text: line })
      }
      return lineNumber < visibleEnd
    },
    options
  )

  const totalLines = result.complete ? result.lineCount : null
  const effectiveEnd = totalLines != null ? Math.min(end, totalLines) : end
  const displayEnd = totalLines != null ? Math.min(visibleEnd, totalLines) : visibleEnd

  return {
    lineItems,
    totalLines,
    range: { start, end: effectiveEnd },
    selectionTruncated: effectiveEnd > displayEnd,
  }
}

export async function countLocalTextLines(file, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_COUNT_CHUNK_SIZE
  const shouldCancel = options.shouldCancel
  const yieldEvery = Math.max(1, options.yieldEvery || 8)
  let offset = 0
  let newlineCount = 0
  let lastByte = null
  let sawBytes = false
  let chunkIndex = 0

  while (offset < file.size) {
    if (shouldCancel?.()) {
      return { aborted: true, lineCount: null }
    }

    const nextOffset = Math.min(file.size, offset + chunkSize)
    const buffer = await file.slice(offset, nextOffset).arrayBuffer()
    const bytes = new Uint8Array(buffer)

    if (bytes.length > 0) {
      sawBytes = true
      lastByte = bytes[bytes.length - 1]
    }

    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] === 0x0a) newlineCount += 1
    }

    offset = nextOffset
    chunkIndex += 1

    if (chunkIndex % yieldEvery === 0) {
      await pause()
    }
  }

  if (!sawBytes) {
    return { aborted: false, lineCount: 0 }
  }

  return {
    aborted: false,
    lineCount: newlineCount + (lastByte === 0x0a ? 0 : 1),
  }
}
