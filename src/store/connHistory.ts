import { getProcessFromConnection } from '@/helper'
import {
  pruneOldBuckets,
  pruneOldTopoBuckets,
  writeDailyBucket,
  writeDailyTopoBucket,
} from '@/helper/bucketStorage'
import {
  ConnectionHistoryType,
  getConnectionHistoryFromIndexedDB,
  getConnectionHistoryStartTime,
  getTopoFlowsFromIndexedDB,
  getTopoStartTime,
  saveConnectionHistoryStartTime,
  saveConnectionHistoryToIndexedDB,
  saveTopoFlowsToIndexedDB,
  saveTopoStartTime,
  type ConnectionHistoryData,
  type TopoFlowData,
} from '@/helper/indexeddb'
import type { Connection } from '@/types'
import ipaddr from 'ipaddr.js'
import { ref } from 'vue'
import { activeBackend } from './setup'

const isInitializedPromise = ref(
  new Promise((resolve) => {
    resolve(false)
  }),
)
const uuid = () => activeBackend.value?.uuid || ''

export const getActiveUuid = () => uuid()

const getRetentionDays = (): number => {
  const val = localStorage.getItem('config/connection-history-auto-cleanup-interval')
  switch (val) {
    case 'week':
      return 7
    case 'month':
      return 30
    case 'quarter':
      return 90
    default:
      return 365
  }
}
const allHistoryTypes = [
  ConnectionHistoryType.SourceIP,
  ConnectionHistoryType.Destination,
  ConnectionHistoryType.Process,
  ConnectionHistoryType.Outbound,
]

export const historyStartTime = ref<number | null>(null)
export const topoHistoryStartTime = ref<number | null>(null)

export const aggregatedDataMap = ref<Record<ConnectionHistoryType, ConnectionHistoryData[]>>({
  [ConnectionHistoryType.SourceIP]: [],
  [ConnectionHistoryType.Destination]: [],
  [ConnectionHistoryType.Process]: [],
  [ConnectionHistoryType.Outbound]: [],
})

export const topoFlowsData = ref<TopoFlowData[]>([])

export const initAggregatedDataMap = () => {
  aggregatedDataMap.value = {
    [ConnectionHistoryType.SourceIP]: [],
    [ConnectionHistoryType.Destination]: [],
    [ConnectionHistoryType.Process]: [],
    [ConnectionHistoryType.Outbound]: [],
  }
  isInitializedPromise.value = new Promise(async (resolve) => {
    let hasData = false
    for (const type of allHistoryTypes) {
      const historicalData = await getConnectionHistoryFromIndexedDB(uuid(), type)

      let finalData = historicalData
      if (historicalData.length > 2000) {
        finalData = historicalData.sort((a, b) => b.download - a.download).slice(0, 1500)
        await saveConnectionHistoryToIndexedDB(uuid(), type, finalData)
      }

      aggregatedDataMap.value[type] = finalData
      if (finalData.length > 0) hasData = true
    }

    const storedStartTime = await getConnectionHistoryStartTime(uuid())
    if (!hasData) {
      const now = Date.now()
      historyStartTime.value = now
      await saveConnectionHistoryStartTime(uuid(), now)
    } else if (storedStartTime !== null) {
      historyStartTime.value = storedStartTime
    } else {
      historyStartTime.value = null // legacy data — start time not recorded
    }

    resolve(true)
  })
}

export const initTopoFlowsData = async () => {
  topoFlowsData.value = []
  const flows = await getTopoFlowsFromIndexedDB(uuid())
  topoFlowsData.value = flows

  const storedStartTime = await getTopoStartTime(uuid())
  if (flows.length === 0) {
    const now = Date.now()
    topoHistoryStartTime.value = now
    await saveTopoStartTime(uuid(), now)
  } else if (storedStartTime !== null) {
    topoHistoryStartTime.value = storedStartTime
  } else {
    topoHistoryStartTime.value = null // legacy data — start time not recorded
  }
}

export const aggregateTopoFlows = (connections: Connection[]): TopoFlowData[] => {
  const map = new Map<string, TopoFlowData>()
  connections.forEach((conn) => {
    const chains = conn.chains || []
    if (chains.length === 0) return
    const sourceIP = conn.metadata.sourceIP
    const ruleKey = conn.rulePayload ? `${conn.rule}: ${conn.rulePayload}` : conn.rule
    const chainLast = chains[chains.length - 1]
    const chainFirst = chains[0]
    const key = `${sourceIP}|||${ruleKey}|||${chainLast}|||${chainFirst}`
    if (map.has(key)) {
      const existing = map.get(key)!
      existing.count++
      existing.download += conn.download
      existing.upload += conn.upload
    } else {
      map.set(key, {
        sourceIP,
        ruleKey,
        chainLast,
        chainFirst,
        count: 1,
        download: conn.download,
        upload: conn.upload,
      })
    }
  })
  return Array.from(map.values())
}

