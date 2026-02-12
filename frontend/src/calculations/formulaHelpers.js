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

