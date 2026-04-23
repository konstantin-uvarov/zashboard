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

// Grow-only set: once an IP enters the legend it never leaves
const stableDeviceIPs = ref<Set<string>>(new Set())

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

    // Add new IPs to the stable set (grow-only, capped at MAX_DEVICES)
    for (const ip of downloadByIP.keys()) {
      if (!stableDeviceIPs.value.has(ip) && stableDeviceIPs.value.size < MAX_DEVICES) {
        stableDeviceIPs.value.add(ip)
      }
    }

    // Update histories for all stable IPs (push 0 for inactive ones)
    for (const ip of stableDeviceIPs.value) {
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
    stableDeviceIPs.value = new Set(stableDeviceIPs.value)
    deviceDownloadHistory.value = new Map(deviceDownloadHistory.value)
    deviceUploadHistory.value = new Map(deviceUploadHistory.value)
  },
  { deep: false },
)

const sortIPsNumerically = (ips: string[]) =>
  [...ips].sort((a, b) => {
    const partsA = a.split('.').map(Number)
    const partsB = b.split('.').map(Number)
    for (let i = 0; i < 4; i++) {
      const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
      if (diff !== 0) return diff
    }
    return 0
  })

// Stable sorted list of device IPs — order and membership never change once set
const stableSortedIPs = computed(() => sortIPsNumerically([...stableDeviceIPs.value]))

export const deviceDownloadSeries = computed(() => {
  return stableSortedIPs.value.map((ip) => ({
    name: `↓ ${getIPLabelFromMap(ip)}`,
    data: deviceDownloadHistory.value.get(ip) ?? initValue(),
  }))
})

export const deviceUploadSeries = computed(() => {
  return stableSortedIPs.value.map((ip) => ({
    name: `↑ ${getIPLabelFromMap(ip)}`,
    data: deviceUploadHistory.value.get(ip) ?? initValue(),
  }))
})

export const deviceAllSeries = computed(() => {
  return [...deviceDownloadSeries.value, ...deviceUploadSeries.value]
})