export const mergeTopoFlows = (
  historical: TopoFlowData[],
  newFlows: TopoFlowData[],
): TopoFlowData[] => {
  const map = new Map<string, TopoFlowData>()
  historical.forEach((item) => {
    const key = `${item.sourceIP}|||${item.ruleKey}|||${item.chainLast}|||${item.chainFirst}`
    map.set(key, { ...item })
  })
  newFlows.forEach((item) => {
    const key = `${item.sourceIP}|||${item.ruleKey}|||${item.chainLast}|||${item.chainFirst}`
    if (map.has(key)) {
      const existing = map.get(key)!
      existing.count += item.count
      existing.download += item.download
      existing.upload += item.upload
    } else {
      map.set(key, { ...item })
    }
  })
  return Array.from(map.values())
}

export const aggregateConnections = (
  connections: Connection[],
  type: ConnectionHistoryType,
): ConnectionHistoryData[] => {
  const map = new Map<string, ConnectionHistoryData>()

  connections.forEach((connection) => {
    let key: string = ''

    if (type === ConnectionHistoryType.SourceIP) {
      key = connection.metadata.sourceIP
    } else if (type === ConnectionHistoryType.Destination) {
      const hostkey =
        connection.metadata.host ||
        connection.metadata.sniffHost ||
        connection.metadata.destinationIP
      if (ipaddr.IPv4.isValid(hostkey) || ipaddr.IPv6.isValid(hostkey)) {
        key = hostkey
      } else {
        key = hostkey.split('.').slice(-2).join('.')
      }
    } else if (type === ConnectionHistoryType.Process) {
      key = getProcessFromConnection(connection)
    } else if (type === ConnectionHistoryType.Outbound) {
      key = connection.chains[0] || '-'
    }

    if (map.has(key)) {
      const existing = map.get(key)!
      existing.download += connection.download
      existing.upload += connection.upload
      existing.count += 1
    } else {
      map.set(key, {
        key,
        download: connection.download,
        upload: connection.upload,
        count: 1,
      })
    }
  })

  return Array.from(map.values())
}

export const mergeAggregatedData = (
  historical: ConnectionHistoryData[],
  newData: ConnectionHistoryData[],
): ConnectionHistoryData[] => {
  const map = new Map<string, ConnectionHistoryData>()

  historical.forEach((item) => {
    map.set(item.key, { ...item })
  })

  newData.forEach((item) => {
    if (map.has(item.key)) {
      const existing = map.get(item.key)!
      existing.download += item.download
      existing.upload += item.upload
      existing.count += item.count
    } else {
      map.set(item.key, { ...item })
    }
  })

  return Array.from(map.values())
}

export const saveConnectionHistory = async (newClosedConnections: Connection[]) => {
  if (newClosedConnections.length === 0) {
    return
  }

  await isInitializedPromise.value

  for (const type of allHistoryTypes) {
    try {
      const newAggregatedData = aggregateConnections(newClosedConnections, type)
      const historicalData = aggregatedDataMap.value[type]
      const mergedData = mergeAggregatedData(historicalData, newAggregatedData)

      aggregatedDataMap.value[type] = mergedData
      await saveConnectionHistoryToIndexedDB(uuid(), type, mergedData)
      await writeDailyBucket(uuid(), type, newAggregatedData)
    } catch (error) {
      console.error(`Failed to save connection history for ${type}:`, error)
    }
  }

  try {
    const newFlows = aggregateTopoFlows(newClosedConnections)
    const merged = mergeTopoFlows(topoFlowsData.value, newFlows)
    topoFlowsData.value = merged
    await saveTopoFlowsToIndexedDB(uuid(), merged)
    await writeDailyTopoBucket(uuid(), newFlows)
  } catch (error) {
    console.error('Failed to save topology flows:', error)
  }

  const retentionDays = getRetentionDays()
  pruneOldBuckets(uuid(), retentionDays).catch(() => {})
  pruneOldTopoBuckets(uuid(), retentionDays).catch(() => {})
}
