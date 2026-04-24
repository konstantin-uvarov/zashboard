<template>
  <div :class="hideControls ? '' : 'card'">
    <div
      v-if="!hideControls"
      class="card-title flex flex-wrap items-center justify-between gap-2 px-4 pt-4"
    >
      <div class="flex items-center gap-2">
        <span>{{ $t('trafficPieChart') }}</span>
        <QuestionMarkCircleIcon
          class="h-4 w-4 cursor-pointer"
          @mouseenter="showTip($event, chartTip)"
        />
      </div>
      <div class="flex items-center gap-2 font-normal">
        <div class="flex items-center gap-2">
          <span class="text-sm">{{ $t('timeRange') }}</span>
          <select
            v-model="internalTimeRange"
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
        <div class="flex items-center gap-2">
          <span class="text-sm">{{ $t('aggregateBy') }}</span>
          <select
            v-model="internalGroupBy"
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
    </div>
    <div
      v-else
      class="mt-4 mb-0 px-4"
    >
      <span class="text-sm font-bold">{{ $t('trafficPieChart') }}</span>
    </div>
    <div class="bg-base-200/30 relative rounded-xl p-2!">
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
    <div
      v-if="isChartCapped"
      class="text-base-content/50 px-4 pb-2 text-xs"
    >
      {{ $t('showingTopItems', { count: props.maxItems, total: allChartData.length }) }}
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
import { getIPDisplayLabel } from '@/helper/sourceip'
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

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

const props = withDefaults(
  defineProps<{
    timeRange?: TimeRangeValue
    groupBy?: ConnectionHistoryType
    hideSmallValues?: boolean
    hideControls?: boolean
    maxItems?: number
  }>(),
  {
    timeRange: undefined,
    groupBy: undefined,
    hideSmallValues: false,
    hideControls: false,
    maxItems: undefined,
  },
)

const { t } = useI18n()
const { showTip } = useTooltip()
const BAR_HEIGHT = 28
const CHART_MARGIN = 50
const SMALL_VALUE_THRESHOLD = 10 * 1024 * 1024

const chartEl = ref<HTMLElement | null>(null)
const colorRef = ref<HTMLElement | null>(null)
const isPaused = ref(false)
const internalGroupBy = useLocalStorage<ConnectionHistoryType>(
  'stats-pie-groupby',
  ConnectionHistoryType.SourceIP,
)
const internalTimeRange = useLocalStorage<TimeRangeValue>('stats-pie-timerange', 'all')

const activeTimeRange = computed(() => props.timeRange ?? internalTimeRange.value)
const activeGroupBy = computed(() => props.groupBy ?? internalGroupBy.value)

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

const allChartData = computed(() => {
  let entries
  if (activeTimeRange.value === 'all') {
    entries = aggregatedDataMap.value[activeGroupBy.value] ?? []
  } else {
    const rangeMs = getTimeRangeMs(activeTimeRange.value)
    const filtered = filterConnectionsByTimeRange(
      [...closedConnections.value, ...activeConnections.value],
      rangeMs,
    )
    const live = aggregateConnections(filtered, activeGroupBy.value)
    entries = mergeAggregatedData([], live)
  }
  return [...entries]
    .sort((a, b) => b.download + b.upload - (a.download + a.upload))
    .filter((entry) => {
      if (props.hideSmallValues && entry.download + entry.upload < SMALL_VALUE_THRESHOLD)
        return false
      return entry.download > 0 || entry.upload > 0
    })
    .map((entry) => {
      const label =
        activeGroupBy.value === ConnectionHistoryType.SourceIP
          ? getIPDisplayLabel(entry.key)
          : entry.key
      const color =
        activeGroupBy.value === ConnectionHistoryType.SourceIP ? getIPColor(entry.key) : undefined
      return { label, download: entry.download, upload: entry.upload, color }
    })
})

const chartData = computed(() =>
  props.maxItems !== undefined ? allChartData.value.slice(0, props.maxItems) : allChartData.value,
)

const isChartCapped = computed(
  () => props.maxItems !== undefined && allChartData.value.length > props.maxItems,
)

const chartHeight = computed(() =>
  Math.max(120, chartData.value.length * BAR_HEIGHT + CHART_MARGIN),
)

const chartTip = computed(() => {
  if (activeTimeRange.value === 'all') {
    const note =
      historyStartTime.value !== null
        ? t('chartTipAllHistory', {
            time: `${dayjs(historyStartTime.value).format('YYYY-MM-DD HH:mm')} (${dayjs(historyStartTime.value).fromNow()})`,
          })
        : t('chartTipAllHistoryUnknown')
    return t('trafficDistributionTip', { note })
  }
  const rangeMs = getTimeRangeMs(activeTimeRange.value)
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
  return {
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
        return `<div style="padding:2px 6px">${d.label}<br/>&#x2193; ${dl}&nbsp;&nbsp;&#x2191; ${ul}<br/>&#x2211; ${total}</div>`
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
      axisLabel: {
        color: colorSet.baseContent,
        fontFamily,
        width: 240,
        overflow: 'truncate',
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        name: 'download',
        type: 'bar',
        stack: 'traffic',
        data: chartData.value.map((d) => ({
          value: d.download,
          itemStyle: d.color ? { color: d.color } : {},
        })),
        barMaxWidth: 20,
        emphasis: { disabled: true },
      },
      {
        name: 'upload',
        type: 'bar',
        stack: 'traffic',
        data: chartData.value.map((d) => ({
          value: d.upload,
          itemStyle: d.color ? { color: d.color + '80' } : {},
        })),
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
  const resize = debounce(() => myChart?.resize(), 100)
  watch(width, resize)
})

onUnmounted(() => {
  myChart?.dispose()
  myChart = null
})
</script>
