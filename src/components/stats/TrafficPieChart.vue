<template>
  <div class="card">
    <div class="card-title flex items-center justify-between px-4 pt-4">
      <span>{{ $t('trafficPieChart') }}</span>
      <select
        v-model="groupBy"
        class="select select-sm"
      >
        <option :value="ConnectionHistoryType.SourceIP">{{ $t('aggregateBySourceIP') }}</option>
        <option :value="ConnectionHistoryType.Outbound">{{ $t('aggregateByOutbound') }}</option>
        <option :value="ConnectionHistoryType.Destination">
          {{ $t('aggregateByDestination') }}
        </option>
        <option :value="ConnectionHistoryType.Process">{{ $t('aggregateByProcess') }}</option>
      </select>
    </div>
    <div class="card-body relative">
      <div
        v-if="pieData.length === 0"
        class="text-base-content/50 flex h-64 items-center justify-center"
      >
        {{ $t('noData') }}
      </div>
      <div
        v-else
        ref="chartEl"
        class="h-64 w-full"
      />
      <span
        class="border-b-primary/30 border-t-primary/60 border-l-info/30 border-r-info/60 text-base-content/10 bg-base-100/70 hidden"
        ref="colorRef"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ConnectionHistoryType } from '@/helper/indexeddb'
import { getIPLabelFromMap } from '@/helper/sourceip'
import { prettyBytesHelper } from '@/helper/utils'
import { aggregatedDataMap } from '@/store/connHistory'
import { font, theme } from '@/store/settings'
import { useElementSize, useLocalStorage } from '@vueuse/core'
import { PieChart } from 'echarts/charts'
import { LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { debounce } from 'lodash'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

echarts.use([PieChart, LegendComponent, TooltipComponent, CanvasRenderer])

const MAX_SLICES = 10

const chartEl = ref<HTMLElement | null>(null)
const colorRef = ref<HTMLElement | null>(null)
const groupBy = useLocalStorage<ConnectionHistoryType>(
  'stats-pie-groupby',
  ConnectionHistoryType.SourceIP,
)

const colorSet = {
  baseContent: '',
  base70: '',
}

const updateColorSet = () => {
  if (!colorRef.value) return
  const style = getComputedStyle(colorRef.value)
  colorSet.baseContent = style.getPropertyValue('--color-base-content').trim()
  colorSet.base70 = style.backgroundColor
}

let fontFamily = ''
const updateFontFamily = () => {
  if (!colorRef.value) return
  fontFamily = getComputedStyle(colorRef.value).fontFamily
}

const pieData = computed(() => {
  const entries = aggregatedDataMap.value[groupBy.value] ?? []
  const sorted = [...entries].sort((a, b) => b.download - a.download)
  const top = sorted.slice(0, MAX_SLICES)
  const rest = sorted.slice(MAX_SLICES)

  const result = top.map((entry) => {
    const label =
      groupBy.value === ConnectionHistoryType.SourceIP ? getIPLabelFromMap(entry.key) : entry.key
    return { name: label, value: entry.download }
  })

  if (rest.length > 0) {
    const otherTotal = rest.reduce((sum, e) => sum + e.download, 0)
    result.push({ name: 'Other', value: otherTotal })
  }

  return result.filter((d) => d.value > 0)
})

const buildOptions = () => ({
  tooltip: {
    trigger: 'item',
    backgroundColor: colorSet.base70,
    borderColor: colorSet.base70,
    textStyle: {
      color: colorSet.baseContent,
      fontFamily,
    },
    formatter: (params: { name: string; value: number; percent: number }) => {
      const bytes = prettyBytesHelper(params.value, { binary: false })
      return `<div style="padding:2px 4px">${params.name}<br/>${bytes} (${params.percent}%)</div>`
    },
  },
  legend: {
    orient: 'vertical',
    right: 0,
    top: 'center',
    textStyle: {
      color: colorSet.baseContent,
      fontFamily,
    },
  },
  series: [
    {
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: true,
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 12 },
      },
      data: pieData.value,
    },
  ],
})

let myChart: echarts.ECharts | null = null

onMounted(() => {
  updateColorSet()
  updateFontFamily()

  watch(theme, () => {
    updateColorSet()
    myChart?.setOption(buildOptions())
  })
  watch(font, () => {
    updateFontFamily()
    myChart?.setOption(buildOptions())
  })

  if (chartEl.value) {
    myChart = echarts.init(chartEl.value)
    myChart.setOption(buildOptions())
  }

  watch(pieData, () => {
    myChart?.setOption(buildOptions())
  })

  const { width } = useElementSize(chartEl)
  const resize = debounce(() => myChart?.resize(), 100)
  watch(width, resize)
})

onUnmounted(() => {
  myChart?.dispose()
  myChart = null
})
</script>
