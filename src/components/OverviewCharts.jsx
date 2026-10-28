import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from './ui/resizable'
import { OVERVIEW_ALIGNED_SIZE, snapOverviewSize } from '../lib/chart-layout'
import './overview-charts.css'

const layoutStyle = {
  '--overview-columns': `minmax(0, ${OVERVIEW_ALIGNED_SIZE}fr) minmax(0, ${100 - OVERVIEW_ALIGNED_SIZE}fr)`,
}
const atAlignment = size => Math.abs(size - OVERVIEW_ALIGNED_SIZE) < 0.000001

export default function OverviewCharts({ trend, balance, breakdown, recent, autoSaveId, expanded = false }) {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1020px)').matches)
  const [aligned, setAligned] = useState(true)
  const [dragging, setDragging] = useState(false)
  const rowRef = useRef(null)
  const trendRef = useRef(null)
  const dragRef = useRef(false)
  const latchedRef = useRef(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1020px)')
    const change = event => setCompact(event.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  const onLayout = useCallback(sizes => {
    if (!Number.isFinite(sizes[0])) return
    const row = rowRef.current
    const handle = row?.querySelector('[data-panel-resize-handle-id]')
    const availableWidth = row && handle ? row.getBoundingClientRect().width - handle.getBoundingClientRect().width : 0
    const next = snapOverviewSize(sizes[0], availableWidth, dragRef.current && latchedRef.current)
    latchedRef.current = atAlignment(next)
    setAligned(atAlignment(next))
    // Keep the primitive's pointer tracking, constraints, keyboard support and
    // persistence; only correct the size when entering the alignment target.
    if (Math.abs(next - sizes[0]) > 0.000001) trendRef.current?.resize(next)
  }, [])

  const onDragging = useCallback(active => {
    dragRef.current = active
    latchedRef.current = false
    setDragging(active)
  }, [])

  return <div className="overview-charts" style={layoutStyle} data-expanded={expanded || undefined} data-dragging={dragging || undefined} data-aligned={aligned || undefined}>
    {compact ? <div className="overview-compact-charts">
      <div className="overview-chart-slot overview-trend">{trend}</div>
      {!expanded && <div className="overview-chart-slot overview-balance">{balance}</div>}
      <div className="overview-chart-slot overview-breakdown">{breakdown}</div>
      <div className="overview-chart-slot overview-recent">{recent}</div>
    </div> : <>
      <div className="overview-resizable-row" ref={rowRef}>
        <ResizablePanelGroup direction="horizontal" autoSaveId={autoSaveId} onLayout={onLayout} keyboardResizeBy={2}>
          <ResizablePanel ref={trendRef} defaultSize={OVERVIEW_ALIGNED_SIZE} minSize={48}>{trend}</ResizablePanel>
          <ResizableHandle className="overview-resize-handle" onDragging={onDragging}
            aria-label="调整图表宽度" aria-valuetext={aligned ? '已与逐月结余对齐' : undefined}
            title="调整图表宽度，靠近逐月结余边缘时吸附"><span/></ResizableHandle>
          <ResizablePanel defaultSize={100 - OVERVIEW_ALIGNED_SIZE} minSize={30}>{breakdown}</ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div className="overview-lower-row">{!expanded && balance}{recent}</div>
    </>}
  </div>
}
