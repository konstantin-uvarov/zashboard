<template>
  <div class="card">
    <div class="card-title flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
      <div class="flex items-center gap-2">
        <span>{{ $t('protocolBreakdown') }}</span>
        <QuestionMarkCircleIcon
          class="h-4 w-4 cursor-pointer"
          @mouseenter="showTip($event, chartTip)"
        />
      </div>
      <div class="flex items-center gap-2 font-normal">
        <div class="flex items-center gap-2">
          <span class="text-sm">{{ $t('timeRange') }}</span>
          <select
            v-model="timeRange"
            class="select select-sm"
          >
            <option
              v-for="opt in TIME_RANGE_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.value === 'all' ? $t('allData') : opt.labelKey }}
            </option>
          </select>
        </div>
      </div>
    </div>
    <div class="card-body relative p-2!">
      <div
        ref="chartEl"
        :style="{ height: chartHeight + 'px' }"
        class="w-full"
      />
      <div
        v-if="chartData.length === 0"
        class="text-base-content/50 absolute inset-0 flex items-center justify-center"
      >
        {{ $t('noData') }}
      </div>
      <span
        class="text-base-content/10 bg-base-100/70 hidden"
        ref="colorRef"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  TIME_RANGE_OPTIONS,
  filterConnectionsByTimeRange,
  getOldestConnectionTime,
  getTimeRangeMs,
  type TimeRangeValue,
} from '@/composables/timeRange'
import { ConnectionHistoryType } from '@/helper/indexeddb'
import { useTooltip } from '@/helper/tooltip'
import { prettyBytesHelper } from '@/helper/utils'
import {
  aggregateConnections,
  aggregatedDataMap,
  historyStartTime,
  mergeAggregatedData,
} from '@/store/connHistory'
import { activeConnections, closedConnections } from '@/store/connections'
import { font, theme } from '@/store/settings'
import { QuestionMarkCircleIcon } from '@heroicons/vue/24/outline'
import { useElementSize, useLocalStorage } from '@vueuse/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { debounce } from 'lodash'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const { t } = useI18n()
const { showTip } = useTooltip()
const BAR_HEIGHT = 28
const CHART_MARGIN = 50

const chartEl = ref<HTMLElement | null>(null)
const colorRef = ref<HTMLElement | null>(null)
const isPaused = ref(false)
const timeRange = useLocalStorage<TimeRangeValue>('stats-protocol-timerange', 'all')

const colorSet = { baseContent: '', base70: '' }
let fontFamily = ''

const updateColorSet = () => {
  if (!colorRef.value) return
  const style = getComputedStyle(colorRef.value)
  colorSet.baseContent = style.getPropertyValue('--color-base-content').trim()
  colorSet.base70 = style.backgroundColor
}

const updateFontFamily = () => {
  if (!colorRef.value) return
  fontFamily = getComputedStyle(colorRef.value).fontFamily
}

const formatProtocol = (key: string) => key.toUpperCase()

const chartData = computed(() => {
  let entries
  if (timeRange.value === 'all') {
    entries = aggregatedDataMap.value[ConnectionHistoryType.Network] ?? []
  } else {
    const rangeMs = getTimeRangeMs(timeRange.value)
    const filtered = filterConnectionsByTimeRange(
      [...closedConnections.value, ...activeConnections.value],
      rangeMs,
    )
    const live = aggregateConnections(filtered, ConnectionHistoryType.Network)
    entries = mergeAggregatedData([], live)
  }
  return [...entries]
    .sort((a, b) => b.download + b.upload - (a.download + a.upload))
    .map((entry) => ({
      label: formatProtocol(entry.key),
      download: entry.download,
      upload: entry.upload,
      count: entry.count,
    }))
    .filter((d) => d.download > 0 || d.upload > 0 || d.count > 0)
})

const chartHeight = computed(() =>
  Math.max(120, chartData.value.length * BAR_HEIGHT + CHART_MARGIN),
)

const chartTip = computed(() => {
  if (timeRange.value === 'all') {
    const note =
      historyStartTime.value !== null
        ? t('chartTipAllHistory', {
            time: `${dayjs(historyStartTime.value).format('YYYY-MM-DD HH:mm')} (${dayjs(historyStartTime.value).fromNow()})`,
          })
        : t('chartTipAllHistoryUnknown')
    return t('trafficDistributionTip', { note })
  }
  const rangeMs = getTimeRangeMs(timeRange.value)
  const filtered = filterConnectionsByTimeRange(
    [...closedConnections.value, ...activeConnections.value],
    rangeMs,
  )
  const ts = getOldestConnectionTime(filtered)
  const note = t('chartTipTimeLimited', {
    time: ts !== null ? new Date(ts).toLocaleString() : '—',
  })
  return t('trafficDistributionTip', { note })
})

const buildOptions = () => ({
  grid: { left: 8, right: 80, top: 8, bottom: 28, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    backgroundColor: colorSet.base70,
    borderColor: colorSet.base70,
    textStyle: { color: colorSet.baseContent, fontFamily },
    formatter: (params: { dataIndex: number }[]) => {
      const idx = params[0]?.dataIndex ?? 0
      const d = chartData.value[idx]
      if (!d) return ''
      const dl = prettyBytesHelper(d.download, { binary: false })
      const ul = prettyBytesHelper(d.upload, { binary: false })
      const total = prettyBytesHelper(d.download + d.upload, { binary: false })
      return (
        `<div style="padding:2px 6px">${d.label}<br/>` +
        `&#x2193; ${dl}&nbsp;&nbsp;&#x2191; ${ul}<br/>` +
        `&#x2211; ${total}&nbsp;&nbsp;#${d.count}</div>`
      )
    },
  },
  xAxis: {
    type: 'value',
    axisLabel: {
      color: colorSet.baseContent,
      fontFamily,
      formatter: (v: number) => prettyBytesHelper(v, { binary: false }),
    },
    splitLine: { lineStyle: { color: colorSet.baseContent + '20' } },
  },
  yAxis: {
    type: 'category',
    data: chartData.value.map((d) => d.label),
    inverse: true,
    axisLabel: { color: colorSet.baseContent, fontFamily },
    axisTick: { show: false },
    axisLine: { show: false },
  },
  series: [
    {
      name: 'download',
      type: 'bar',
      stack: 'traffic',
      data: chartData.value.map((d) => ({ value: d.download })),
      barMaxWidth: 20,
      emphasis: { disabled: true },
    },
    {
      name: 'upload',
      type: 'bar',
      stack: 'traffic',
      data: chartData.value.map((d) => ({ value: d.upload })),
      barMaxWidth: 20,
      itemStyle: { opacity: 0.6 },
      emphasis: { disabled: true },
      label: {
        show: true,
        position: 'right',
        color: colorSet.baseContent,
        fontFamily,
        formatter: (params: { dataIndex: number }) => {
          const d = chartData.value[params.dataIndex]
          if (!d) return ''
          return prettyBytesHelper(d.download + d.upload, { binary: false })
        },
      },
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
    myChart.on('showTip', () => {
      isPaused.value = true
    })
    myChart.on('hideTip', () => {
      isPaused.value = false
    })
  }

  watch(chartData, async () => {
    if (isPaused.value) return
    await nextTick()
    myChart?.setOption(buildOptions(), true)
    myChart?.resize()
  })

  const { width } = useElementSize(chartEl)
  watch(
    width,
    debounce(() => myChart?.resize(), 100),
  )
})

onUnmounted(() => {
  myChart?.dispose()
  myChart = null
})
</script>
