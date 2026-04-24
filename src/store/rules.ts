import { fetchRuleProvidersAPI, fetchRulesAPI, fetchRulesCgiAPI, isSingBox } from '@/api'
import { RULE_TAB_TYPE } from '@/constant'
import type { Rule, RuleProvider } from '@/types'
import { computed, ref } from 'vue'

export const rulesFilter = ref('')
export const rulesTabShow = ref(RULE_TAB_TYPE.RULES)

export const rules = ref<Rule[]>([])
export const ruleProviderList = ref<RuleProvider[]>([])

export const renderRules = computed(() => {
  const rulesFilterValue = rulesFilter.value.split(' ').map((f) => f.toLowerCase().trim())

  if (rulesFilter.value === '') {
    return rules.value
  }

  return rules.value.filter((rule) => {
    return rulesFilterValue.every((f) =>
      [
        rule.type.toLowerCase(),
        rule.payload.toLowerCase(),
        rule.proxy.toLowerCase(),
        (rule.comment || '').toLowerCase(),
      ].some((i) => i.includes(f)),
    )
  })
})

export const renderRulesProvider = computed(() => {
  const rulesFilterValue = rulesFilter.value.split(' ').map((f) => f.toLowerCase().trim())

  if (rulesFilter.value === '') {
    return ruleProviderList.value
  }

  return ruleProviderList.value.filter((ruleProvider) => {
    return rulesFilterValue.every((f) =>
      [
        ruleProvider.name.toLowerCase(),
        ruleProvider.behavior.toLowerCase(),
        ruleProvider.vehicleType.toLowerCase(),
      ].some((i) => i.includes(f)),
    )
  })
})

export const fetchRules = async () => {
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
