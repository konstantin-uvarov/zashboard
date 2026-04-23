<template>
  <div class="card pb-4">
    <div class="card-title absolute z-10 flex w-full items-center justify-between px-4 pt-4">
      <div class="flex items-center gap-2">
        {{ $t('connectionTopology') }}
        <QuestionMarkCircleIcon
          class="h-4 w-4 cursor-pointer font-normal"
          @mouseenter="showTip($event, chartTip)"
        />
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="metric"
          class="select select-sm font-normal"
        >
          <option value="download">{{ $t('download') }}</option>
          <option value="upload">{{ $t('upload') }}</option>
          <option value="total">{{ $t('total') }}</option>
          <option value="count">{{ $t('connectionCount') }}</option>
        </select>
        <select
          v-model="timeRange"
          class="select select-sm font-normal"
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
    <div
      :class="twMerge('relative h-144 w-full overflow-hidden pt-12')"
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
          @click="isPaused = !isPaused"
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
      <div class="fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)] flex flex-col gap-1">
        <button
          class="btn btn-ghost btn-circle btn-sm"
          @click="isPaused = !isPaused"
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
</template>

<script setup lang="ts">
import {
  TIME_RANGE_OPTIONS,
  filterConnectionsByTimeRange,
  getOldestConnectionTime,
  getTimeRangeMs,
  type TimeRangeValue,
} from '@/composables/timeRange'
import { backgroundImage } from '@/helper/indexeddb'
import { getIPDisplayLabel } from '@/helper/sourceip'
import { useTooltip } from '@/helper/tooltip'
import { isMiddleScreen, prettyBytesHelper } from '@/helper/utils'
import { activeConnections, closedConnections } from '@/store/connections'
import { topoFlowsData } from '@/store/connHistory'
import { blurIntensity, dashboardTransparent, font, theme } from '@/store/settings'
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  QuestionMarkCircleIcon,
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
const startTime = useLocalStorage<number>('cache/connection-history-stats-start-time', Date.now())
const isFullScreen = ref(false)
const isPaused = ref(false)
const colorRef = ref()
const chart = ref()
const fullScreenChart = ref()
const fullScreenMyChart = ref<echarts.ECharts>()
const { width: windowWidth, height: windowHeight } = useWindowSize()
const timeRange = useLocalStorage<TimeRangeValue>('stats-topology-timerange', 'all')
const metric = useLocalStorage<'download' | 'upload' | 'total' | 'count'>(
  'stats-topology-metric',
  'download',
)

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
  const linkMap = new Map<string, number>()
  const layerMap = new Map<string, number>()
  const nodeTypeMap = new Map<string, string>()
  let nodeIndex = 0

  const addNode = (name: string, layer: number, type: string) => {
    if (!nodeMap.has(name)) {
      nodeMap.set(name, nodeIndex++)
      layerMap.set(name, layer)
      nodeTypeMap.set(name, type)
    }
    return nodeMap.get(name)!
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
  const initialNodes = Array.from(nodeMap.entries()).map(([name, index]) => ({
    id: index,
    name: name,
    nodeType: nodeTypeMap.get(name) || t('unknown'),
    layer: layerMap.get(name) || 0,
    nodeValue: formatNodeValue(getNodeValue(index)),
    itemStyle: {
      color: layerColors[layerMap.get(name) || 0],
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

  // 更新 links 中的 source 和 target 引用
  const links = Array.from(linkMap.entries()).map(([link, value]) => {
    const [oldSource, oldTarget] = link.split('-').map(Number)
    const source = idMapping.get(oldSource)!
    const target = idMapping.get(oldTarget)!
    // 使用对数缩放来压缩数据范围，使小值更明显
    // 公式: log10(value + 1) * 10，确保最小值为0，同时保持相对大小关系
    const scaledValue = Math.log10(value + 1) * 10
    return {
      source,
      target,
      value: scaledValue,
      originalValue: value, // 保存原始值用于 tooltip 显示
    }
  })

  return { nodes: sortedNodes, links }
})

const chartTip = computed(() => {
  if (timeRange.value === 'all') {
    const d = dayjs(startTime.value)
    return t('connectionTopologyTip', {
      note: t('chartTipAllHistory', {
        time: `${d.format('YYYY-MM-DD HH:mm')} (${d.fromNow()})`,
      }),
    })
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

const options = computed(() => ({
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
      if (params.dataType === 'node') {
        const lines = [
          `${params.data.name}`,
          `${t('nodeType')}: ${params.data.nodeType || t('unknown')}`,
        ]
        if (params.data.nodeValue)
          lines.push(
            `${t(metric.value === 'count' ? 'connectionCount' : metric.value)}: ${params.data.nodeValue}`,
          )
        return lines.join('<br/>')
      } else if (params.dataType === 'edge') {
        const sourceNode = sankeyData.value.nodes.find((n) => n.id === params.data.source)
        const targetNode = sankeyData.value.nodes.find((n) => n.id === params.data.target)
        // 使用原始值显示真实的连接数量
        const displayValue = params.data.originalValue ?? params.data.value
        const isBytes = metric.value !== 'count'
        const formattedValue = isBytes
          ? prettyBytesHelper(displayValue, { binary: false })
          : String(Math.round(displayValue))
        const metricLabel = t(metric.value === 'count' ? 'connectionCount' : metric.value)
        if (sourceNode && targetNode) {
          return `${sourceNode.name} → ${targetNode.name}<br/>${metricLabel}: ${formattedValue}`
        }
        return `${metricLabel}: ${formattedValue}`
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
}))

// Overlays metric values as text inside each Sankey node rectangle using ECharts graphic elements.
// Node positions are read from ECharts' internal layout after setOption completes.
const updateNodeValueGraphics = (chartInstance: echarts.ECharts) => {
  const nodes = sankeyData.value.nodes
  if (nodes.length === 0) {
    chartInstance.setOption({ graphic: [] }, { replaceMerge: ['graphic'] } as Parameters<
      typeof chartInstance.setOption
    >[1])
    return
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (chartInstance as any).getModel().getSeriesByIndex(0).getData()
    const elements: object[] = []
    nodes.forEach((node, idx) => {
      if (!node.nodeValue) return
      const layout = data.getItemLayout(idx) as
        | { x: number; y: number; width: number; height: number }
        | undefined
      if (!layout) return
      const { x, y, width, height } = layout
      if (height < 14) return
      elements.push({
        type: 'text',
        x: x + width / 2,
        y: y + height / 2,
        rotation: -Math.PI / 2,
        style: {
          text: node.nodeValue,
          fill: 'rgba(255,255,255,0.9)',
          fontSize: 9,
          fontWeight: 'bold',
          align: 'center',
          verticalAlign: 'middle',
        },
        silent: true,
        z: 200,
      })
    })
    chartInstance.setOption({ graphic: elements }, { replaceMerge: ['graphic'] } as Parameters<
      typeof chartInstance.setOption
    >[1])
  } catch {
    // internal API unavailable
  }
}

onMounted(() => {
  updateColorSet()
  updateFontFamily()

  watch(theme, updateColorSet)
  watch(font, updateFontFamily)

  const myChart = echarts.init(chart.value)

  myChart.setOption(options.value)
  updateNodeValueGraphics(myChart)
  myChart.on('showTip', () => {
    isPaused.value = true
  })
  myChart.on('hideTip', () => {
    isPaused.value = false
  })

  const updateChartData = debounce((newData: typeof sankeyData.value) => {
    if (isPaused.value) {
      return
    }

    if (myChart && newData.nodes.length > 0) {
      myChart.setOption(options.value)
      updateNodeValueGraphics(myChart)
    } else if (myChart && newData.nodes.length === 0) {
      myChart.clear()
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
          updateNodeValueGraphics(fullScreenMyChart.value)
        } else if (fullScreenMyChart.value && newData.nodes.length === 0) {
          fullScreenMyChart.value.clear()
        }
      })
    }
  }, 300)

  watch(sankeyData, updateChartData, { deep: true })

  watch([theme, font], () => {
    if (myChart) {
      myChart.setOption(options.value)
      updateNodeValueGraphics(myChart)
    }
    if (fullScreenMyChart.value) {
      fullScreenMyChart.value.setOption(options.value)
      updateNodeValueGraphics(fullScreenMyChart.value)
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
            isPaused.value = false
          })
        }
        if (fullScreenMyChart.value && sankeyData.value.nodes.length > 0) {
          fullScreenMyChart.value.setOption(options.value)
          updateNodeValueGraphics(fullScreenMyChart.value)
        }
      })
    } else {
      fullScreenMyChart.value?.dispose()
      fullScreenMyChart.value = undefined
    }
  })

  const { width } = useElementSize(chart)
  const resize = debounce(() => {
    myChart.resize()
    updateNodeValueGraphics(myChart)
    fullScreenMyChart.value?.resize()
    if (fullScreenMyChart.value) updateNodeValueGraphics(fullScreenMyChart.value)
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
