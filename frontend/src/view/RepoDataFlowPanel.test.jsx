/**
 * Unit tests for ``RepoDataFlowPanel``: empty state, mocked force graph props,
 * malformed graph payloads (``react-force-graph-2d`` is stubbed).
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import RepoDataFlowPanel from './RepoDataFlowPanel'

vi.mock('react-force-graph-2d', () => ({
  default: React.forwardRef(function MockForceGraph(props, ref) {
    React.useImperativeHandle(ref, () => ({
      zoomToFit: vi.fn(),
      zoom: vi.fn(),
    }))
    return (
      <div
        data-testid="force-graph"
        data-node-count={props.graphData?.nodes?.length ?? 0}
        data-link-count={props.graphData?.links?.length ?? 0}
      />
    )
  }),
}))

const theme = {
  text: '#111',
  textSecondary: '#666',
  border: '#ccc',
  surface: '#f5f5f5',
  surfaceElevated: '#fff',
  primary: '#06c',
  error: '#c00',
}

describe('RepoDataFlowPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows empty state and generate when there is no graph', () => {
    render(
      <RepoDataFlowPanel
        theme={theme}
        themeName="light"
        graphData={null}
        loading={false}
        error={null}
        onGenerate={() => {}}
        hasCached={false}
      />,
    )
    expect(screen.getByText(/Generate an interactive map/i)).toBeTruthy()
    expect(screen.queryByTestId('force-graph')).toBeNull()
  })

  it('renders force graph with sanitized node and link counts', () => {
    const graph = {
      nodes: [
        { id: 'a', label: 'API', group: 'api' },
        { id: 'b', label: 'DB', group: 'data' },
      ],
      links: [{ source: 'a', target: 'b', label: 'SQL' }],
    }
    render(
      <RepoDataFlowPanel
        theme={theme}
        themeName="light"
        graphData={graph}
        loading={false}
        error={null}
        onGenerate={() => {}}
        hasCached
      />,
    )
    const fg = screen.getByTestId('force-graph')
    expect(fg.dataset.nodeCount).toBe('2')
    expect(fg.dataset.linkCount).toBe('1')
  })

  it('does not mount force graph when nodes are not a valid array', () => {
    render(
      <RepoDataFlowPanel
        theme={theme}
        themeName="light"
        graphData={{ nodes: 'invalid', links: [] }}
        loading={false}
        error={null}
        onGenerate={() => {}}
        hasCached={false}
      />,
    )
    expect(screen.queryByTestId('force-graph')).toBeNull()
    expect(screen.getByText(/Generate an interactive map/i)).toBeTruthy()
  })
})
