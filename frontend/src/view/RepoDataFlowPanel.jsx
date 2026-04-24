/**
 * Interactive data-flow map for an uploaded repository (force-directed graph).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

const GROUP_COLORS = {
  entry: '#7c4dff',
  api: '#00acc1',
  service: '#26a69a',
  data: '#ef5350',
  external: '#fb8c00',
  infra: '#78909c',
  other: '#90a4ae',
}

function groupColor(node) {
  return GROUP_COLORS[node.group] || GROUP_COLORS.other
}

/**
 * @param {object} props
 * @param {object} props.theme Colors from RepositoriesView (text, border, surfaceElevated, primary, error).
 * @param {'light'|'dark'} props.themeName
 * @param {{ nodes: object[], links: object[] } | null} props.graphData
 * @param {boolean} props.loading
 * @param {string | null} props.error
 * @param {() => void} props.onGenerate
 * @param {boolean} props.hasCached
 */
export default function RepoDataFlowPanel({
  theme,
  themeName,
  graphData,
  loading,
  error,
  onGenerate,
  hasCached,
}) {
  const graphRef = useRef(null)
  const wrapRef = useRef(null)
  const [dims, setDims] = useState({ w: 640, h: 440 })

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setDims({ w: Math.max(280, Math.floor(r.width)), h: 440 })
    })
    ro.observe(el)
    const r = el.getBoundingClientRect()
    setDims({ w: Math.max(280, Math.floor(r.width)), h: 440 })
    return () => ro.disconnect()
  }, [])

  const fgData = useMemo(() => {
    try {
      if (!graphData || typeof graphData !== 'object') return null
      const rawNodes = graphData.nodes
      const rawLinks = graphData.links
      if (!Array.isArray(rawNodes) || rawNodes.length === 0) return null
      const nodes = []
      const seen = new Set()
      for (let i = 0; i < rawNodes.length; i += 1) {
        const n = rawNodes[i]
        if (!n || typeof n !== 'object') continue
        let id = n.id != null ? String(n.id).trim() : ''
        const label = n.label != null ? String(n.label).trim() : ''
        if (!id) id = label ? `n_${i}_${label.slice(0, 40)}` : `node_${i}`
        id = id.replace(/\s+/g, '_').slice(0, 96)
        if (!id || seen.has(id)) id = `${id || 'n'}_${i}`
        seen.add(id)
        nodes.push({
          ...n,
          id,
          label: (label || id).slice(0, 120),
          group: typeof n.group === 'string' ? n.group : 'other',
        })
      }
      if (!nodes.length) return null
      const idSet = new Set(nodes.map((x) => x.id))
      const links = []
      if (Array.isArray(rawLinks)) {
        for (const l of rawLinks) {
          if (!l || typeof l !== 'object') continue
          const s = l.source != null ? String(l.source) : ''
          const t = l.target != null ? String(l.target) : ''
          if (!s || !t || s === t || !idSet.has(s) || !idSet.has(t)) continue
          links.push({
            ...l,
            source: s,
            target: t,
            label: l.label != null ? String(l.label).slice(0, 48) : '',
          })
        }
      }
      return { nodes, links }
    } catch {
      return null
    }
  }, [graphData])

  useEffect(() => {
    if (!fgData) return undefined
    const id = window.setTimeout(() => {
      graphRef.current?.zoomToFit(480, 72)
    }, 280)
    return () => window.clearTimeout(id)
  }, [fgData])

  const drawNode = useCallback(
    (node, ctx, globalScale) => {
      const x = node.x
      const y = node.y
      if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) return
      const gs = Math.max(Number(globalScale) || 1, 0.08)
      const label = node.label || node.id
      const fontSize = Math.max(10, 13 / gs)
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`
      const padX = 11 / gs
      const padY = 6 / gs
      const tw = ctx.measureText(label).width
      const w = tw + padX * 2
      const h = fontSize + padY * 2
      const rx = x - w / 2
      const ry = y - h / 2
      const rad = Math.min(12 / gs, h / 2.2)
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(rx, ry, w, h, rad)
      } else {
        ctx.rect(rx, ry, w, h)
      }
      const g = ctx.createLinearGradient(rx, ry, rx + w, ry + h)
      const base = groupColor(node)
      g.addColorStop(0, base)
      g.addColorStop(1, themeName === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)')
      ctx.fillStyle = g
      ctx.fill()
      ctx.strokeStyle = themeName === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.14)'
      ctx.lineWidth = 1.2 / gs
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fff'
      ctx.fillText(label, x, y)
    },
    [themeName],
  )

  const paintPointer = useCallback((node, color, ctx, globalScale) => {
    const px = node.x
    const py = node.y
    if (px == null || py == null || Number.isNaN(px) || Number.isNaN(py)) return
    const gs = Math.max(Number(globalScale) || 1, 0.08)
    const label = node.label || node.id
    const fontSize = Math.max(10, 13 / gs)
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`
    const padX = 11 / gs
    const padY = 6 / gs
    const tw = ctx.measureText(label).width
    const w = tw + padX * 2
    const h = fontSize + padY * 2
    ctx.fillStyle = color
    ctx.fillRect(px - w / 2, py - h / 2, w, h)
  }, [])

  const linkColor = useCallback(
    () => (themeName === 'dark' ? 'rgba(129, 173, 248, 0.55)' : 'rgba(0, 102, 204, 0.45)'),
    [themeName],
  )

  return (
    <div
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        background: `linear-gradient(165deg, ${theme.surface} 0%, ${theme.surfaceElevated} 55%, ${theme.surface} 100%)`,
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          borderBottom: `1px solid ${theme.border}`,
          backgroundColor: theme.surfaceElevated,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: theme.text, fontSize: '15px' }}>Data flow map</div>
          <div style={{ fontSize: '12px', color: theme.textSecondary, marginTop: '2px' }}>
            AI-inferred paths: UI → APIs → services → storage & externals
          </div>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: theme.primary,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.75 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Building…' : hasCached ? 'Regenerate map' : 'Generate map'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', color: theme.error, fontSize: '14px', backgroundColor: theme.surface }}>
          {error}
        </div>
      )}

      <div style={{ padding: '12px 16px 8px', display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '11px' }}>
        {Object.entries(GROUP_COLORS).map(([g, c]) => (
          <span key={g} style={{ color: theme.textSecondary, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c, flexShrink: 0 }} />
            {g}
          </span>
        ))}
      </div>

      <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
        {!fgData && !loading && (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: theme.textSecondary,
              fontSize: '14px',
              maxWidth: 420,
              margin: '0 auto',
            }}
          >
            Generate an interactive map of how requests and data move through this codebase. Drag nodes, scroll to zoom,
            and follow arrows along the edges.
          </div>
        )}
        {loading && !fgData && (
          <div style={{ padding: '80px', textAlign: 'center', color: theme.primary, fontWeight: 600 }}>Mapping flow…</div>
        )}
        {fgData && (
          <ForceGraph2D
            ref={graphRef}
            graphData={fgData}
            width={dims.w}
            height={dims.h}
            backgroundColor="transparent"
            nodeCanvasObject={drawNode}
            nodePointerAreaPaint={paintPointer}
            linkColor={linkColor}
            linkWidth={1.8}
            linkDirectionalArrowLength={5}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.14}
            linkDirectionalParticles={0}
            linkLabel={(link) => (link && link.label) || ''}
            cooldownTicks={140}
            d3VelocityDecay={0.35}
            onEngineStop={() => graphRef.current?.zoomToFit(500, 72)}
          />
        )}
        {fgData && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {[
              { t: '+', fn: () => graphRef.current?.zoom(1.22, 320), title: 'Zoom in' },
              { t: '-', fn: () => graphRef.current?.zoom(0.82, 320), title: 'Zoom out' },
              { t: '⊡', fn: () => graphRef.current?.zoomToFit(400, 72), title: 'Fit' },
            ].map((b) => (
              <button
                key={b.title}
                type="button"
                title={b.title}
                onClick={b.fn}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: `1px solid ${theme.border}`,
                  background: theme.surfaceElevated,
                  color: theme.text,
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                }}
              >
                {b.t}
              </button>
            ))}
          </div>
        )}
        {fgData && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '12px',
              color: theme.textSecondary,
              padding: '4px 8px 12px',
            }}
          >
            {fgData.nodes.length} nodes · {fgData.links.length} flows
          </div>
        )}
      </div>
    </div>
  )
}
