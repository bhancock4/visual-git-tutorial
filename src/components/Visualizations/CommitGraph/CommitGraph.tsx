import { useMemo } from 'react';
import { useApp } from '../../../state/AppContext';
import { buildGraph, NODE_RADIUS, X_SPACING, PADDING_X, PADDING_Y } from './graphLayout';
import './CommitGraph.css';

export function CommitGraph() {
  const { state } = useApp();
  const { repoState } = state;

  const graphData = useMemo(
    () => buildGraph(repoState),
    [repoState.commits, repoState.branches, repoState.HEAD]
  );

  if (graphData.nodes.length === 0) {
    return (
      <div className="commit-graph">
        <div className="commit-graph-empty">
          <p>Commit graph will appear here</p>
        </div>
      </div>
    );
  }

  const maxX = Math.max(...graphData.nodes.map(n => n.x)) + PADDING_X + 200;
  const maxY = Math.max(...graphData.nodes.map(n => n.y)) + PADDING_Y + 20;

  return (
    <div className="commit-graph">
      <svg width="100%" height="100%" viewBox={`0 0 ${maxX} ${maxY}`} preserveAspectRatio="xMinYMin meet">
        {/* Lane guide lines */}
        {(() => {
          const activeLanes = new Set(graphData.nodes.map(n => n.lane));
          return Array.from(activeLanes).map(lane => {
            const x = PADDING_X + lane * X_SPACING + X_SPACING / 2;
            return (
              <line
                key={`lane-${lane}`}
                x1={x}
                y1={PADDING_Y - 10}
                x2={x}
                y2={maxY - 10}
                stroke="#2a2a3e"
                strokeWidth={1}
                strokeDasharray="2 4"
              />
            );
          });
        })()}

        {/* Edges */}
        {graphData.edges.map((edge, i) => {
          const isSameColumn = edge.from.lane === edge.to.lane;
          if (isSameColumn) {
            return (
              <line
                key={`edge-${i}`}
                x1={edge.from.x}
                y1={edge.from.y}
                x2={edge.to.x}
                y2={edge.to.y}
                stroke={edge.color}
                strokeWidth={2}
                strokeOpacity={0.6}
              />
            );
          }
          const midY = (edge.from.y + edge.to.y) / 2;
          return (
            <path
              key={`edge-${i}`}
              d={`M ${edge.from.x} ${edge.from.y} C ${edge.from.x} ${midY}, ${edge.to.x} ${midY}, ${edge.to.x} ${edge.to.y}`}
              fill="none"
              stroke={edge.color}
              strokeWidth={2}
              strokeOpacity={0.45}
              strokeDasharray="4 3"
            />
          );
        })}

        {/* Nodes */}
        {graphData.nodes.map((node) => (
          <g key={node.hash}>
            {node.isHead && (
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS + 4}
                fill="none"
                stroke={node.branchColor}
                strokeWidth={2}
                strokeDasharray="4 2"
              />
            )}

            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              fill={node.branchColor}
              stroke="#1a1a2e"
              strokeWidth={2}
            />

            <text
              x={node.x}
              y={node.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8}
              fontFamily="Courier New, monospace"
              fill="white"
              fontWeight="bold"
            >
              {node.hash.slice(0, 4)}
            </text>

            <text
              x={node.x + NODE_RADIUS + 8}
              y={node.y - 6}
              fontSize={11}
              fontFamily="-apple-system, sans-serif"
              fill="#94a3b8"
            >
              {node.message.length > 35 ? node.message.slice(0, 35) + '...' : node.message}
            </text>

            {node.labels.map((label, li) => (
              <g key={label}>
                <rect
                  x={node.x + NODE_RADIUS + 8 + li * 80}
                  y={node.y + 4}
                  width={label.length * 7 + 12}
                  height={16}
                  rx={4}
                  fill={node.branchColor}
                  fillOpacity={0.15}
                  stroke={node.branchColor}
                  strokeWidth={1}
                />
                <text
                  x={node.x + NODE_RADIUS + 14 + li * 80}
                  y={node.y + 15}
                  fontSize={10}
                  fontFamily="Courier New, monospace"
                  fill={node.branchColor}
                  fontWeight="600"
                >
                  {label}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
