const normalizeShape = (shape) => {
  if (!Array.isArray(shape)) return []
  return shape
    .map((dim) => Number(dim))
    .filter((dim) => Number.isFinite(dim) && dim >= 0)
    .map((dim) => Math.trunc(dim))
}

const isVectorShape = (shape) => {
  const dims = normalizeShape(shape)
  if (dims.length === 1) return true
  if (dims.length === 2 && (dims[0] === 1 || dims[1] === 1)) return true
  return false
}

const vectorLength = (shape) => {
  const dims = normalizeShape(shape)
  if (!dims.length) return 0
  if (dims.length === 1) return dims[0]
  if (dims.length === 2 && (dims[0] === 1 || dims[1] === 1)) return Math.max(dims[0], dims[1])
  return -1
}

const isMatrixShape = (shape) => {
  const dims = normalizeShape(shape)
  return dims.length === 2
}

const matrixRows = (shape) => normalizeShape(shape)[0] || 0
const matrixCols = (shape) => normalizeShape(shape)[1] || 0

export const shapeText = (shape) => {
  const dims = normalizeShape(shape)
  if (!dims.length) return '-'
  if (dims.length === 1) return `${dims[0]}×1`
  return dims.join('×')
}

export const extractResultShape = (preview) => {
  if (!preview) return []
  if (Array.isArray(preview?.result_shape) && preview.result_shape.length) {
    return normalizeShape(preview.result_shape)
  }
  return normalizeShape(preview?.shape)
}

export const validateMatlabLikeRequest = ({
  mode,
  chartType,
  xPreview,
  yPreview,
  zPreview,
}) => {
  const safeMode = String(mode || '').trim().toLowerCase()
  const safeChart = String(chartType || '').trim().toLowerCase()

  const xShape = extractResultShape(xPreview)
  const yShape = extractResultShape(yPreview)
  const zShape = extractResultShape(zPreview)

  if (safeMode === 'plot_y') {
    if (!['line', 'scatter'].includes(safeChart)) {
      return 'Plot(Y) supports Line or Scatter chart type.'
    }
    if (!yShape.length) return 'Select Y variable and valid slice.'
    if (!isVectorShape(yShape) && !isMatrixShape(yShape)) {
      return 'MATLAB Plot(Y) expects Y to be a vector or a 2-D matrix after slicing.'
    }
    if (yShape.length > 2) {
      return 'MATLAB Plot(Y) does not accept arrays with more than 2 dimensions.'
    }
    return ''
  }

  if (safeMode === 'plot_xy') {
    if (!['line', 'scatter'].includes(safeChart)) {
      return 'Plot(X,Y) supports Line or Scatter chart type.'
    }
    if (!xShape.length || !yShape.length) return 'Select X and Y variables with valid slices.'
    const xIsVector = isVectorShape(xShape)
    const yIsVector = isVectorShape(yShape)
    const xIsMatrix = isMatrixShape(xShape)
    const yIsMatrix = isMatrixShape(yShape)

    if (xIsVector) {
      const xLen = vectorLength(xShape)
      if (xLen <= 0) return 'MATLAB Plot(X,Y) requires non-empty X vector.'

      if (yIsVector) {
        const yLen = vectorLength(yShape)
        if (yLen !== xLen) {
          return `Incompatible Plot(X,Y): length(X)=${xLen}, length(Y)=${yLen}.`
        }
        return ''
      }

      if (!yIsMatrix) {
        return 'MATLAB Plot(X,Y) expects Y to be a vector or 2-D matrix.'
      }

      const rows = matrixRows(yShape)
      const cols = matrixCols(yShape)
      if (rows === xLen) return ''
      if (cols === xLen) {
        return (
          `Incompatible Plot(X,Y): length(X)=${xLen} matches size(Y,2)=${cols}. ` +
          'MATLAB expects length(X)=size(Y,1). Transpose Y or change slice.'
        )
      }
      return (
        `Incompatible Plot(X,Y): length(X)=${xLen} must equal length(Y) or size(Y,1)=${rows}.`
      )
    }

    if (xIsMatrix) {
      if (!yIsMatrix) {
        return 'MATLAB Plot(X,Y): when X is a matrix, Y must also be a 2-D matrix of the same size.'
      }
      const xRows = matrixRows(xShape)
      const xCols = matrixCols(xShape)
      const yRows = matrixRows(yShape)
      const yCols = matrixCols(yShape)
      if (xRows === yRows && xCols === yCols) return ''
      return (
        `Incompatible Plot(X,Y): matrix sizes must match (X=${shapeText(xShape)}, Y=${shapeText(yShape)}).`
      )
    }

    return 'MATLAB Plot(X,Y) expects X to be a vector or 2-D matrix.'
  }

  if (safeMode === 'plot3') {
    if (!['line3d', 'scatter3d'].includes(safeChart)) {
      return 'Plot3(X,Y,Z) supports Line3D or Scatter3D chart type.'
    }
    if (!xShape.length || !yShape.length || !zShape.length) {
      return 'Select X, Y, Z variables with valid slices.'
    }

    const allVector = isVectorShape(xShape) && isVectorShape(yShape) && isVectorShape(zShape)
    const allMatrix = isMatrixShape(xShape) && isMatrixShape(yShape) && isMatrixShape(zShape)

    if (allVector) {
      const xl = vectorLength(xShape)
      const yl = vectorLength(yShape)
      const zl = vectorLength(zShape)
      if (xl === yl && yl === zl) return ''
      return `Incompatible Plot3: vector lengths must match (X=${xl}, Y=${yl}, Z=${zl}).`
    }

    if (allMatrix) {
      const xText = shapeText(xShape)
      const yText = shapeText(yShape)
      const zText = shapeText(zShape)
      if (xText === yText && yText === zText) return ''
      return `Incompatible Plot3: matrix sizes must match (X=${xText}, Y=${yText}, Z=${zText}).`
    }

    return 'Incompatible Plot3: use vectors of same length or matrices of same size.'
  }

  return 'Choose a valid MATLAB plot signature.'
}
