<template>
  <div class="card pb-4">
    <div class="absolute z-10 flex w-full items-center justify-between px-4 pt-4">
      <div class="flex items-center gap-2">
        <span class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
          {{ $t('connectionTopology') }}
        </span>
        <QuestionMarkCircleIcon
          class="h-4 w-4 cursor-pointer font-normal"
          @mouseenter="showTip($event, chartTip)"
        />
        <button
          class="btn btn-circle btn-sm"
          @click="showClearDialog = true"
        >
          <TrashIcon class="h-4 w-4" />
        </button>
      </div>
      <div class="flex items-center gap-2 font-normal">
        <div class="flex items-center gap-2">
          <span class="text-sm">{{ $t('metric') }}</span>
          <select
            v-model="metric"
            class="select select-sm"
          >
            <option value="download">{{ $t('download') }}</option>
            <option value="upload">{{ $t('upload') }}</option>
            <option value="total">{{ $t('total') }}</option>
            <option value="count">{{ $t('connectionCount') }}</option>
          </select>
        </div>
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
        <div class="flex items-center gap-2">
          <span class="text-sm">{{ $t('scale') }}</span>
          <select
            v-model="scaleMode"
            class="select select-sm"
          >
            <option value="linear">{{ $t('scaleModeLinear') }}</option>
            <option value="sqrt">{{ $t('scaleModeSqrt') }}</option>
            <option value="log">{{ $t('scaleModeLog') }}</option>
          </select>
        </div>
      </div>
    </div>
    <div
      :class="twMerge('bg-base-200/30 relative w-full overflow-hidden rounded-xl pt-12')"
      style="height: 576px"
      @mousemove.stop
      @touchmove.stop
    >
      <div
        ref="chart"
        class="h-full w-full"
      />
      <span
        class="border-base-content/30 text-base-content/10 bg-base-100/70 hidden"
        ref="colorRef"
      />
      <div
        v-for="overlay in nodeOverlays"
        :key="overlay.id"
        class="pointer-events-none absolute flex items-center justify-center overflow-hidden"
        :style="{
          left: `${overlay.x}px`,
          top: `${overlay.y}px`,
          width: `${overlay.w}px`,
          height: `${overlay.h}px`,
        }"
      >
        <span
          class="text-[9px] font-bold text-white/90 select-none"
          style="
            writing-mode: vertical-rl;
            transform: rotate(180deg);
            white-space: nowrap;
            line-height: 1;
          "
          >{{ overlay.text }}</span
        >
      </div>
      <div
        v-if="sankeyData.nodes.length === 0"
        class="text-base-content/50 absolute inset-0 flex items-center justify-center"
      >
        <div class="text-center">
          <div>{{ t('noData') }}</div>
        </div>
      </div>
      <div
        class="absolute right-1 bottom-1 flex flex-col gap-1"
        :class="isFullScreen ? 'fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)]' : ''"
      >
        <button
          class="btn btn-ghost btn-circle btn-sm"
          @click="togglePause()"
        >
          <component
            :is="!isPaused ? PauseCircleIcon : PlayCircleIcon"
            class="h-4 w-4"
          />
        </button>
        <button
          class="btn btn-ghost btn-circle btn-sm"
          @click="isFullScreen = !isFullScreen"
        >
          <component
            :is="isFullScreen ? ArrowsPointingInIcon : ArrowsPointingOutIcon"
            class="h-4 w-4"
          />
        </button>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <div
      v-if="isFullScreen"
      class="bg-base-100 custom-background fixed inset-0 z-[9999] h-screen w-screen bg-cover bg-center"
      :class="`blur-intensity-${blurIntensity} custom-background-${dashboardTransparent}`"
      :style="backgroundImage"
    >
      <div
        ref="fullScreenChart"
        :class="shouldRotate ? 'bg-base-100' : 'bg-base-100 h-full w-full'"
        :style="fullChartStyle"
      />
      <div
        v-for="overlay in fullScreenNodeOverlays"
        :key="overlay.id"
        class="pointer-events-none absolute flex items-center justify-center overflow-hidden"
        :style="{
          left: `${overlay.x}px`,
          top: `${overlay.y}px`,
          width: `${overlay.w}px`,
          height: `${overlay.h}px`,
        }"
      >
        <span
          class="text-[9px] font-bold text-white/90 select-none"
          style="
            writing-mode: vertical-rl;
            transform: rotate(180deg);
            white-space: nowrap;
            line-height: 1;
          "
          >{{ overlay.text }}</span
        >
      </div>
      <div class="fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)] flex flex-col gap-1">
        <button
          class="btn btn-ghost btn-circle btn-sm"
          @click="togglePause()"
        >
          <component
            :is="!isPaused ? PauseCircleIcon : PlayCircleIcon"
            class="h-4 w-4"
          />
        </button>
        <button
          class="btn btn-ghost btn-circle btn-sm"
          @click="isFullScreen = false"
        >
          <ArrowsPointingInIcon class="h-4 w-4" />
        </button>
      </div>
    </div>
  </Teleport>
  <DialogWrapper
    v-model="showClearDialog"
    :title="$t('clearTopologyHistory')"
  >
    <div class="flex flex-col gap-4 p-2">
      <p class="text-sm">{{ $t('clearTopologyHistoryConfirm') }}</p>
      <div class="flex justify-end gap-2">
        <button
          class="btn btn-sm"
          @click="showClearDialog = false"
        >
          {{ $t('cancel') }}
        </button>
        <button
          class="btn btn-error btn-sm"
          @click="handleClearTopology"
        >
          {{ $t('confirm') }}
        </button>
      </div>
    </div>
  </DialogWrapper>
