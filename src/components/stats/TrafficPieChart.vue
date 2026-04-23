<template>
  <div class="card">
    <div class="card-title flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
      <div class="flex items-center gap-2">
        <span>{{ $t('trafficPieChart') }}</span>
        <QuestionMarkCircleIcon
          class="h-4 w-4 cursor-pointer"
          @mouseenter="showTip($event, chartTip)"
        />
      </div>
      <div class="flex items-center gap-2 font-normal">
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
        class="border-b-primary/30 border-t-primary/60 border-l-info/30 border-r-info/60 text-base-content/10 bg-base-100/70 hidden"
        ref="colorRef"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { getIPColor } from '@/composables/ipColorMap'
import {
  TIME_RANGE_OPTIONS,
  filterConnectionsByTimeRange,
  getOldestConnectionTime,
  getTimeRangeMs,
  type TimeRangeValue,
} from '@/composables/timeRange'
import { ConnectionHistoryType } from '@/helper/indexeddb'
import { getIPLabelFromMap } from '@/helper/sourceip'
import { useTooltip } from '@/helper/tooltip'
import { prettyBytesHelper } from '@/helper/utils'
import { aggregateConnections, aggregatedDataMap, mergeAggregatedData } from '@/store/connHistory'
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

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

const { t } = useI18n()
const { showTip } = useTooltip()
const startTime = useLocalStorage<number>('cache/connection-history-stats-start-time', Date.now())
const BAR_HEIGHT = 28
const CHART_MARGIN = 50

const chartEl = ref<HTMLElement | null>(null)
const colorRef = ref<HTMLElement | null>(null)
const groupBy = useLocalStorage<ConnectionHistoryType>(
  'stats-pie-groupby',
  ConnectionHistoryType.SourceIP,
)
const timeRange = useLocalStorage<TimeRangeValue>('stats-pie-timerange', 'all')

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

const chartData = computed(() => {
  let entries
  if (timeRange.value === 'all') {
    entries = aggregatedDataMap.value[groupBy.value] ?? []
  } else {
    const rangeMs = getTimeRangeMs(timeRange.value)
    const filtered = filterConnectionsByTimeRange(
      [...closedConnections.value, ...activeConnections.value],
      rangeMs,
    )
    const live = aggregateConnections(filtered, groupBy.value)
    entries = mergeAggregatedData([], live)
  }
  return [...entries]
    .sort((a, b) => b.download - a.download)
    .map((entry) => {
      const label =
        groupBy.value === ConnectionHistoryType.SourceIP ? getIPLabelFromMap(entry.key) : entry.key
      const color =
        groupBy.value === ConnectionHistoryType.SourceIP ? getIPColor(entry.key) : undefined
      return { label, download: entry.download, upload: entry.upload, color }
    })
    .filter((d) => d.download > 0 || d.upload > 0)
})

const chartHeight = computed(() =>
  Math.max(120, chartData.value.length * BAR_HEIGHT + CHART_MARGIN),
)

const chartTip = computed(() => {
  if (timeRange.value === 'all') {
    const d = dayjs(startTime.value)
    return t('trafficDistributionTip', {
      note: t('chartTipAllHistory', {
        time: `${d.format('YYYY-MM-DD HH:mm')} (${d.fromNow()})`,
      }),
    })
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

const buildOptions = () => {
  const labels = chartData.value.map((d) => d.label)
  const data = chartData.value.map((d) => ({
    value: d.download,
    itemStyle: d.color ? { color: d.color } : {},
  }))

  return {
    grid: { left: 120, right: 16, top: 8, bottom: 28, containLabel: false },
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
        return `<div style="padding:2px 6px">${d.label}<br/>&#x2193; ${dl}<br/>&#x2191; ${ul}</div>`
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
      data: labels,
      inverse: true,
      axisLabel: {
        color: colorSet.baseContent,
        fontFamily,
        width: 110,
        overflow: 'truncate',
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        data,
        barMaxWidth: 20,
        itemStyle: { borderRadius: [0, 3, 3, 0] },
      },
    ],
  }
}

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

  watch(chartData, async () => {
    await nextTick()
    myChart?.setOption(buildOptions(), true)
    myChart?.resize()
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
