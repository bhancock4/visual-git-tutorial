import type { CommitObject } from '../../../engine/types';

// ---- Types ----

export interface GraphNode {
  hash: string;
  message: string;
  x: number;
  y: number;
  lane: number;
  branchColor: string;
  labels: string[];
  isHead: boolean;
  parentHashes: string[];
}

export interface GraphEdge {
  from: GraphNode;
  to: GraphNode;
  color: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const BRANCH_COLORS = [
  '#a78bdb', // purple (main gets the signature color)
  '#60a5fa', // blue
  '#4ade80', // green
  '#fbbf24', // amber
  '#f87171', // red
  '#73daca', // teal
  '#ff9e64', // peach
];

export const NODE_RADIUS = 14;
export const X_SPACING = 80;
export const Y_SPACING = 56;
export const PADDING_X = 40;
export const PADDING_Y = 30;

// ---- Lane assignment (like git log --graph) ----

export function assignLanes(sorted: CommitObject[]): Map<string, number> {
  const laneMap = new Map<string, number>();
  const lanes: (string | null)[] = [];

  function findLane(hash: string): number {
    return lanes.indexOf(hash);
  }

  function freeLane(): number {
    const idx = lanes.indexOf(null);
    if (idx !== -1) return idx;
    lanes.push(null);
    return lanes.length - 1;
  }

  for (const commit of sorted) {
    let lane = findLane(commit.hash);

    if (lane === -1) {
      lane = freeLane();
    }

    lanes[lane] = commit.hash;
    laneMap.set(commit.hash, lane);

    // First parent continues in the same lane
    if (commit.parentHashes.length > 0) {
      lanes[lane] = commit.parentHashes[0];
    } else {
      // Root commit — free the lane
      lanes[lane] = null;
    }

    // Additional parents (merge) get their own lanes if not already assigned
    for (let i = 1; i < commit.parentHashes.length; i++) {
      const parentHash = commit.parentHashes[i];
      if (findLane(parentHash) === -1) {
        const pLane = freeLane();
        lanes[pLane] = parentHash;
      }
    }
  }

  return laneMap;
}

// ---- Topological sort (DFS, newest first) ----

export function topoSort(
  commits: Map<string, CommitObject>,
  tipHashes: Set<string>,
): CommitObject[] {
  const visited = new Set<string>();
  const sorted: CommitObject[] = [];

  function dfs(hash: string) {
    if (visited.has(hash)) return;
    visited.add(hash);
    const commit = commits.get(hash);
    if (!commit) return;
    for (const parentHash of commit.parentHashes) {
      dfs(parentHash);
    }
    sorted.push(commit);
  }

  for (const hash of tipHashes) {
    dfs(hash);
  }

  sorted.reverse(); // newest first
  return sorted;
}

// ---- Full graph builder ----

interface RepoStateInput {
  commits: Map<string, CommitObject>;
  branches: Map<string, { name: string; commitHash: string }>;
  HEAD: { type: string; name?: string; commitHash?: string };
}

export function buildGraph(repoState: RepoStateInput): GraphData {
  const commits = repoState.commits;
  if (commits.size === 0) return { nodes: [], edges: [] };

  const headCommitHash = repoState.HEAD.type === 'branch'
    ? repoState.branches.get(repoState.HEAD.name!)?.commitHash || null
    : repoState.HEAD.commitHash || null;

  // Collect all branch tips
  const allTipHashes = new Set<string>();
  if (headCommitHash) allTipHashes.add(headCommitHash);
  for (const [, branch] of repoState.branches) allTipHashes.add(branch.commitHash);

  const sorted = topoSort(commits, allTipHashes);
  const laneMap = assignLanes(sorted);

  // Branch ownership: walk each branch from tip; first to claim wins
  const commitBranch = new Map<string, string>();
  const branchOrder = Array.from(repoState.branches.keys());
  const currentBranch = repoState.HEAD.type === 'branch' ? repoState.HEAD.name! : null;
  if (currentBranch) {
    const idx = branchOrder.indexOf(currentBranch);
    if (idx > 0) {
      branchOrder.splice(idx, 1);
      branchOrder.unshift(currentBranch);
    }
  }

  for (const branchName of branchOrder) {
    const branch = repoState.branches.get(branchName)!;
    let hash: string | undefined = branch.commitHash;
    while (hash) {
      if (!commitBranch.has(hash)) {
        commitBranch.set(hash, branchName);
      }
      const commit = commits.get(hash);
      if (!commit || commit.parentHashes.length === 0) break;
      hash = commit.parentHashes[0];
    }
  }

  // Color per lane
  const laneColors = new Map<number, string>();
  let colorIdx = 0;
  for (const commit of sorted) {
    const lane = laneMap.get(commit.hash) || 0;
    if (!laneColors.has(lane)) {
      laneColors.set(lane, BRANCH_COLORS[colorIdx % BRANCH_COLORS.length]);
      colorIdx++;
    }
  }

  // Build nodes
  const nodes: GraphNode[] = sorted.map((commit, i) => {
    const lane = laneMap.get(commit.hash) || 0;

    const labels: string[] = [];
    for (const [name, ref] of repoState.branches) {
      if (ref.commitHash === commit.hash) {
        labels.push(name);
      }
    }

    return {
      hash: commit.hash,
      message: commit.message,
      x: PADDING_X + lane * X_SPACING + X_SPACING / 2,
      y: PADDING_Y + i * Y_SPACING,
      lane,
      branchColor: laneColors.get(lane) || BRANCH_COLORS[0],
      labels,
      isHead: commit.hash === headCommitHash,
      parentHashes: commit.parentHashes,
    };
  });

  // Build edges
  const nodeMap = new Map(nodes.map(n => [n.hash, n]));
  const edges: GraphEdge[] = [];

  for (const node of nodes) {
    for (const parentHash of node.parentHashes) {
      const parentNode = nodeMap.get(parentHash);
      if (parentNode) {
        edges.push({ from: node, to: parentNode, color: node.branchColor });
      }
    }
  }

  return { nodes, edges };
}