</template>

<script setup lang="ts">
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import {
  TIME_RANGE_OPTIONS,
  filterConnectionsByTimeRange,
  getOldestConnectionTime,
  getTimeRangeMs,
  type TimeRangeValue,
} from '@/composables/timeRange'
import { backgroundImage, clearTopoFlowsFromIndexedDB } from '@/helper/indexeddb'
import { showNotification } from '@/helper/notification'
import { getIPDisplayLabel } from '@/helper/sourceip'
import { useTooltip } from '@/helper/tooltip'
import { isMiddleScreen, prettyBytesHelper } from '@/helper/utils'
import { activeConnections, closedConnections } from '@/store/connections'
import { initTopoFlowsData, topoFlowsData, topoHistoryStartTime } from '@/store/connHistory'
import { rules } from '@/store/rules'
import { blurIntensity, dashboardTransparent, font, theme } from '@/store/settings'
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  QuestionMarkCircleIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'
import { useElementSize, useLocalStorage, useWindowSize } from '@vueuse/core'
import { SankeyChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { debounce } from 'lodash'
import { twMerge } from 'tailwind-merge'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

echarts.use([SankeyChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const { t } = useI18n()
const { showTip } = useTooltip()
const isFullScreen = ref(false)
const showClearDialog = ref(false)
const isPaused = ref(false)
const isDragPaused = ref(false)
const togglePause = () => {
  isPaused.value = !isPaused.value
  isDragPaused.value = false
}
const colorRef = ref()

// Build matchers from CGI rules payload format: "type: val1, val2 (+N more)"
// Used to find rule comments for topology node tooltips.
const ruleCommentMatchers = computed(() =>
  rules.value
    .filter((r) => r.comment)
    .map((r) => {
      const colonIdx = r.payload.indexOf(': ')
      if (colonIdx === -1) return null
      const type = r.payload.substring(0, colonIdx).trim()
      const firstValue = r.payload
        .substring(colonIdx + 2)
        .split(',')[0]
        .trim()
        .replace(/ \(\+\d+ more\)$/, '')
        .trim()
      return { type, firstValue, comment: r.comment! }
    })
    .filter((m): m is { type: string; firstValue: string; comment: string } => m !== null),
)
const chart = ref()
const fullScreenChart = ref()
const fullScreenMyChart = ref<echarts.ECharts>()
const { width: windowWidth, height: windowHeight } = useWindowSize()
const timeRange = useLocalStorage<TimeRangeValue>('stats-topology-timerange', 'all')
const metric = useLocalStorage<'download' | 'upload' | 'total' | 'count'>(
  'stats-topology-metric',
  'download',
)
const scaleMode = useLocalStorage<'log' | 'sqrt' | 'linear'>('stats-topology-scale', 'linear')

const shouldRotate = computed(() => {
  return isFullScreen.value && isMiddleScreen.value && windowHeight.value > windowWidth.value
})

const fullChartStyle = computed(() => {
  const baseStyle = `backdrop-filter: blur(${blurIntensity.value}px);`

  if (shouldRotate.value) {
    return `${baseStyle} transform: rotate(90deg); width: 100vh; height: 100vw; position: absolute; top: 50%; left: 50%; margin-top: -50vw; margin-left: -50vh;`
  }

  return baseStyle
})
const colorSet = {
  baseContent10: '',
  baseContent30: '',
  baseContent: '',
  base70: '',
}

let fontFamily = ''

const updateColorSet = () => {
  const colorStyle = getComputedStyle(colorRef.value)

  colorSet.baseContent = colorStyle.getPropertyValue('--color-base-content').trim()
  colorSet.baseContent10 = colorStyle.color
  colorSet.baseContent30 = colorStyle.borderColor
  colorSet.base70 = colorStyle.backgroundColor
}

const updateFontFamily = () => {
  const baseColorStyle = getComputedStyle(colorRef.value)
  fontFamily = baseColorStyle.fontFamily
}

const sankeyData = computed(() => {
  const nodeMap = new Map<string, number>()
  const nodeNameMap = new Map<string, string>()
  const linkMap = new Map<string, number>()
  const layerMap = new Map<string, number>()
  const nodeTypeMap = new Map<string, string>()
  let nodeIndex = 0

  const addNode = (name: string, layer: number, type: string) => {
    const nodeKey = `${layer}:${name}`
    if (!nodeMap.has(nodeKey)) {
      nodeMap.set(nodeKey, nodeIndex++)
      nodeNameMap.set(nodeKey, name)
      layerMap.set(nodeKey, layer)
      nodeTypeMap.set(nodeKey, type)
    }
    return nodeMap.get(nodeKey)!
  }

  const getMetricValue = (count: number, download: number, upload: number): number => {
    switch (metric.value) {
      case 'download':
        return download
      case 'upload':
        return upload
      case 'total':
        return download + upload
      case 'count':
        return count
    }
  }

  const addFlow = (
    sourceIP: string,
    ruleKey: string,
    chainLast: string,
    chainFirst: string,
    count: number,
    download: number,
    upload: number,
  ) => {
    const value = getMetricValue(count, download, upload)
    const sourceNode = addNode(sourceIP, 0, t('sourceIPAddress'))
    const ruleNode = addNode(ruleKey, 1, t('ruleMatch'))

    if (chainFirst === chainLast) {
      const chainExitNode = addNode(chainFirst, 3, t('proxyChainExit'))
      const link1 = `${sourceNode}-${ruleNode}`
      const link2 = `${ruleNode}-${chainExitNode}`
      linkMap.set(link1, (linkMap.get(link1) || 0) + value)
      linkMap.set(link2, (linkMap.get(link2) || 0) + value)
    } else {
      const chainLastNode = addNode(chainLast, 2, t('proxyChainEntry'))
      const chainFirstNode = addNode(chainFirst, 3, t('proxyChainExit'))
      const link1 = `${sourceNode}-${ruleNode}`
      const link2 = `${ruleNode}-${chainLastNode}`
      const link3 = `${chainLastNode}-${chainFirstNode}`
      linkMap.set(link1, (linkMap.get(link1) || 0) + value)
      linkMap.set(link2, (linkMap.get(link2) || 0) + value)
      linkMap.set(link3, (linkMap.get(link3) || 0) + value)
    }
  }

  if (timeRange.value === 'all') {
    // Use persistent topo flows for full history
    topoFlowsData.value.forEach((flow) => {
      addFlow(
        getIPDisplayLabel(flow.sourceIP),
        flow.ruleKey,
        flow.chainLast,
        flow.chainFirst,
        flow.count,
        flow.download,
        flow.upload,
      )
    })
    // Also include currently active connections (not yet persisted)
    activeConnections.value.forEach((conn) => {
      const chains = conn.chains || []
      if (chains.length === 0) return
      addFlow(
        getIPDisplayLabel(conn.metadata.sourceIP),
        conn.rulePayload ? `${conn.rule}: ${conn.rulePayload}` : conn.rule,
        chains[chains.length - 1],
        chains[0],
        1,
        conn.download ?? 0,
        conn.upload ?? 0,
      )
    })
  } else {
    const rangeMs = getTimeRangeMs(timeRange.value)
    const connections = filterConnectionsByTimeRange(
      [...closedConnections.value, ...activeConnections.value],
      rangeMs,
    )
    connections.forEach((conn) => {
      const chains = conn.chains || []
      if (chains.length === 0) return
      addFlow(
        getIPDisplayLabel(conn.metadata.sourceIP),
        conn.rulePayload ? `${conn.rule}: ${conn.rulePayload}` : conn.rule,
        chains[chains.length - 1],
        chains[0],
        1,
        conn.download ?? 0,
        conn.upload ?? 0,
      )
    })
  }

  if (nodeMap.size === 0) {
    return { nodes: [], links: [] }
  }

  // Compute per-node raw value totals from linkMap (outgoing or incoming for leaf nodes)
  const nodeOutgoing = new Map<number, number>()
  const nodeIncoming = new Map<number, number>()
  linkMap.forEach((value, link) => {
    const [src, tgt] = link.split('-').map(Number)
    nodeOutgoing.set(src, (nodeOutgoing.get(src) || 0) + value)
    nodeIncoming.set(tgt, (nodeIncoming.get(tgt) || 0) + value)
  })
  const getNodeValue = (idx: number) => nodeOutgoing.get(idx) ?? nodeIncoming.get(idx) ?? 0

  const formatNodeValue = (v: number): string => {
    if (metric.value === 'count') return String(Math.round(v))
    return prettyBytesHelper(v, { binary: false })
  }

  // 创建初始节点数组
  const initialNodes = Array.from(nodeMap.entries()).map(([nodeKey, index]) => ({
    id: index,
    name: nodeNameMap.get(nodeKey) || '',
    nodeType: nodeTypeMap.get(nodeKey) || t('unknown'),
    layer: layerMap.get(nodeKey) || 0,
    nodeValue: formatNodeValue(getNodeValue(index)),
    itemStyle: {
      color: layerColors[layerMap.get(nodeKey) || 0],
    },
  }))

  // 按层分组节点
  const nodesByLayer = new Map<number, typeof initialNodes>()
  initialNodes.forEach((node) => {
    const layer = node.layer
    if (!nodesByLayer.has(layer)) {
      nodesByLayer.set(layer, [])
    }
    nodesByLayer.get(layer)!.push(node)
  })

  // 对每一层的节点按名称进行字典排序
  const sortedLayers = Array.from(nodesByLayer.keys()).sort((a, b) => a - b)
  const idMapping = new Map<number, number>() // 旧 id -> 新 id 映射
  const sortedNodes: typeof initialNodes = []
  let newId = 0

  sortedLayers.forEach((layer) => {
    const layerNodes = nodesByLayer.get(layer)!
    // 对当前层的节点按名称进行字典排序
    layerNodes.sort((a, b) => a.name.localeCompare(b.name))
    // 重新分配 id
    layerNodes.forEach((node) => {
      idMapping.set(node.id, newId)
      sortedNodes.push({
        ...node,
        id: newId,
      })
      newId++
    })
  })

  const rawLinkValues = Array.from(linkMap.values())
  const maxRaw = rawLinkValues.length > 0 ? Math.max(...rawLinkValues) : 1

  const minSqrt = Math.sqrt(maxRaw + 1) * 0.05
  const minLinear = maxRaw * 0.05

  const scaleLink = (value: number): number => {
    if (scaleMode.value === 'sqrt') return Math.max(minSqrt, Math.sqrt(value + 1))
    if (scaleMode.value === 'log') return Math.log10(value + 1) * 10
    return Math.max(minLinear, value)
  }

  const links = Array.from(linkMap.entries()).map(([link, value]) => {
    const [oldSource, oldTarget] = link.split('-').map(Number)
    const source = idMapping.get(oldSource)!
    const target = idMapping.get(oldTarget)!
    return {
      source,
      target,
      value: scaleLink(value),
      originalValue: value,
    }
  })

  return { nodes: sortedNodes, links }
})

const handleClearTopology = async () => {
  try {
    await clearTopoFlowsFromIndexedDB()
    await initTopoFlowsData()
    showClearDialog.value = false
    showNotification({ content: t('clearTopologyHistorySuccess'), type: 'alert-success' })
  } catch (error) {
    console.error('Failed to clear topology history:', error)
    showNotification({ content: `${t('saveFailed')}: ${error}`, type: 'alert-error' })
  }
}

const chartTip = computed(() => {
  if (timeRange.value === 'all') {
    const note =
      topoHistoryStartTime.value !== null
        ? t('chartTipAllHistory', {
            time: `${dayjs(topoHistoryStartTime.value).format('YYYY-MM-DD HH:mm')} (${dayjs(topoHistoryStartTime.value).fromNow()})`,
          })
        : t('chartTipAllHistoryUnknown')
    return t('connectionTopologyTip', { note })
  }
  const connections = filterConnectionsByTimeRange(
    [...closedConnections.value, ...activeConnections.value],
    getTimeRangeMs(timeRange.value),
  )
  const ts = getOldestConnectionTime(connections)
  const note = t('chartTipTimeLimited', {
    time: ts !== null ? new Date(ts).toLocaleString() : '—',
  })
  return t('connectionTopologyTip', { note })
})

const layerColors = ['#6a6fc5', '#a8d4a0', '#fddb8a', '#f2a0a0']

const options = computed(() => {
  const commentMatchers = ruleCommentMatchers.value
  const ruleMatchLabel = t('ruleMatch')

  return {
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: fontFamily || 'inherit',
      color: colorSet.baseContent,
    },
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: colorSet.base70,
      borderColor: colorSet.baseContent30,
      textStyle: {
        color: colorSet.baseContent,
      },
      formatter: (params: {
        dataType: string
        data: {
          name: string
          nodeType?: string
          nodeValue?: string
          source: number
          target: number
          value: number
          originalValue?: number
        }
      }) => {
        const boldNodeTypes = new Set([
          t('sourceIPAddress'),
          t('proxyChainEntry'),
          t('proxyChainExit'),
        ])
        if (params.dataType === 'node') {
          const lines: string[] = []
          if (params.data.nodeType === ruleMatchLabel) {
            const match = commentMatchers.find(
              (m) =>
                params.data.name.startsWith(m.type + '=') &&
                params.data.name.includes(m.firstValue),
            )
            if (match) lines.push(`<b>${match.comment}</b>`)
          }
          const nameLine = boldNodeTypes.has(params.data.nodeType ?? '')
            ? `<b>${params.data.name}</b>`
            : params.data.name
          lines.push(nameLine, `${t('nodeType')}: ${params.data.nodeType || t('unknown')}`)
          if (params.data.nodeValue)
            lines.push(
              `${t(metric.value === 'count' ? 'connectionCount' : metric.value)}: ${params.data.nodeValue}`,
            )
          return lines.join('<br/>')
        } else if (params.dataType === 'edge') {
          const sourceNode = sankeyData.value.nodes.find((n) => n.id === params.data.source)
          const targetNode = sankeyData.value.nodes.find((n) => n.id === params.data.target)
          const displayValue = params.data.originalValue ?? params.data.value
          const isBytes = metric.value !== 'count'
          const formattedValue = isBytes
            ? prettyBytesHelper(displayValue, { binary: false })
            : String(Math.round(displayValue))
          const metricLabel = t(metric.value === 'count' ? 'connectionCount' : metric.value)

          // If the edge touches a rule node, show same structure as the node tooltip
          const ruleNode = [sourceNode, targetNode].find((n) => n?.nodeType === ruleMatchLabel)
          if (ruleNode) {
            const lines: string[] = []
            const comment = commentMatchers.find(
              (m) => ruleNode.name.startsWith(m.type + '=') && ruleNode.name.includes(m.firstValue),
            )?.comment
            if (comment) lines.push(`<b>${comment}</b>`)
            lines.push(ruleNode.name, `${t('nodeType')}: ${ruleNode.nodeType}`)
            lines.push(`${metricLabel}: ${formattedValue}`)
            return lines.join('<br/>')
          }

          // Non-rule edges: show flow direction + metric
          const lines: string[] = []
          if (sourceNode && targetNode) {
            const boldNode = [sourceNode, targetNode].find((n) =>
              boldNodeTypes.has(n.nodeType ?? ''),
            )
            if (boldNode) {
              lines.push(`<b>${boldNode.name}</b>`)
              lines.push(`${t('nodeType')}: ${boldNode.nodeType}`)
            } else {
              lines.push(`${sourceNode.name} → ${targetNode.name}`)
            }
          }
          lines.push(`${metricLabel}: ${formattedValue}`)
          return lines.join('<br/>')
        }
        return ''
      },
    },
    series: [
      {
        id: 'sankey',
        type: 'sankey',
        layout: 'none',
        data: sankeyData.value.nodes,
        links: sankeyData.value.links,
        emphasis: {
          focus: 'trajectory',
        },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
        },
        itemStyle: {
          borderWidth: 0,
        },
        label: {
          color: colorSet.baseContent,
          fontSize: isMiddleScreen.value ? 10 : 12,
          formatter: (params: { name: string }) => {
            const name = params.name
            const length = isFullScreen.value ? 45 : isMiddleScreen.value ? 20 : 30
            return name.length > length ? name.substring(0, length) + '...' : name
          },
        },
        nodeGap: 4,
        nodeWidth: 20,
        nodeAlign: 'left',
        animation: true,
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        animationDelay: (idx: number) => idx * 50,
      },
    ],
  }
})

