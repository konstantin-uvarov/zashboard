import { fetchRuleProvidersAPI, fetchRulesAPI, fetchRulesCgiAPI, isSingBox, version } from '@/api'
import { RULE_TAB_TYPE } from '@/constant'
import { toSearchRegex } from '@/helper/search'
import type { Rule, RuleProvider } from '@/types'
import { computed, ref, watch } from 'vue'

export const rulesFilter = ref('')
export const rulesTabShow = ref(RULE_TAB_TYPE.RULES)

export const rules = ref<Rule[]>([])
export const ruleProviderList = ref<RuleProvider[]>([])

export const renderRules = computed(() => {
  const searchRegex = toSearchRegex(rulesFilter.value)

  if (!searchRegex) {
    return rules.value
  }

  return rules.value.filter((rule) => {
    return [rule.type, rule.payload, rule.proxy, rule.comment ?? ''].some((metadata) =>
      searchRegex.test(metadata),
    )
  })
})

export const renderRulesProvider = computed(() => {
  const searchRegex = toSearchRegex(rulesFilter.value)

  if (!searchRegex) {
    return ruleProviderList.value
  }

  return ruleProviderList.value.filter((ruleProvider) => {
    return [ruleProvider.name, ruleProvider.behavior, ruleProvider.vehicleType].some((metadata) =>
      searchRegex.test(metadata),
    )
  })
})

// Wait for the backend version to load before deciding the API path.
// On a hard refresh fetchRules can run before the version watcher resolves;
// without this wait isSingBox stays false, sing-box rules come back from the
// Clash path without UUIDs, and RuleCard hides every toggle switch.
const waitForVersion = () =>
  new Promise<void>((resolve) => {
    if (version.value !== undefined) return resolve()
    let stop: (() => void) | null = null
    const timer = setTimeout(() => {
      stop?.()
      resolve()
    }, 5000)
    stop = watch(version, (v) => {
      if (v !== undefined) {
        clearTimeout(timer)
        stop?.()
        resolve()
      }
    })
  })

export const fetchRules = async () => {
  await waitForVersion()

  let ruleList: Rule[]
  if (isSingBox.value) {
    try {
      const cgiData = await fetchRulesCgiAPI()
      ruleList = cgiData.rules
    } catch {
      // Fallback to Clash API if CGI is unavailable
      const { data: ruleData } = await fetchRulesAPI()
      ruleList = ruleData.rules
    }
  } else {
    const { data: ruleData } = await fetchRulesAPI()
    ruleList = ruleData.rules
  }

  rules.value = ruleList.map((rule) => {
    const proxy = rule.proxy
    const proxyName = proxy.startsWith('route(') ? proxy.substring(6, proxy.length - 1) : proxy

    return {
      ...rule,
      proxy: proxyName,
    }
  })

  // Fetch providers separately — don't let its failure break rule display
  try {
    const { data: providerData } = await fetchRuleProvidersAPI()
    ruleProviderList.value = Object.values(providerData.providers)
  } catch {
    // Keep existing provider data on failure (e.g. during sing-box restart)
  }
}
