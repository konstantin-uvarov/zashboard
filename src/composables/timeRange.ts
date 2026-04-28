import type { Connection } from '@/types'

export const TIME_RANGE_OPTIONS = [
  { labelKey: 'Session', value: 'session', ms: null as number | null },
  { labelKey: '5m', value: '5m', ms: 5 * 60 * 1000 },
  { labelKey: '30m', value: '30m', ms: 30 * 60 * 1000 },
  { labelKey: '6h', value: '6h', ms: 6 * 60 * 60 * 1000 },
  { labelKey: '1d', value: '1d', ms: 24 * 60 * 60 * 1000 },
  { labelKey: '7d', value: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { labelKey: '15d', value: '15d', ms: 15 * 24 * 60 * 60 * 1000 },
  { labelKey: '1m', value: '1m', ms: 30 * 24 * 60 * 60 * 1000 },
  { labelKey: '3m', value: '3m', ms: 90 * 24 * 60 * 60 * 1000 },
  { labelKey: '6m', value: '6m', ms: 180 * 24 * 60 * 60 * 1000 },
  { labelKey: '1y', value: '1y', ms: 365 * 24 * 60 * 60 * 1000 },
  { labelKey: 'allData', value: 'all', ms: null as number | null },
] as const

export type TimeRangeValue = (typeof TIME_RANGE_OPTIONS)[number]['value']

const BUCKET_RANGE_VALUES = new Set<string>(['7d', '15d', '1m', '3m', '6m', '1y'])

export const isBucketRange = (value: TimeRangeValue): boolean => BUCKET_RANGE_VALUES.has(value)

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