// Compute HTML overlay positions for Sankey node value labels.
// Sankey nodes store layout as { x, y, dx, dy } on graph nodes (not getData().getItemLayout()).
// Coordinates are relative to seriesModel.layoutInfo, offset from the canvas edge.
interface NodeOverlay {
  id: string
  x: number
  y: number
  w: number
  h: number
  text: string
}

const nodeOverlays = ref<NodeOverlay[]>([])
const fullScreenNodeOverlays = ref<NodeOverlay[]>([])

const computeNodeOverlays = (
  chartInstance: echarts.ECharts,
  chartEl: HTMLElement | null | undefined,
): NodeOverlay[] => {
  const nodes = sankeyData.value.nodes
  if (nodes.length === 0) return []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seriesModel = (chartInstance as any).getModel().getSeriesByIndex(0)
    const layoutInfo = seriesModel.layoutInfo as { x: number; y: number }
    const graphNodes = seriesModel.getGraph().nodes as Array<{
      dataIndex: number
      getLayout: () => { x: number; y: number; dx: number; dy: number } | undefined
    }>
    const offsetTop = chartEl?.offsetTop ?? 0
    const offsetLeft = chartEl?.offsetLeft ?? 0
    const overlays: NodeOverlay[] = []
    nodes.forEach((_node, idx) => {
      if (!_node.nodeValue) return
      const graphNode = graphNodes.find((n) => n.dataIndex === idx)
      if (!graphNode) return
      const layout = graphNode.getLayout()
      if (!layout) return
      const { x, y, dx, dy } = layout
      if (dy < 14) return
      overlays.push({
        id: `node-val-${idx}`,
        x: Math.round(offsetLeft + layoutInfo.x + x),
        y: Math.round(offsetTop + layoutInfo.y + y),
        w: Math.round(dx),
        h: Math.round(dy),
        text: _node.nodeValue,
      })
    })
    return overlays
  } catch {
    return []
  }
}

