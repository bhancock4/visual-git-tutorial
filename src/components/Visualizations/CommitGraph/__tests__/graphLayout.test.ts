import { describe, it, expect, beforeEach } from 'vitest';
import { assignLanes, topoSort, buildGraph, PADDING_X, X_SPACING, Y_SPACING } from '../graphLayout';
import { GitEngine } from '../../../../engine/GitEngine';
import { resetHashCounter } from '../../../../engine/hash';
import type { CommitObject } from '../../../../engine/types';

beforeEach(() => {
  resetHashCounter();
});

// ---- helpers ----

function makeCommit(hash: string, parents: string[], message = ''): CommitObject {
  return {
    type: 'commit',
    hash,
    parentHashes: parents,
    message: message || `commit ${hash}`,
    author: 'test',
    timestamp: 0,
    snapshot: new Map(),
  };
}

function engineWithCommits(): GitEngine {
  const e = new GitEngine();
  e.init();
  e.createFile('a.txt', 'a');
  e.add(['.']);
  e.commit('first');
  return e;
}

// ---- topoSort ----

describe('topoSort', () => {
  it('returns empty for no tips', () => {
    const commits = new Map<string, CommitObject>();
    expect(topoSort(commits, new Set())).toEqual([]);
  });

  it('returns single commit', () => {
    const c = makeCommit('aaa', []);
    const commits = new Map([['aaa', c]]);
    const result = topoSort(commits, new Set(['aaa']));
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe('aaa');
  });

  it('returns newest first for linear chain', () => {
    const c1 = makeCommit('root', []);
    const c2 = makeCommit('mid', ['root']);
    const c3 = makeCommit('tip', ['mid']);
    const commits = new Map([['root', c1], ['mid', c2], ['tip', c3]]);
    const result = topoSort(commits, new Set(['tip']));
    expect(result.map(c => c.hash)).toEqual(['tip', 'mid', 'root']);
  });

  it('parents always appear after their children', () => {
    const c1 = makeCommit('root', []);
    const c2 = makeCommit('a', ['root']);
    const c3 = makeCommit('b', ['root']);
    const c4 = makeCommit('merge', ['a', 'b']);
    const commits = new Map([['root', c1], ['a', c2], ['b', c3], ['merge', c4]]);
    const result = topoSort(commits, new Set(['merge']));
    const idxMerge = result.findIndex(c => c.hash === 'merge');
    const idxA = result.findIndex(c => c.hash === 'a');
    const idxB = result.findIndex(c => c.hash === 'b');
    const idxRoot = result.findIndex(c => c.hash === 'root');
    expect(idxMerge).toBeLessThan(idxA);
    expect(idxMerge).toBeLessThan(idxB);
    expect(idxA).toBeLessThan(idxRoot);
    expect(idxB).toBeLessThan(idxRoot);
  });

  it('includes commits from multiple tips', () => {
    const c1 = makeCommit('root', []);
    const c2 = makeCommit('branchA', ['root']);
    const c3 = makeCommit('branchB', ['root']);
    const commits = new Map([['root', c1], ['branchA', c2], ['branchB', c3]]);
    const result = topoSort(commits, new Set(['branchA', 'branchB']));
    expect(result).toHaveLength(3);
  });
});

// ---- assignLanes ----

describe('assignLanes', () => {
  it('single linear chain stays in lane 0', () => {
    const c1 = makeCommit('tip', ['mid']);
    const c2 = makeCommit('mid', ['root']);
    const c3 = makeCommit('root', []);
    const sorted = [c1, c2, c3];
    const lanes = assignLanes(sorted);
    expect(lanes.get('tip')).toBe(0);
    expect(lanes.get('mid')).toBe(0);
    expect(lanes.get('root')).toBe(0);
  });

  it('merge parent gets a separate lane', () => {
    // tip merges a and b: tip -> [a, b], a -> root, b -> root
    const tip = makeCommit('tip', ['a', 'b']);
    const a = makeCommit('a', ['root']);
    const b = makeCommit('b', ['root']);
    const root = makeCommit('root', []);
    const sorted = [tip, a, b, root]; // topo order
    const lanes = assignLanes(sorted);

    // tip and first parent 'a' should share lane 0
    expect(lanes.get('tip')).toBe(0);
    expect(lanes.get('a')).toBe(0);
    // second parent 'b' gets a different lane
    expect(lanes.get('b')).not.toBe(lanes.get('a'));
  });

  it('two diverged branches use different lanes', () => {
    // branchA and branchB both descend from root
    const branchA = makeCommit('branchA', ['root']);
    const branchB = makeCommit('branchB', ['root']);
    const root = makeCommit('root', []);
    const sorted = [branchA, branchB, root];
    const lanes = assignLanes(sorted);
    expect(lanes.get('branchA')).not.toBe(lanes.get('branchB'));
  });

  it('freed lanes get reused', () => {
    // Two independent chains: a->b (root), then c->d (root2)
    const a = makeCommit('a', ['b']);
    const b = makeCommit('b', []);
    const c = makeCommit('c', ['d']);
    const d = makeCommit('d', []);
    const sorted = [a, b, c, d];
    const lanes = assignLanes(sorted);
    // After 'b' (root), lane is freed. 'c' should reuse lane 0.
    expect(lanes.get('a')).toBe(0);
    expect(lanes.get('c')).toBe(0);
  });

  it('assigns unique lane to every commit', () => {
    const tip = makeCommit('tip', ['a', 'b']);
    const a = makeCommit('a', ['root']);
    const b = makeCommit('b', ['root']);
    const root = makeCommit('root', []);
    const sorted = [tip, a, b, root];
    const lanes = assignLanes(sorted);
    expect(lanes.size).toBe(4);
  });
});

