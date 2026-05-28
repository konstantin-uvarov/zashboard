<template>
  <div class="card w-full">
    <div class="px-4 pt-4 pb-2">
      <span class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
        {{ $t('deviceCumulativeSpeedChart') }}
      </span>
    </div>
    <div class="card-body pt-0">
      <div class="bg-base-200/30 relative h-64 w-full overflow-hidden rounded-xl">
        <div
          ref="chartEl"
          class="h-full w-full"
        />
        <span
          class="text-base-content/10 bg-base-100/70 hidden"
          ref="colorRef"
        />
        <button
          class="btn btn-ghost btn-xs absolute top-2 right-2"
          @click="isPaused = !isPaused"
        >
          <component
            :is="!isPaused ? PauseCircleIcon : PlayCircleIcon"
            class="h-4 w-4"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { deviceCombinedSeries } from '@/composables/deviceSpeed'
import { getIPColor } from '@/composables/ipColorMap'
import { prettyBytesHelper } from '@/helper/utils'
import { font, theme } from '@/store/settings'
import { PauseCircleIcon, PlayCircleIcon } from '@heroicons/vue/24/outline'
import { useElementSize } from '@vueuse/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { debounce } from 'lodash'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const { t } = useI18n()
const chartEl = ref<HTMLElement | null>(null)
const colorRef = ref<HTMLElement | null>(null)
const isPaused = ref(false)

const colorSet = { baseContent: '', base70: '', baseContent10: '' }
let fontFamily = ''

const updateColorSet = () => {
  if (!colorRef.value) return
  const style = getComputedStyle(colorRef.value)
  colorSet.baseContent = style.getPropertyValue('--color-base-content').trim()
  colorSet.base70 = style.backgroundColor
  colorSet.baseContent10 = style.color
}
const updateFontFamily = () => {
  if (!colorRef.value) return
  fontFamily = getComputedStyle(colorRef.value).fontFamily
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const bytesFormatter = (value: number) =>
  prettyBytesHelper(value, { maximumFractionDigits: 1, binary: false })

type TipParams = ToolTipParams & { value: number; seriesIndex: number; dataIndex: number }

const buildOptions = () => {
  const rawSeries = deviceCombinedSeries.value
  const len = rawSeries[0]?.data.length ?? 0

  // Running cumulative sum of bytes per device within the visible window.
  // Each speed value (bytes/sec * ~1s tick) ≈ bytes. Summing gives total bytes
  // accumulated in this window — grows monotonically, no spikes.
  const allCumulative = rawSeries.map((s) => {
    let acc = 0
    return s.data.map((pt) => {
      acc += pt.value
      return acc
    })
  })

  // Devices >= 1% of total are visible in graph and hover; all appear in bottom legend.
  const grandTotal = allCumulative.reduce((sum, d) => sum + (d[d.length - 1] ?? 0), 0)
  const minBytes = grandTotal * 0.01
  const isVisible = rawSeries.map(
    (_, i) => (allCumulative[i][allCumulative[i].length - 1] ?? 0) >= minBytes,
  )

  return {
    legend: {
      bottom: 0,
      type: 'scroll',
      data: rawSeries.map((s) => s.name),
      textStyle: { color: colorSet.baseContent, fontFamily },
    },
    grid: { left: 60, top: 15, right: 8, bottom: 40 },
    tooltip: {
      show: true,
      trigger: 'axis',
      backgroundColor: colorSet.base70,
      borderColor: colorSet.base70,
      confine: true,
      padding: [0, 5],
      textStyle: { color: colorSet.baseContent, fontFamily },
      formatter: (params: TipParams[]) => {
        // params only contains series with tooltip.show !== false (i.e. visible ones)
        const idx = params[0]?.dataIndex ?? 0
        const total = params.reduce((sum, p) => sum + (allCumulative[p.seriesIndex]?.[idx] ?? 0), 0)
        if (total === 0) return '—'
        const rows = params
          .map((p) => {
            const bytes = allCumulative[p.seriesIndex]?.[idx] ?? 0
            return (
              `<div style="display:flex;align-items:center;gap:4px;padding:1px 0">` +
              `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>` +
              `${escapeHtml(p.seriesName)}: ${bytesFormatter(bytes)}` +
              `</div>`
            )
          })
          .join('')
        const totalRow =
          params.length > 1
            ? `<div style="padding:2px 0;margin-top:2px;border-top:1px solid ${colorSet.baseContent10}">` +
              `${escapeHtml(t('total'))}: ${bytesFormatter(total)}` +
              `</div>`
            : ''
        return rows + totalRow
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: Array.from({ length: len }, (_, i) => i),
      axisLine: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitNumber: 4,
      min: 0,
      axisLine: { show: false },
      splitLine: {
        show: true,
        lineStyle: { type: 'dashed', color: colorSet.baseContent10 },
      },
      axisLabel: {
        align: 'left',
        padding: [0, 0, 0, -45],
        formatter: bytesFormatter,
        color: colorSet.baseContent,
        fontFamily,
      },
    },
    series: rawSeries.map((s, i) => {
      const c = getIPColor(s.ip)
      const visible = isVisible[i]
      return {
        name: s.name,
        type: 'line',
        // Hidden series use no stack and null data so they don't affect scale or stacking
        stack: visible ? 'Total' : undefined,
        symbol: 'none',
        smooth: true,
        showSymbol: false,
        itemStyle: { color: c },
        lineStyle: { width: visible ? 1 : 0, color: c },
        emphasis: { disabled: true },
        tooltip: { show: visible },
        data: visible ? allCumulative[i] : Array<null>(len).fill(null),
        areaStyle: visible
          ? {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: c + 'cc' },
                { offset: 1, color: c + '1a' },
              ]),
            }
          : { opacity: 0 },
      }
    }),
  }
}

const applyOptions = () => {
  const opts = buildOptions()
  // Preserve user's legend toggle state across notMerge rebuilds
  const currentOpts = myChart?.getOption() as
    | { legend?: { selected?: Record<string, boolean> }[] }
    | undefined
  const selected = currentOpts?.legend?.[0]?.selected
  if (selected && opts.legend) {
    ;(opts.legend as Record<string, unknown>).selected = selected
  }
  myChart?.setOption(opts, /* notMerge */ true)
}

let myChart: echarts.ECharts | null = null

onMounted(() => {
  updateColorSet()
  updateFontFamily()

  watch(theme, () => {
    updateColorSet()
    applyOptions()
  })
  watch(font, () => {
    updateFontFamily()
    applyOptions()
  })

  if (chartEl.value) {
    myChart = echarts.init(chartEl.value)
    applyOptions()
    myChart.on('showTip', () => {
      isPaused.value = true
    })
    myChart.on('hideTip', () => {
      isPaused.value = false
    })
  }

  watch(
    deviceCombinedSeries,
    () => {
      if (isPaused.value) return
      applyOptions()
    },
    { deep: false },
  )

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
