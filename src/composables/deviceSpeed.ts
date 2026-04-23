import { getIPLabelFromMap } from '@/helper/sourceip'
import { activeConnections } from '@/store/connections'
import { timeSaved } from '@/store/overview'
import { computed, ref, watch } from 'vue'

const MAX_DEVICES = 8

interface SpeedPoint {
  name: number
  value: number
}

// Map from sourceIP -> ring buffer of {download, upload} speed points
const deviceDownloadHistory = ref<Map<string, SpeedPoint[]>>(new Map())
const deviceUploadHistory = ref<Map<string, SpeedPoint[]>>(new Map())

const initValue = () => new Array(timeSaved).fill(0).map((_, i) => ({ name: i, value: 0 }))

watch(
  activeConnections,
  (connections) => {
    const timestamp = Date.now()

    // Aggregate speed per sourceIP
    const downloadByIP = new Map<string, number>()
    const uploadByIP = new Map<string, number>()

    for (const conn of connections) {
      const ip = conn.metadata.sourceIP
      if (!ip) continue
      downloadByIP.set(ip, (downloadByIP.get(ip) ?? 0) + (conn.downloadSpeed ?? 0))
      uploadByIP.set(ip, (uploadByIP.get(ip) ?? 0) + (conn.uploadSpeed ?? 0))
    }

    // Update histories for all known IPs (including those with 0 speed now)
    const allKnownIPs = new Set([...deviceDownloadHistory.value.keys(), ...downloadByIP.keys()])

    for (const ip of allKnownIPs) {
      if (!deviceDownloadHistory.value.has(ip)) {
        deviceDownloadHistory.value.set(ip, initValue())
        deviceUploadHistory.value.set(ip, initValue())
      }

      const dl = deviceDownloadHistory.value.get(ip)!
      const ul = deviceUploadHistory.value.get(ip)!

      dl.push({ name: timestamp, value: downloadByIP.get(ip) ?? 0 })
      ul.push({ name: timestamp, value: uploadByIP.get(ip) ?? 0 })

      // Trim ring buffer
      if (dl.length > timeSaved) {
        deviceDownloadHistory.value.set(ip, dl.slice(-timeSaved))
        deviceUploadHistory.value.set(ip, ul.slice(-timeSaved))
      }
    }

    // Trigger reactivity
    deviceDownloadHistory.value = new Map(deviceDownloadHistory.value)
    deviceUploadHistory.value = new Map(deviceUploadHistory.value)
  },
  { deep: false },
)

// Pick top N devices by recent average combined speed
const topDeviceIPs = computed(() => {
  const scored: { ip: string; score: number }[] = []

  for (const [ip, history] of deviceDownloadHistory.value.entries()) {
    const dlHistory = history.slice(-10)
    const ulHistory = deviceUploadHistory.value.get(ip)?.slice(-10) ?? []
    const avgDl = dlHistory.reduce((s, p) => s + p.value, 0) / (dlHistory.length || 1)
    const avgUl = ulHistory.reduce((s, p) => s + p.value, 0) / (ulHistory.length || 1)
    scored.push({ ip, score: avgDl + avgUl })
  }

  const topIPs = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_DEVICES)
    .map((s) => s.ip)

  // Sort selected IPs numerically so legend order never changes with speed
  topIPs.sort((a, b) => {
    const partsA = a.split('.').map(Number)
    const partsB = b.split('.').map(Number)
    for (let i = 0; i < 4; i++) {
      const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
      if (diff !== 0) return diff
    }
    return 0
  })

  return topIPs
})

export const deviceDownloadSeries = computed(() => {
  return topDeviceIPs.value.map((ip) => ({
    name: `↓ ${getIPLabelFromMap(ip)}`,
    data: deviceDownloadHistory.value.get(ip) ?? initValue(),
  }))
})

export const deviceUploadSeries = computed(() => {
  return topDeviceIPs.value.map((ip) => ({
    name: `↑ ${getIPLabelFromMap(ip)}`,
    data: deviceUploadHistory.value.get(ip) ?? initValue(),
  }))
})

export const deviceAllSeries = computed(() => {
  return [...deviceDownloadSeries.value, ...deviceUploadSeries.value]
})
