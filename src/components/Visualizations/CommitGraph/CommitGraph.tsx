import { useMemo } from 'react';
import { useApp } from '../../../state/AppContext';
import './CommitGraph.css';

interface GraphNode {
  hash: string;
  message: string;
  x: number;
  y: number;
  branchColor: string;
  labels: string[];
  isHead: boolean;
  parentHashes: string[];
}

const BRANCH_COLORS = [
  '#60a5fa', // blue
  '#4ade80', // green
  '#a78bdb', // purple
  '#fbbf24', // amber
  '#f87171', // red
  '#73daca', // teal
  '#ff9e64', // peach
];

const NODE_RADIUS = 14;
const X_SPACING = 80;
const Y_SPACING = 50;
const PADDING = 40;

export function CommitGraph() {
  const { state } = useApp();
  const { repoState } = state;

  const graphData = useMemo(() => {
    const commits = Array.from(repoState.commits.values());
    if (commits.length === 0) return { nodes: [], edges: [] };

    // Sort by timestamp (newest first)
    commits.sort((a, b) => b.timestamp - a.timestamp);

    // Assign branches to columns
    const branchColumns = new Map<string, number>();
    let nextCol = 0;
    for (const [name] of repoState.branches) {
      branchColumns.set(name, nextCol++);
    }

    // Build commit -> branch mapping
    const commitBranch = new Map<string, string>();
    for (const [name, branch] of repoState.branches) {
      // Walk the branch to find which commits belong to it
      let hash: string | undefined = branch.commitHash;
      while (hash) {
        if (!commitBranch.has(hash)) {
          commitBranch.set(hash, name);
        }
        const commit = repoState.commits.get(hash);
        if (!commit || commit.parentHashes.length === 0) break;
        hash = commit.parentHashes[0];
      }
    }

    // HEAD info
    const headCommitHash = repoState.HEAD.type === 'branch'
      ? repoState.branches.get(repoState.HEAD.name)?.commitHash
      : repoState.HEAD.commitHash;

    // Build nodes
    const nodes: GraphNode[] = commits.map((commit, i) => {
      const branch = commitBranch.get(commit.hash) || 'main';
      const col = branchColumns.get(branch) || 0;
      const colorIdx = col % BRANCH_COLORS.length;

      // Get labels
      const labels: string[] = [];
      for (const [name, ref] of repoState.branches) {
        if (ref.commitHash === commit.hash) {
          labels.push(name);
        }
      }

      return {
        hash: commit.hash,
        message: commit.message,
        x: PADDING + col * X_SPACING + X_SPACING / 2,
        y: PADDING + i * Y_SPACING,
        branchColor: BRANCH_COLORS[colorIdx],
        labels,
        isHead: commit.hash === headCommitHash,
        parentHashes: commit.parentHashes,
      };
    });

    // Build edges
    const nodeMap = new Map(nodes.map(n => [n.hash, n]));
    const edges: Array<{ from: GraphNode; to: GraphNode; color: string }> = [];

    for (const node of nodes) {
      for (const parentHash of node.parentHashes) {
        const parentNode = nodeMap.get(parentHash);
        if (parentNode) {
          edges.push({ from: node, to: parentNode, color: node.branchColor });
        }
      }
    }

    return { nodes, edges };
  }, [repoState.commits, repoState.branches, repoState.HEAD]);

  if (graphData.nodes.length === 0) {
    return (
      <div className="commit-graph">
        <div className="commit-graph-empty">
          <p>Commit graph will appear here</p>
        </div>
      </div>
    );
  }

  const maxX = Math.max(...graphData.nodes.map(n => n.x)) + PADDING + 120;
  const maxY = Math.max(...graphData.nodes.map(n => n.y)) + PADDING + 20;

  return (
    <div className="commit-graph">
      <svg width="100%" height="100%" viewBox={`0 0 ${maxX} ${maxY}`} preserveAspectRatio="xMinYMin meet">
        {/* Edges */}
        {graphData.edges.map((edge, i) => {
          const isSameColumn = Math.abs(edge.from.x - edge.to.x) < 5;
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
                strokeOpacity={0.5}
              />
            );
          }
          // Curved edge for cross-branch connections
          const midY = (edge.from.y + edge.to.y) / 2;
          return (
            <path
              key={`edge-${i}`}
              d={`M ${edge.from.x} ${edge.from.y} C ${edge.from.x} ${midY}, ${edge.to.x} ${midY}, ${edge.to.x} ${edge.to.y}`}
              fill="none"
              stroke={edge.color}
              strokeWidth={2}
              strokeOpacity={0.5}
            />
          );
        })}

        {/* Nodes */}
        {graphData.nodes.map((node) => (
          <g key={node.hash}>
            {/* HEAD indicator */}
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

            {/* Commit node */}
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              fill={node.branchColor}
              stroke="#1a1a2e"
              strokeWidth={2}
            />

            {/* Hash text */}
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

            {/* Message */}
            <text
              x={node.x + NODE_RADIUS + 8}
              y={node.y - 6}
              fontSize={11}
              fontFamily="-apple-system, sans-serif"
              fill="#94a3b8"
            >
              {node.message.length > 35 ? node.message.slice(0, 35) + '...' : node.message}
            </text>

            {/* Branch labels */}
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
