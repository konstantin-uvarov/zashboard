import { DHCP_LABELS } from '@/helper/dhcpLabels'
import { sourceIPLabelList } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import * as ipaddr from 'ipaddr.js'
import { watch } from 'vue'

const CACHE_SIZE = 256
const ipLabelCache = new Map<string, string>()
const sourceIPMap = new Map<string, string>()
const sourceIPRegexList: { regex: RegExp; label: string }[] = []
type CIDREntry = { cidr: [ipaddr.IPv4 | ipaddr.IPv6, number]; label: string }
const sourceIPCIDRList: CIDREntry[] = []

const preprocessSourceIPList = () => {
  ipLabelCache.clear()
  sourceIPMap.clear()
  sourceIPRegexList.length = 0
  sourceIPCIDRList.length = 0

  for (const { key, label, scope } of sourceIPLabelList.value) {
    if (scope && !scope.includes(activeBackend.value?.uuid as string)) {
      continue
    }

    if (key.startsWith('/')) {
      sourceIPRegexList.push({ regex: new RegExp(key.slice(1), 'i'), label })
      continue
    }

    if (key.includes('/')) {
      try {
        const cidr = ipaddr.parseCIDR(key)
        sourceIPCIDRList.push({ cidr, label })
        continue
      } catch {
        // 无效 CIDR，忽略
      }
    }

    sourceIPMap.set(key, label)
  }
}

const cacheResult = (ip: string, label: string) => {
  ipLabelCache.set(ip, label)

  if (ipLabelCache.size > CACHE_SIZE) {
    const firstKey = ipLabelCache.keys().next().value

    if (firstKey) {
      ipLabelCache.delete(firstKey)
    }
  }

  return label
}

watch(() => [sourceIPLabelList.value, activeBackend.value], preprocessSourceIPList, {
  immediate: true,
  deep: true,
})

export const getIPLabelFromMap = (ip: string) => {
  if (!ip) return ip === '' ? 'Inner' : ''

  if (ipLabelCache.has(ip)) {
    return ipLabelCache.get(ip)!
  }
  const addr = ipaddr.parse(ip)
  const isIPv6 = addr.kind() === 'ipv6'

  if (isIPv6) {
    for (const [key, label] of sourceIPMap.entries()) {
      if (ip.endsWith(key)) {
        return cacheResult(ip, label)
      }
    }
  }

  if (sourceIPMap.has(ip)) {
    return cacheResult(ip, sourceIPMap.get(ip)!)
  }

  for (const { regex, label } of sourceIPRegexList) {
    if (regex.test(ip)) {
      return cacheResult(ip, label)
    }
  }

  for (const { cidr, label } of sourceIPCIDRList) {
    if (addr.match(cidr)) {
      return cacheResult(ip, label)
    }
  }

  // Fall back to static DHCP map
  if (DHCP_LABELS[ip]) {
    return cacheResult(ip, DHCP_LABELS[ip])
  }

  return cacheResult(ip, ip)
}

/** Returns "IP (Label)" when a label is known, or just "IP" if unlabeled. */
export const getIPDisplayLabel = (ip: string) => {
  const label = getIPLabelFromMap(ip)
  if (!label || label === ip) return ip
  return `${ip} (${label})`
}
