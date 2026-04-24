import type { Connection } from '@/types'

export const TIME_RANGE_OPTIONS = [
  { labelKey: '5m', value: '5m', ms: 5 * 60 * 1000 },
  { labelKey: '30m', value: '30m', ms: 30 * 60 * 1000 },
  { labelKey: '6h', value: '6h', ms: 6 * 60 * 60 * 1000 },
  { labelKey: '1d', value: '1d', ms: 24 * 60 * 60 * 1000 },
  { labelKey: 'allData', value: 'all', ms: null as number | null },
] as const

export type TimeRangeValue = (typeof TIME_RANGE_OPTIONS)[number]['value']

export const getTimeRangeMs = (value: TimeRangeValue): number | null =>
  TIME_RANGE_OPTIONS.find((o) => o.value === value)?.ms ?? null

export const filterConnectionsByTimeRange = (
  connections: Connection[],
  rangeMs: number | null,
): Connection[] => {
  if (rangeMs === null) return connections
  const cutoff = Date.now() - rangeMs
  return connections.filter((conn) => new Date(conn.start).getTime() >= cutoff)
}

export const getOldestConnectionTime = (connections: Connection[]): number | null => {
  if (connections.length === 0) return null
  let oldest = Infinity
  for (const conn of connections) {
    const t = new Date(conn.start).getTime()
    if (t < oldest) oldest = t
  }
  return oldest === Infinity ? null : oldest
}
