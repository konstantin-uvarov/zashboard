<template>
  <div class="card w-full backdrop-blur-none!">
    <div class="need-blur flex items-center justify-between px-4 pt-4">
      <div class="flex w-full items-center gap-4 max-sm:flex-col max-sm:items-start">
        <div class="flex flex-1 items-center gap-2">
          <span class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
            {{ $t('totalConnections') }}
          </span>

          <button
            class="btn btn-sm"
            @click="showClearDialog = true"
          >
            <TrashIcon class="h-4 w-4" />
          </button>
          <QuestionMarkCircleIcon
            class="h-4 w-4 cursor-pointer"
            @mouseenter="showTip($event, totalConnectionsTip)"
          />
        </div>

        <div class="flex items-center gap-2 font-normal max-sm:flex-col max-sm:items-start">
          <label class="flex cursor-pointer items-center gap-2">
            <span class="text-sm">{{ $t('hideSmallValues') }}</span>
            <input
              type="checkbox"
              class="toggle toggle-sm"
              v-model="hideSmallValues"
            />
          </label>
          <div class="flex items-center gap-2">
            <span class="text-sm">{{ $t('timeRange') }}</span>
            <select
              v-model="timeRange"
              class="select select-bordered select-sm"
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
              v-model="aggregationType"
              class="select select-bordered select-sm w-32"
            >
              <option :value="ConnectionHistoryType.SourceIP">
                {{ $t('aggregateBySourceIP') }}
              </option>
              <option :value="ConnectionHistoryType.Destination">
                {{ $t('aggregateByDestination') }}
              </option>
              <option :value="ConnectionHistoryType.Process">{{ $t('aggregateByProcess') }}</option>
              <option :value="ConnectionHistoryType.Outbound">
                {{ $t('aggregateByOutbound') }}
              </option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm">{{ $t('autoCleanupInterval') }}</span>
            <select
              v-model="autoCleanupInterval"
              class="select select-bordered select-sm w-28"
            >
              <option :value="AutoCleanupInterval.Never">
                {{ $t('autoCleanupIntervalNever') }}
              </option>
              <option :value="AutoCleanupInterval.Week">{{ $t('autoCleanupIntervalWeek') }}</option>
              <option :value="AutoCleanupInterval.Month">
                {{ $t('autoCleanupIntervalMonth') }}
              </option>
              <option :value="AutoCleanupInterval.Quarter">
                {{ $t('autoCleanupIntervalQuarter') }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
    <div class="card-body need-blur gap-0! p-0!">
      <div class="px-4 py-4">
        <div class="grid grid-cols-2 gap-2 md:grid-cols-5">
          <div class="bg-base-200/30 flex flex-col gap-1 rounded-xl p-3 lg:gap-1.5 lg:p-4">
            <div class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
              {{ aggregateSourceLabel }}
            </div>
            <div class="text-lg font-extralight tabular-nums lg:text-2xl">
              {{ aggregateSourceCount }}
            </div>
          </div>
          <div class="bg-base-200/30 flex flex-col gap-1 rounded-xl p-3 lg:gap-1.5 lg:p-4">
            <div class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
              {{ t('download') }}
            </div>
            <div class="text-lg font-extralight tabular-nums lg:text-2xl">
              {{ prettyBytesHelper(totalStats.download) }}
            </div>
          </div>
          <div class="bg-base-200/30 flex flex-col gap-1 rounded-xl p-3 lg:gap-1.5 lg:p-4">
            <div class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
              {{ t('upload') }}
            </div>
            <div class="text-lg font-extralight tabular-nums lg:text-2xl">
              {{ prettyBytesHelper(totalStats.upload) }}
            </div>
          </div>
          <div class="bg-base-200/30 flex flex-col gap-1 rounded-xl p-3 lg:gap-1.5 lg:p-4">
            <div class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
              {{ t('totalTraffic') }}
            </div>
            <div class="text-lg font-extralight tabular-nums lg:text-2xl">
              {{ prettyBytesHelper(totalStats.download + totalStats.upload) }}
            </div>
          </div>
          <div class="bg-base-200/30 flex flex-col gap-1 rounded-xl p-3 lg:gap-1.5 lg:p-4">
            <div class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
              {{ t('connectionCount') }}
            </div>
            <div class="text-lg font-extralight tabular-nums lg:text-2xl">
              {{ totalStats.count.toString() }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="px-4 pb-2">
      <TrafficPieChart
        :time-range="timeRange"
        :group-by="aggregationType"
        :hide-small-values="hideSmallValues"
        :hide-controls="true"
        :max-items="50"
      />
    </div>

    <button
      class="flex w-full cursor-pointer items-center gap-1 px-4 pb-4 text-left text-sm opacity-60 hover:opacity-100"
      @click="tableCollapsed = !tableCollapsed"
    >
      <ChevronRightIcon
        class="h-3.5 w-3.5 shrink-0 transition-transform"
        :class="{ 'rotate-90': !tableCollapsed }"
      />
      <span class="font-medium underline decoration-dotted underline-offset-4">{{
        $t('detailedBreakdown')
      }}</span>
      <TableCellsIcon class="h-3.5 w-3.5 shrink-0" />
    </button>
    <div
      v-show="!tableCollapsed"
      @touchstart.passive.stop
      @touchmove.passive.stop
      @touchend.passive.stop
    >
      <table class="table-sm table-zebra mb-4 table w-full rounded-none">
        <thead class="bg-base-200 sticky top-0 z-10">
          <tr>
            <th
              v-for="header in tanstackTable.getHeaderGroups()[0]?.headers"
              :key="header.id"
              class="cursor-pointer select-none"
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <div class="flex items-center gap-1">
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
                <ArrowUpCircleIcon
                  v-if="header.column.getIsSorted() === 'asc'"
                  class="h-4 w-4"
                />
                <ArrowDownCircleIcon
                  v-if="header.column.getIsSorted() === 'desc'"
                  class="h-4 w-4"
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            class="hover:bg-primary! hover:text-primary-content whitespace-nowrap"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="text-sm"
            >
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div
        v-if="isTableCapped"
        class="text-base-content/50 px-4 pt-1 pb-3 text-xs"
      >
        {{ $t('showingTopItems', { count: DISPLAY_CAP, total: filteredAggregatedData.length }) }}
      </div>
    </div>

    <DialogWrapper
      v-model="showClearDialog"
      :title="$t('clearConnectionHistory')"
    >
      <div class="flex flex-col gap-4 p-2">
        <p class="text-sm">
          {{ $t('clearConnectionHistoryConfirm') }}
        </p>
        <div class="flex justify-end gap-2">
          <button
            class="btn btn-sm"
            @click="showClearDialog = false"
          >
            {{ $t('cancel') }}
          </button>
          <button
            class="btn btn-error btn-sm"
            @click="handleClearHistory"
          >
            {{ $t('confirm') }}
          </button>
        </div>
      </div>
    </DialogWrapper>
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
import { ConnectionHistoryType, clearConnectionHistoryFromIndexedDB } from '@/helper/indexeddb'
import { showNotification } from '@/helper/notification'
import { getIPDisplayLabel } from '@/helper/sourceip'
import { useTooltip } from '@/helper/tooltip'
import { prettyBytesHelper } from '@/helper/utils'
import {
  aggregateConnections,
  aggregatedDataMap,
  historyStartTime,
  initAggregatedDataMap,
  mergeAggregatedData,
} from '@/store/connHistory'
import { activeConnections, closedConnections } from '@/store/connections'
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  ChevronRightIcon,
  QuestionMarkCircleIcon,
  TableCellsIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'
import {
  FlexRender,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/vue-table'

import { useStorage } from '@vueuse/core'
import dayjs from 'dayjs'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DialogWrapper from '../common/DialogWrapper.vue'
import ProxyName from '../proxies/ProxyName.vue'
import TrafficPieChart from '../stats/TrafficPieChart.vue'

const { t } = useI18n()
const { showTip } = useTooltip()

const SMALL_VALUE_THRESHOLD = 10 * 1024 * 1024

enum AutoCleanupInterval {
  Never = 'never',
  Week = 'week',
  Month = 'month',
  Quarter = 'quarter',
}

interface ConnectionHistoryData {
  key: string
  download: number
  upload: number
  count: number
}

const aggregationType = useStorage<ConnectionHistoryType>(
  'cache/connection-history-aggregation-type',
  ConnectionHistoryType.SourceIP,
)
const timeRange = useStorage<TimeRangeValue>('stats-history-timerange', 'all')
const hideSmallValues = useStorage<boolean>('cache/connection-history-hide-small', true)
const tableCollapsed = useStorage<boolean>('cache/connection-history-table-collapsed', true)

const aggregatedData = computed<ConnectionHistoryData[]>(() => {
  if (timeRange.value === 'all') {
    const historicalData = aggregatedDataMap.value[aggregationType.value]
    const currentData = aggregateConnections(activeConnections.value, aggregationType.value)
    return mergeAggregatedData(historicalData, currentData)
  }
  const rangeMs = getTimeRangeMs(timeRange.value)
  const filtered = filterConnectionsByTimeRange(
    [...closedConnections.value, ...activeConnections.value],
    rangeMs,
  )
  return aggregateConnections(filtered, aggregationType.value)
})

const DISPLAY_CAP = 50

const filteredAggregatedData = computed<ConnectionHistoryData[]>(() => {
  const base = hideSmallValues.value
    ? aggregatedData.value.filter((item) => item.download + item.upload >= SMALL_VALUE_THRESHOLD)
    : aggregatedData.value
  return [...base].sort((a, b) => b.download + b.upload - (a.download + a.upload))
})

const tableData = computed(() => filteredAggregatedData.value.slice(0, DISPLAY_CAP))
const isTableCapped = computed(() => filteredAggregatedData.value.length > DISPLAY_CAP)

const totalStats = computed(() => {
  return aggregatedData.value.reduce(
    (acc, item) => {
      acc.download += item.download
      acc.upload += item.upload
      acc.count += item.count
      return acc
    },
    { download: 0, upload: 0, count: 0 },
  )
})

const aggregateSourceCount = computed(() => tableData.value.length)

const aggregateSourceLabel = computed(() => {
  if (aggregationType.value === ConnectionHistoryType.SourceIP) {
    return t('sourceIP')
  } else if (aggregationType.value === ConnectionHistoryType.Destination) {
    return t('host')
  } else if (aggregationType.value === ConnectionHistoryType.Process) {
    return t('process')
  } else {
    return t('outbound')
  }
})

const columns = computed<ColumnDef<ConnectionHistoryData>[]>(() => {
  const keyColumn: ColumnDef<ConnectionHistoryData> = {
    header: () => aggregateSourceLabel.value,
    id: 'key',
    accessorFn: (row) => row.key,
    cell: ({ row }) => {
      if (aggregationType.value === ConnectionHistoryType.SourceIP) {
        const ip = row.original.key
        const color = getIPColor(ip)
        return h('span', { style: 'display:flex;align-items:center;gap:5px' }, [
          h('span', {
            style: `display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0`,
          }),
          getIPDisplayLabel(ip),
        ])
      } else if (aggregationType.value === ConnectionHistoryType.Destination) {
        return row.original.key
      } else if (aggregationType.value === ConnectionHistoryType.Process) {
        return row.original.key
      } else {
        return h(ProxyName, { name: row.original.key })
      }
    },
  }

  return [
    keyColumn,
    {
      header: () => t('download'),
      id: 'download',
      accessorFn: (row) => row.download,
      cell: ({ row }) => prettyBytesHelper(row.original.download),
      sortingFn: (prev, next) => prev.original.download - next.original.download,
      sortDescFirst: true,
    },
    {
      header: () => t('upload'),
      id: 'upload',
      accessorFn: (row) => row.upload,
      cell: ({ row }) => prettyBytesHelper(row.original.upload),
      sortingFn: (prev, next) => prev.original.upload - next.original.upload,
      sortDescFirst: true,
    },
    {
      header: () => t('totalTraffic'),
      id: 'total',
      accessorFn: (row) => row.download + row.upload,
      cell: ({ row }) => prettyBytesHelper(row.original.download + row.original.upload),
      sortingFn: (prev, next) =>
        prev.original.download +
        prev.original.upload -
        (next.original.download + next.original.upload),
      sortDescFirst: true,
    },
    {
      header: () => t('connectionCount'),
      id: 'count',
      accessorFn: (row) => row.count,
      cell: ({ row }) => row.original.count.toString(),
      sortingFn: (prev, next) => prev.original.count - next.original.count,
      sortDescFirst: true,
    },
  ]
})

const sorting = useStorage<SortingState>('cache/connection-history-sorting', [
  { id: 'download', desc: true },
])

const tanstackTable = useVueTable({
  get data() {
    return tableData.value
  },
  get columns() {
    return columns.value
  },
  state: {
    get sorting() {
      return sorting.value
    },
  },
  onSortingChange: (updater) => {
    if (typeof updater === 'function') {
      sorting.value = updater(sorting.value)
    } else {
      sorting.value = updater
    }
  },
  getSortedRowModel: getSortedRowModel(),
  getCoreRowModel: getCoreRowModel(),
})

const rows = computed(() => {
  return tanstackTable.getRowModel().rows
})

const showClearDialog = ref(false)
const autoCleanupInterval = useStorage<AutoCleanupInterval>(
  'config/connection-history-auto-cleanup-interval',
  AutoCleanupInterval.Month,
)
const totalConnectionsTip = computed(() => {
  const baseTip =
    historyStartTime.value !== null
      ? t('totalConnectionsTip', {
          statsStartTime: `${dayjs(historyStartTime.value).format('YYYY-MM-DD HH:mm')} (${dayjs(historyStartTime.value).fromNow()})`,
        })
      : t('chartTipAllHistoryUnknown')
  if (timeRange.value === 'all') return baseTip
  const rangeMs = getTimeRangeMs(timeRange.value)
  const filtered = filterConnectionsByTimeRange(
    [...closedConnections.value, ...activeConnections.value],
    rangeMs,
  )
  const ts = getOldestConnectionTime(filtered)
  const note = t('chartTipTimeLimited', {
    time: ts !== null ? new Date(ts).toLocaleString() : '—',
  })
  return `${baseTip}\n\n${note}`
})
const getCleanupIntervalMs = (interval: AutoCleanupInterval): number => {
  switch (interval) {
    case AutoCleanupInterval.Week:
      return 7 * 24 * 60 * 60 * 1000
    case AutoCleanupInterval.Month:
      return 30 * 24 * 60 * 60 * 1000
    case AutoCleanupInterval.Quarter:
      return 90 * 24 * 60 * 60 * 1000
    case AutoCleanupInterval.Never:
    default:
      return 0
  }
}

const checkAndPerformAutoCleanup = async () => {
  if (autoCleanupInterval.value === AutoCleanupInterval.Never) {
    return
  }
  if (historyStartTime.value === null) {
    return // legacy data with unknown start time — skip auto-cleanup
  }

  const now = Date.now()
  const intervalMs = getCleanupIntervalMs(autoCleanupInterval.value)
  const timeSinceLastCleanup = now - historyStartTime.value

  if (timeSinceLastCleanup >= intervalMs) {
    try {
      await clearConnectionHistoryFromIndexedDB()
      initAggregatedDataMap()
    } catch (error) {
      console.error('Failed to perform auto cleanup:', error)
    }
  }
}

const handleClearHistory = async () => {
  try {
    await clearConnectionHistoryFromIndexedDB()
    initAggregatedDataMap()
    showClearDialog.value = false
    showNotification({
      content: t('clearConnectionHistorySuccess'),
      type: 'alert-success',
    })
  } catch (error) {
    console.error('Failed to clear connection history:', error)
    showNotification({
      content: `${t('saveFailed')}: ${error}`,
      type: 'alert-error',
    })
  }
}

onMounted(() => {
  checkAndPerformAutoCleanup()
})
</script>
