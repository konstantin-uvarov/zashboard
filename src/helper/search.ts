export const toSearchRegex = (filter: string) => {
  const normalizedFilter = filter.trim()

  if (!normalizedFilter) {
    return null
  }

  try {
    return new RegExp(normalizedFilter, 'i')
  } catch {
    return null
  }
}