const updateNodeValueGraphics = (chartInstance: echarts.ECharts) => {
  nodeOverlays.value = computeNodeOverlays(chartInstance, chart.value)
}

const updateFullScreenNodeValueGraphics = (chartInstance: echarts.ECharts) => {
  fullScreenNodeOverlays.value = computeNodeOverlays(chartInstance, fullScreenChart.value)
}

onMounted(() => {
  updateColorSet()
  updateFontFamily()

  watch(theme, updateColorSet)
  watch(font, updateFontFamily)

  const myChart = echarts.init(chart.value)

  myChart.setOption(options.value)
  nextTick(() => updateNodeValueGraphics(myChart))
  myChart.on('finished', () => updateNodeValueGraphics(myChart))
  myChart.on('showTip', () => {
    isPaused.value = true
  })
  myChart.on('hideTip', () => {
    if (!isDragPaused.value) isPaused.value = false
  })
  myChart.on('mousedown', { seriesType: 'sankey' }, () => {
    isDragPaused.value = true
    isPaused.value = true
  })

  const updateChartData = debounce((newData: typeof sankeyData.value) => {
    if (isPaused.value) {
      return
    }

    if (myChart && newData.nodes.length > 0) {
      myChart.setOption(options.value)
      nextTick(() => updateNodeValueGraphics(myChart))
    } else if (myChart && newData.nodes.length === 0) {
      myChart.clear()
      nodeOverlays.value = []
    }

    if (isFullScreen.value) {
      nextTick(() => {
        if (!fullScreenMyChart.value) {
          fullScreenMyChart.value = echarts.init(fullScreenChart.value)
          // 为全屏图表也添加事件监听
          fullScreenMyChart.value.on('showTip', () => {
            isPaused.value = true
          })
          fullScreenMyChart.value.on('hideTip', () => {
            isPaused.value = false
          })
        }
        if (fullScreenMyChart.value && newData.nodes.length > 0) {
          fullScreenMyChart.value.setOption(options.value)
          nextTick(() => updateFullScreenNodeValueGraphics(fullScreenMyChart.value!))
        } else if (fullScreenMyChart.value && newData.nodes.length === 0) {
          fullScreenMyChart.value.clear()
          fullScreenNodeOverlays.value = []
        }
      })
    }
  }, 300)

  watch(sankeyData, updateChartData, { deep: true })

  watch(scaleMode, () => {
    myChart.setOption(options.value)
    nextTick(() => updateNodeValueGraphics(myChart))
    if (fullScreenMyChart.value) {
      fullScreenMyChart.value.setOption(options.value)
      nextTick(() => updateFullScreenNodeValueGraphics(fullScreenMyChart.value!))
    }
  })

  watch([theme, font], () => {
    if (myChart) {
      myChart.setOption(options.value)
      nextTick(() => updateNodeValueGraphics(myChart))
    }
    if (fullScreenMyChart.value) {
      fullScreenMyChart.value.setOption(options.value)
      nextTick(() => updateFullScreenNodeValueGraphics(fullScreenMyChart.value!))
    }
  })

  watch(isFullScreen, () => {
    if (isFullScreen.value) {
      nextTick(() => {
        if (!fullScreenMyChart.value) {
          fullScreenMyChart.value = echarts.init(fullScreenChart.value)
          // 为全屏图表也添加事件监听
          fullScreenMyChart.value.on('showTip', () => {
            isPaused.value = true
          })
          fullScreenMyChart.value.on('hideTip', () => {
            if (!isDragPaused.value) isPaused.value = false
          })
          fullScreenMyChart.value.on('mousedown', { seriesType: 'sankey' }, () => {
            isDragPaused.value = true
            isPaused.value = true
          })
          fullScreenMyChart.value.on('finished', () => {
            if (fullScreenMyChart.value) updateFullScreenNodeValueGraphics(fullScreenMyChart.value)
          })
        }
        if (fullScreenMyChart.value && sankeyData.value.nodes.length > 0) {
          fullScreenMyChart.value.setOption(options.value)
          nextTick(() => updateFullScreenNodeValueGraphics(fullScreenMyChart.value!))
        }
      })
    } else {
      fullScreenMyChart.value?.dispose()
      fullScreenMyChart.value = undefined
      fullScreenNodeOverlays.value = []
    }
  })

  const { width } = useElementSize(chart)
  const resize = debounce(() => {
    myChart.resize()
    updateNodeValueGraphics(myChart)
    fullScreenMyChart.value?.resize()
    if (fullScreenMyChart.value) updateFullScreenNodeValueGraphics(fullScreenMyChart.value)
  }, 100)

  watch(width, resize)

  // 监听窗口大小变化和旋转状态变化，确保全屏图表正确调整大小
  watch([windowWidth, windowHeight, shouldRotate], () => {
    if (isFullScreen.value && fullScreenMyChart.value) {
      nextTick(() => {
        fullScreenMyChart.value?.resize()
      })
    }
  })
})

onUnmounted(() => {
  if (chart.value) {
    const myChart = echarts.getInstanceByDom(chart.value)
    if (myChart) {
      myChart.dispose()
    }
  }
  if (fullScreenMyChart.value) {
    fullScreenMyChart.value.dispose()
    fullScreenMyChart.value = undefined
  }
})
</script>
