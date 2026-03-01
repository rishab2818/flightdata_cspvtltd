const SECTION_CONFIG = [
  { key: 'overview', label: 'Project Overview', path: '', keywords: ['overview', 'project', 'data'] },
  { key: 'visualisation', label: 'Visualize', path: 'visualisation', keywords: ['visualize', 'plot', 'chart', 'mat'] },
  { key: 'meeting', label: 'Minutes Of The Meeting', path: 'meeting', keywords: ['meeting', 'minutes', 'action points'] },
  { key: 'report', label: 'Technical Reports', path: 'report', keywords: ['report', 'technical'] },
  { key: 'digital', label: 'Digital Library', path: 'digital', keywords: ['digital', 'library', 'document'] },
  { key: 'student', label: 'Student Engagement', path: 'student', keywords: ['student', 'engagement'] },
  { key: 'procurement', label: 'Procurement Reports', path: 'procurement', keywords: ['procurement', 'inventory'] },
  { key: 'divisional', label: 'Divisional Records', path: 'divisional', keywords: ['divisional', 'records'] },
  { key: 'feedback', label: 'Customer Feedbacks', path: 'feedback', keywords: ['customer', 'feedback'] },
  { key: 'training', label: 'Training Records', path: 'training', keywords: ['training', 'records'] },
  { key: 'settings', label: 'Settings', path: 'settings', keywords: ['settings', 'configuration'] },
]

const normalize = (value) => String(value || '').trim().toLowerCase()

export const buildSectionResults = (projectId) =>
  SECTION_CONFIG.map((item) => ({
    kind: 'section',
    id: item.key,
    title: item.label,
    subtitle: 'Project Section',
    route: `/app/projects/${projectId}${item.path ? `/${item.path}` : ''}`,
    keywords: item.keywords,
  }))

export const filterSectionResults = (projectId, query) => {
  const rows = buildSectionResults(projectId)
  const safeQuery = normalize(query)
  if (!safeQuery) return rows.slice(0, 6)

  return rows.filter((item) => {
    const title = normalize(item.title)
    if (title.includes(safeQuery)) return true
    return (item.keywords || []).some((keyword) => normalize(keyword).includes(safeQuery))
  })
}
