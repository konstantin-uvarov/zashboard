<template>
  <BasicCharts
    :data="chartsData"
    :label-formatter="labelFormatter"
    :tool-tip-formatter="tooltipFormatter"
    :min="60 * 1000"
    class="xl:h-64"
  />
</template>

<script setup lang="ts">
import BasicCharts from '@/components/overview/BasicCharts.vue'
import { deviceAllSeries } from '@/composables/deviceSpeed'
import { getToolTipForParams } from '@/helper'
import { prettyBytesHelper } from '@/helper/utils'

const chartsData = deviceAllSeries

const labelFormatter = (value: number) => {
  return `${prettyBytesHelper(value, {
    maximumFractionDigits: 0,
    binary: false,
  })}/s`
}

const tooltipFormatter = (value: ToolTipParams[]) => {
  return value
    .map((item) => {
      return getToolTipForParams(item, {
        binary: false,
        suffix: '/s',
      })
    })
    .join('')
}
</script>
