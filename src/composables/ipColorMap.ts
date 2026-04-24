// Shared sequential color assignment for IP addresses / keys.
// Colors are assigned on first appearance and persisted to localStorage
// so they remain stable across page refreshes.

export const PALETTE = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc',
  '#45b7d1',
  '#96ceb4',
  '#ffad60',
  '#ff6b6b',
  '#c3a6ff',
  '#a8e063',
  '#56ccf2',
]

const STORAGE_KEY = 'ip-color-assignments'

const loadFromStorage = (): Map<string, string> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return new Map(JSON.parse(saved) as [string, string][])
  } catch {
    // ignore
  }
  return new Map()
}

const colorMap = loadFromStorage()
let nextIdx = colorMap.size

const saveToStorage = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...colorMap.entries()]))
  } catch {
    // ignore
  }
}

export const getIPColor = (key: string): string => {
  if (!colorMap.has(key)) {
    colorMap.set(key, PALETTE[nextIdx % PALETTE.length])
    nextIdx++
    saveToStorage()
  }
  return colorMap.get(key)!
}
