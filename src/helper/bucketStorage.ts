import type { ConnectionHistoryData, TopoFlowData } from './indexeddb'
import { ConnectionHistoryType } from './indexeddb'

const CONN_BUCKET_DB = 'connection-history-buckets'
const TOPO_BUCKET_DB = 'topo-flows-buckets'

const openDB = (name: string): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(name)) {
        req.result.createObjectStore(name, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const connBucketDB = openDB(CONN_BUCKET_DB)
const topoBucketDB = openDB(TOPO_BUCKET_DB)

const execTx = <T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const req = op(db.transaction(storeName, mode).objectStore(storeName))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const dbGet = async <T>(
  db: IDBDatabase,
  storeName: string,
  key: string,
): Promise<T | undefined> => {
  const row = await execTx<{ key: string; value: string } | undefined>(
    db,
    storeName,
    'readonly',
    (s) => s.get(key),
  )
  if (!row) return undefined
  try {
    return JSON.parse(row.value) as T
  } catch {
    return undefined
  }
}

const dbPut = (
  db: IDBDatabase,
  storeName: string,
  key: string,
  value: unknown,
): Promise<IDBValidKey> =>
  execTx(db, storeName, 'readwrite', (s) => s.put({ key, value: JSON.stringify(value) }))

const dbGetAllKeys = (db: IDBDatabase, storeName: string): Promise<string[]> =>
  execTx<IDBValidKey[]>(db, storeName, 'readonly', (s) => s.getAllKeys()).then((k) => k as string[])

const dbDelete = (db: IDBDatabase, storeName: string, key: string): Promise<undefined> =>
  execTx(db, storeName, 'readwrite', (s) => s.delete(key))

const dbClear = (db: IDBDatabase, storeName: string): Promise<undefined> =>
  execTx(db, storeName, 'readwrite', (s) => s.clear())

export const dateKey = (ms: number): string => {
  const d = new Date(ms)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

// Returns all YYYY-MM-DD strings from the day containing fromMs to the day containing toMs.
const enumerateDates = (fromMs: number, toMs: number): string[] => {
  const dates: string[] = []
  const cur = new Date(fromMs)
  cur.setHours(0, 0, 0, 0)
  while (cur.getTime() <= toMs) {
    dates.push(dateKey(cur.getTime()))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

const mergeConnData = (
  a: ConnectionHistoryData[],
  b: ConnectionHistoryData[],
): ConnectionHistoryData[] => {
  const map = new Map<string, ConnectionHistoryData>()
  for (const item of a) map.set(item.key, { ...item })
  for (const item of b) {
    const e = map.get(item.key)
    if (e) {
      e.download += item.download
      e.upload += item.upload
      e.count += item.count
    } else {
      map.set(item.key, { ...item })
    }
  }
  return Array.from(map.values())
}

const mergeTopoData = (a: TopoFlowData[], b: TopoFlowData[]): TopoFlowData[] => {
  const toKey = (f: TopoFlowData) =>
    `${f.sourceIP}|||${f.ruleKey}|||${f.chainLast}|||${f.chainFirst}`
  const map = new Map<string, TopoFlowData>()
  for (const item of a) map.set(toKey(item), { ...item })
  for (const item of b) {
    const k = toKey(item)
    const e = map.get(k)
    if (e) {
      e.count += item.count
      e.download += item.download
      e.upload += item.upload
    } else {
      map.set(k, { ...item })
    }
  }
  return Array.from(map.values())
}

// ── Connection history buckets ──────────────────────────────────────────────

export const writeDailyBucket = async (
  uuid: string,
  type: ConnectionHistoryType,
  newData: ConnectionHistoryData[],
): Promise<void> => {
  if (!uuid || newData.length === 0) return
  const db = await connBucketDB
  const key = `${uuid}-${type}-${dateKey(Date.now())}`
  const existing = (await dbGet<ConnectionHistoryData[]>(db, CONN_BUCKET_DB, key)) ?? []
  await dbPut(db, CONN_BUCKET_DB, key, mergeConnData(existing, newData))
}

export const readBuckets = async (
  uuid: string,
  type: ConnectionHistoryType,
  fromMs: number,
  toMs: number,
): Promise<ConnectionHistoryData[]> => {
  const db = await connBucketDB
  let result: ConnectionHistoryData[] = []
  for (const date of enumerateDates(fromMs, toMs)) {
    const data = await dbGet<ConnectionHistoryData[]>(db, CONN_BUCKET_DB, `${uuid}-${type}-${date}`)
    if (data) result = mergeConnData(result, data)
  }
  return result
}

let lastConnPruneDate = ''

export const pruneOldBuckets = async (uuid: string, retentionDays: number): Promise<void> => {
  const today = dateKey(Date.now())
  if (lastConnPruneDate === today) return
  lastConnPruneDate = today

  const db = await connBucketDB
  // Date is always the last 10 chars of the key (YYYY-MM-DD).
  const cutoff = dateKey(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const prefix = `${uuid}-`
  for (const key of await dbGetAllKeys(db, CONN_BUCKET_DB)) {
    if (!key.startsWith(prefix)) continue
    const datePart = key.slice(-10)
    if (datePart < cutoff) await dbDelete(db, CONN_BUCKET_DB, key)
  }
}

export const clearAllConnBuckets = async (): Promise<void> => {
  const db = await connBucketDB
  await dbClear(db, CONN_BUCKET_DB)
}

// ── Topology flow buckets ───────────────────────────────────────────────────

export const writeDailyTopoBucket = async (
  uuid: string,
  newData: TopoFlowData[],
): Promise<void> => {
  if (!uuid || newData.length === 0) return
  const db = await topoBucketDB
  const key = `${uuid}-topo-${dateKey(Date.now())}`
  const existing = (await dbGet<TopoFlowData[]>(db, TOPO_BUCKET_DB, key)) ?? []
  await dbPut(db, TOPO_BUCKET_DB, key, mergeTopoData(existing, newData))
}

export const readTopoBuckets = async (
  uuid: string,
  fromMs: number,
  toMs: number,
): Promise<TopoFlowData[]> => {
  const db = await topoBucketDB
  let result: TopoFlowData[] = []
  for (const date of enumerateDates(fromMs, toMs)) {
    const data = await dbGet<TopoFlowData[]>(db, TOPO_BUCKET_DB, `${uuid}-topo-${date}`)
    if (data) result = mergeTopoData(result, data)
  }
  return result
}

let lastTopoPruneDate = ''

export const pruneOldTopoBuckets = async (uuid: string, retentionDays: number): Promise<void> => {
  const today = dateKey(Date.now())
  if (lastTopoPruneDate === today) return
  lastTopoPruneDate = today

  const db = await topoBucketDB
  const cutoff = dateKey(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const prefix = `${uuid}-`
  for (const key of await dbGetAllKeys(db, TOPO_BUCKET_DB)) {
    if (!key.startsWith(prefix)) continue
    const datePart = key.slice(-10)
    if (datePart < cutoff) await dbDelete(db, TOPO_BUCKET_DB, key)
  }
}

export const clearAllTopoBuckets = async (): Promise<void> => {
  const db = await topoBucketDB
  await dbClear(db, TOPO_BUCKET_DB)
}

// Re-export types so chart components can import from one place.
export { ConnectionHistoryType }
export type { ConnectionHistoryData, TopoFlowData }
