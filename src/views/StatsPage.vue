<template>
  <div class="flex w-full flex-col gap-2 p-2">
    <ChartsCard />
    <div class="card w-full">
      <div class="card-title px-4 pt-4">
        {{ $t('deviceSpeedChart') }}
      </div>
      <div class="card-body">
        <DeviceSpeedCharts />
      </div>
    </div>
    <ConnectionHistory />
    <TrafficPieChart />
    <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
      <ProtocolBreakdown />
      <GeoIPChart />
    </div>
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
import GeoIPChart from '@/components/stats/GeoIPChart.vue'
import ProtocolBreakdown from '@/components/stats/ProtocolBreakdown.vue'
import TrafficPieChart from '@/components/stats/TrafficPieChart.vue'
</script>
