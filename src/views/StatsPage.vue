<template>
  <div class="flex w-full flex-col gap-2 p-2">
    <ChartsCard :show-stats="true" />
    <div class="card w-full">
      <div class="px-4 pt-4 pb-2">
        <span class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
          {{ $t('deviceSpeedChart') }}
        </span>
      </div>
      <div class="card-body pt-0">
        <DeviceSpeedCharts />
      </div>
    </div>
    <ConnectionHistory />
    <TopologyCharts />
    <RuleHitCountCard />
  </div>
</template>

<script setup lang="ts">
import ChartsCard from '@/components/overview/ChartsCard.vue'
import ConnectionHistory from '@/components/overview/ConnectionHistory.vue'
import RuleHitCountCard from '@/components/overview/RuleHitCountCard.vue'
import TopologyCharts from '@/components/overview/TopologyCharts.vue'
import DeviceSpeedCharts from '@/components/stats/DeviceSpeedCharts.vue'
</script>