// ---- buildGraph ----

describe('buildGraph', () => {
  it('returns empty for no commits', () => {
    const result = buildGraph({
      commits: new Map(),
      branches: new Map(),
      HEAD: { type: 'branch', name: 'main' },
    });
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('single commit produces one node and no edges', () => {
    const e = engineWithCommits();
    const state = e.getState();
    const result = buildGraph(state);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.nodes[0].isHead).toBe(true);
    expect(result.nodes[0].labels).toContain('main');
  });

  it('linear history produces correct edge count', () => {
    const e = engineWithCommits();
    e.createFile('b.txt', 'b');
    e.add(['.']);
    e.commit('second');
    e.createFile('c.txt', 'c');
    e.add(['.']);
    e.commit('third');
    const result = buildGraph(e.getState());
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2); // each child -> parent
  });

  it('nodes are positioned with correct spacing', () => {
    const e = engineWithCommits();
    e.createFile('b.txt', 'b');
    e.add(['.']);
    e.commit('second');
    const result = buildGraph(e.getState());
    // All in lane 0
    expect(result.nodes[0].lane).toBe(0);
    expect(result.nodes[1].lane).toBe(0);
    // Y spacing
    expect(result.nodes[1].y - result.nodes[0].y).toBe(Y_SPACING);
    // X position for lane 0
    expect(result.nodes[0].x).toBe(PADDING_X + X_SPACING / 2);
  });

  it('branched history uses multiple lanes', () => {
    const e = engineWithCommits();
    // Create diverged branches: main and feature both have unique commits
    e.checkout('feature', { createBranch: true });
    e.createFile('feat.txt', 'feat');
    e.add(['.']);
    e.commit('feature work');
    e.checkout('main');
    e.createFile('main2.txt', 'main2');
    e.add(['.']);
    e.commit('main work');
    const result = buildGraph(e.getState());
    const lanes = new Set(result.nodes.map(n => n.lane));
    expect(lanes.size).toBeGreaterThanOrEqual(2);
  });

  it('merge commit has two parent edges', () => {
    const e = engineWithCommits();
    e.checkout('feature', { createBranch: true });
    e.createFile('feat.txt', 'feat');
    e.add(['.']);
    e.commit('feature work');
    e.checkout('main');
    e.createFile('main.txt', 'main');
    e.add(['.']);
    e.commit('main work');
    e.merge('feature');
    const result = buildGraph(e.getState());
    // Find merge node (has 2 parent hashes)
    const mergeNode = result.nodes.find(n => n.parentHashes.length === 2);
    expect(mergeNode).toBeDefined();
    // Should have 2 edges from merge node
    const mergeEdges = result.edges.filter(e => e.from.hash === mergeNode!.hash);
    expect(mergeEdges).toHaveLength(2);
  });

  it('HEAD node is marked correctly', () => {
    const e = engineWithCommits();
    e.createFile('b.txt', 'b');
    e.add(['.']);
    e.commit('second');
    const result = buildGraph(e.getState());
    const headNodes = result.nodes.filter(n => n.isHead);
    expect(headNodes).toHaveLength(1);
    expect(headNodes[0].message).toBe('second');
  });

  it('branch labels appear on correct nodes', () => {
    const e = engineWithCommits();
    e.checkout('dev', { createBranch: true });
    e.createFile('dev.txt', 'dev');
    e.add(['.']);
    e.commit('dev commit');
    const result = buildGraph(e.getState());
    const devNode = result.nodes.find(n => n.labels.includes('dev'));
    expect(devNode).toBeDefined();
    expect(devNode!.message).toBe('dev commit');
  });

  it('detached HEAD marks correct node', () => {
    const e = engineWithCommits();
    e.createFile('b.txt', 'b');
    e.add(['.']);
    e.commit('second');
    // Get the first commit hash
    const state = e.getState();
    const firstCommit = Array.from(state.commits.values()).find(c => c.message === 'first')!;
    e.checkout(firstCommit.hash);
    const result = buildGraph(e.getState());
    const headNode = result.nodes.find(n => n.isHead);
    expect(headNode).toBeDefined();
    expect(headNode!.message).toBe('first');
  });
});
