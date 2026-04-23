// Shared deterministic color assignment for IP addresses / keys.
// Same key always maps to the same color regardless of render order.

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

const hashCode = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export const getIPColor = (key: string): string => {
  return PALETTE[hashCode(key) % PALETTE.length]
}
