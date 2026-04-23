<template>
  <div class="relative h-64 w-full overflow-hidden">
    <div
      ref="chartEl"
      class="h-full w-full"
    />
    <span
      class="text-base-content/10 bg-base-100/70 hidden"
      ref="colorRef"
    />
  </div>
</template>

<script setup lang="ts">
import { deviceAllSeries } from '@/composables/deviceSpeed'
import { prettyBytesHelper } from '@/helper/utils'
import { font, theme } from '@/store/settings'
import { useElementSize } from '@vueuse/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { debounce } from 'lodash'
import { onMounted, onUnmounted, ref, watch } from 'vue'

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const chartEl = ref<HTMLElement | null>(null)
const colorRef = ref<HTMLElement | null>(null)

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

const labelFormatter = (value: number) =>
  `${prettyBytesHelper(value, { maximumFractionDigits: 0, binary: false })}/s`

const PALETTE = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc',
  '#45b7d1',
  '#96ceb4',
  '#ffad60',
  '#ff6b6b',
  '#c3a6ff',
  '#a8e063',
  '#56ccf2',
]

const buildOptions = () => ({
  color: PALETTE,
  legend: {
    bottom: 0,
    type: 'scroll',
    data: deviceAllSeries.value.map((s) => s.name),
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
    formatter: (params: ToolTipParams[]) =>
      params
        .filter((p) => p.data.value > 0)
        .map(
          (p) =>
            `<div style="display:flex;align-items:center;gap:4px;padding:1px 0">` +
            `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>` +
            `${p.seriesName}: ${prettyBytesHelper(p.data.value, { binary: false, maximumFractionDigits: 1 })}/s` +
            `</div>`,
        )
        .join('') || '—',
  },
  xAxis: {
    type: 'category',
    axisLine: { show: false },
    axisLabel: { show: false },
    splitLine: { show: false },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    splitNumber: 4,
    min: 0,
    max: (v: { max: number }) => Math.max(v.max, 60 * 1024),
    axisLine: { show: false },
    splitLine: {
      show: true,
      lineStyle: { type: 'dashed', color: colorSet.baseContent10 },
    },
    axisLabel: {
      align: 'left',
      padding: [0, 0, 0, -45],
      formatter: labelFormatter,
      color: colorSet.baseContent,
      fontFamily,
    },
  },
  series: deviceAllSeries.value.map((s, i) => {
    const c = PALETTE[i % PALETTE.length]
    return {
      name: s.name,
      type: 'line',
      symbol: 'none',
      smooth: true,
      lineStyle: { width: 1, color: c },
      emphasis: { disabled: true },
      data: s.data,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: c + 'cc' },
          { offset: 1, color: c + '1a' },
        ]),
      },
    }
  }),
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

  watch(deviceAllSeries, () => myChart?.setOption(buildOptions()), { deep: false })

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
