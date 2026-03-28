import type {
  RepoState,
  CommitObject,
  StateTransition,
  VirtualFile,
  ConflictMarker,
} from './types';
import { generateHash } from './hash';

// ---- Pure operation result ----

export interface OpResult {
  state: RepoState;
  success: boolean;
  output: string;
  transitions: StateTransition[];
}

// ---- State helpers (pure — read only) ----

export function getCurrentBranchName(state: RepoState): string {
  if (state.HEAD.type === 'branch') return state.HEAD.name;
  return 'HEAD (detached)';
}

export function getHeadCommit(state: RepoState): CommitObject | null {
  if (state.HEAD.type === 'branch') {
    const branch = state.branches.get(state.HEAD.name);
    if (!branch) return null;
    return state.commits.get(branch.commitHash) || null;
  }
  return state.commits.get(state.HEAD.commitHash) || null;
}

function getHeadCommitHash(state: RepoState): string | null {
  const commit = getHeadCommit(state);
  return commit ? commit.hash : null;
}

function getCommitHistory(state: RepoState, startHash: string, limit: number): CommitObject[] {
  const result: CommitObject[] = [];
  const visited = new Set<string>();
  const queue = [startHash];

  while (queue.length > 0 && result.length < limit) {
    const hash = queue.shift()!;
    if (visited.has(hash)) continue;
    visited.add(hash);

    const commit = state.commits.get(hash);
    if (!commit) continue;

    result.push(commit);
    queue.push(...commit.parentHashes);
  }

  return result.sort((a, b) => b.timestamp - a.timestamp);
}

function getBranchLabelsForCommit(state: RepoState, hash: string): string[] {
  const labels: string[] = [];
  for (const [name, branch] of state.branches) {
    if (branch.commitHash === hash) {
      const isHead = state.HEAD.type === 'branch' && state.HEAD.name === name;
      labels.push(isHead ? `HEAD -> ${name}` : name);
    }
  }
  return labels;
}

function isAncestor(state: RepoState, ancestorHash: string, descendantHash: string): boolean {
  const visited = new Set<string>();
  const queue = [descendantHash];

  while (queue.length > 0) {
    const hash = queue.shift()!;
    if (hash === ancestorHash) return true;
    if (visited.has(hash)) continue;
    visited.add(hash);

    const commit = state.commits.get(hash);
    if (commit) queue.push(...commit.parentHashes);
  }

  return false;
}

function getStagedChanges(state: RepoState, headCommit: CommitObject | null): Array<{ type: string; path: string }> {
  const changes: Array<{ type: string; path: string }> = [];
  const base = headCommit ? headCommit.snapshot : new Map<string, VirtualFile>();

  for (const [path] of state.stagingArea) {
    if (!base.has(path)) {
      changes.push({ type: 'new file', path });
    } else {
      const baseFile = base.get(path)!;
      const stagedFile = state.stagingArea.get(path)!;
      if (baseFile.content !== stagedFile.content) {
        changes.push({ type: 'modified', path });
      }
    }
  }

  for (const path of state.removedFiles) {
    changes.push({ type: 'deleted', path });
  }

  return changes;
}

function getUnstagedChanges(state: RepoState): Array<{ type: string; path: string }> {
  const changes: Array<{ type: string; path: string }> = [];

  for (const [path, wdFile] of state.workingDirectory) {
    const stagedFile = state.stagingArea.get(path);
    if (stagedFile && stagedFile.content !== wdFile.content) {
      changes.push({ type: 'modified', path });
    }
  }

  return changes;
}

function getUntrackedFiles(state: RepoState, headCommit: CommitObject | null): string[] {
  const tracked = new Set<string>();
  if (headCommit) {
    for (const [path] of headCommit.snapshot) tracked.add(path);
  }
  for (const [path] of state.stagingArea) tracked.add(path);

  const untracked: string[] = [];
  for (const [path] of state.workingDirectory) {
    if (!tracked.has(path) && !isIgnored(state, path)) {
      untracked.push(path);
    }
  }
  return untracked;
}

function hasWorkingDirectoryChanges(state: RepoState, headCommit: CommitObject): boolean {
  if (state.workingDirectory.size !== headCommit.snapshot.size) return true;
  for (const [path, file] of state.workingDirectory) {
    const committed = headCommit.snapshot.get(path);
    if (!committed || committed.content !== file.content) return true;
  }
  return false;
}

function isIgnored(state: RepoState, path: string): boolean {
  for (const pattern of state.gitignorePatterns) {
    if (matchGitignore(pattern, path)) return true;
  }
  return false;
}

function matchGitignore(pattern: string, path: string): boolean {
  const regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`).test(path) || new RegExp(`^${regex}$`).test(path.split('/').pop() || '');
}

function appendSimpleDiff(lines: string[], oldContent: string, newContent: string): void {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= oldLines.length) {
      lines.push(`+${newLines[i]}`);
    } else if (i >= newLines.length) {
      lines.push(`-${oldLines[i]}`);
    } else if (oldLines[i] !== newLines[i]) {
      lines.push(`-${oldLines[i]}`);
      lines.push(`+${newLines[i]}`);
    } else {
      lines.push(` ${oldLines[i]}`);
    }
  }
}

// ---- State mutation helpers (return new state) ----

function cloneFileMap(m: Map<string, VirtualFile>): Map<string, VirtualFile> {
  const result = new Map<string, VirtualFile>();
  for (const [k, v] of m) {
    result.set(k, { ...v });
  }
  return result;
}

function updateCurrentBranch(state: RepoState, commitHash: string): RepoState {
  if (state.HEAD.type === 'branch') {
    const branches = new Map(state.branches);
    branches.set(state.HEAD.name, { name: state.HEAD.name, commitHash });
    return { ...state, branches };
  }
  return { ...state, HEAD: { type: 'detached', commitHash } };
}

function addReflog(state: RepoState, hash: string | null, action: string, message: string): RepoState {
  const prevEntry = state.reflog.length > 0 ? state.reflog[0] : null;
  const entry = {
    hash: hash || '0000000',
    previousHash: prevEntry?.hash || null,
    action,
    message,
    timestamp: Date.now(),
  };
  return { ...state, reflog: [entry, ...state.reflog] };
}

function ok(state: RepoState, output: string, transitions: StateTransition[]): OpResult {
  return { state, success: true, output, transitions };
}

function fail(state: RepoState, output: string): OpResult {
  return { state, success: false, output, transitions: [] };
}

const NOT_INIT_MSG = 'fatal: not a git repository (or any of the parent directories): .git';

// ---- Pure operations ----

export function opCreateFile(state: RepoState, path: string, content: string): OpResult {
  const wd = new Map(state.workingDirectory);
  wd.set(path, { path, content });
  return ok({ ...state, workingDirectory: wd }, `Created file: ${path}`, []);
}

export function opEditFile(state: RepoState, path: string, content: string): OpResult {
  if (!state.workingDirectory.has(path)) {
    return fail(state, `error: '${path}' does not exist`);
  }
  const wd = new Map(state.workingDirectory);
  wd.set(path, { path, content });
  return ok({ ...state, workingDirectory: wd }, `Edited file: ${path}`, []);
}

export function opDeleteFile(state: RepoState, path: string): OpResult {
  if (!state.workingDirectory.has(path)) {
    return fail(state, `error: '${path}' does not exist`);
  }
  const wd = new Map(state.workingDirectory);
  wd.delete(path);
  return ok({ ...state, workingDirectory: wd }, `Deleted file: ${path}`, []);
}

export function opInit(state: RepoState): OpResult {
  if (state.initialized) {
    return fail(state, 'Reinitialized existing Git repository');
  }
  let s: RepoState = {
    ...state,
    initialized: true,
    HEAD: { type: 'branch', name: 'main' },
  };
  s = addReflog(s, null, 'init', 'initial');
  return ok(s, 'Initialized empty Git repository', [{ type: 'init', from: 'working', to: 'working', files: [] }]);
}

export function opStatus(state: RepoState): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  const lines: string[] = [];
  const currentBranch = getCurrentBranchName(state);
  lines.push(`On branch ${currentBranch}`);

  const headCommit = getHeadCommit(state);

  if (state.conflicts.length > 0) {
    lines.push('');
    lines.push('You have unmerged paths.');
    lines.push('  (fix conflicts and run "git add" to mark resolution)');
    lines.push('');
    lines.push('Unmerged paths:');
    for (const c of state.conflicts) {
      lines.push(`\tboth modified:   ${c.filePath}`);
    }
  }

  const staged = getStagedChanges(state, headCommit);
  if (staged.length > 0) {
    lines.push('');
    lines.push('Changes to be committed:');
    lines.push('  (use "git reset HEAD <file>" to unstage)');
    lines.push('');
    for (const change of staged) {
      lines.push(`\t${change.type}:   ${change.path}`);
    }
  }

  const unstaged = getUnstagedChanges(state);
  if (unstaged.length > 0) {
    lines.push('');
    lines.push('Changes not staged for commit:');
    lines.push('  (use "git add <file>" to update what will be committed)');
    lines.push('');
    for (const change of unstaged) {
      lines.push(`\t${change.type}:   ${change.path}`);
    }
  }

  const untracked = getUntrackedFiles(state, headCommit);
  if (untracked.length > 0) {
    lines.push('');
    lines.push('Untracked files:');
    lines.push('  (use "git add <file>" to include in what will be committed)');
    lines.push('');
    for (const f of untracked) {
      lines.push(`\t${f}`);
    }
  }

  if (staged.length === 0 && unstaged.length === 0 && untracked.length === 0 && state.conflicts.length === 0) {
    lines.push('');
    lines.push('nothing to commit, working tree clean');
  }

  return ok(state, lines.join('\n'), []);
}

export function opAdd(state: RepoState, paths: string[]): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  const addAll = paths.includes('.') || paths.includes('-A') || paths.includes('--all');
  const filesToAdd: string[] = [];
  let s = { ...state, stagingArea: new Map(state.stagingArea), conflicts: [...state.conflicts], removedFiles: new Set(state.removedFiles) };

  if (addAll) {
    for (const [path] of s.workingDirectory) {
      if (!isIgnored(s, path)) {
        filesToAdd.push(path);
      }
    }
    const headCommit = getHeadCommit(s);
    if (headCommit) {
      for (const [path] of headCommit.snapshot) {
        if (!s.workingDirectory.has(path) && !filesToAdd.includes(path)) {
          s.stagingArea.delete(path);
          s.removedFiles.add(path);
        }
      }
    }
  } else {
    for (const p of paths) {
      if (s.workingDirectory.has(p)) {
        if (isIgnored(s, p)) {
          return fail(state, `The following paths are ignored by one of your .gitignore files:\n${p}`);
        }
        filesToAdd.push(p);
      } else {
        const headCommit = getHeadCommit(s);
        if (headCommit && headCommit.snapshot.has(p)) {
          s.stagingArea.delete(p);
          s.removedFiles.add(p);
          filesToAdd.push(p);
        } else {
          return fail(state, `fatal: pathspec '${p}' did not match any files`);
        }
      }
    }
  }

  for (const path of filesToAdd) {
    const file = s.workingDirectory.get(path);
    if (file) {
      s.stagingArea.set(path, { ...file });
      s.removedFiles.delete(path);
    }
    s.conflicts = s.conflicts.filter(c => c.filePath !== path);
  }

  const transitions: StateTransition[] = filesToAdd.length > 0
    ? [{ type: 'add', from: 'working', to: 'staging', files: filesToAdd }]
    : [];

  return ok(s, '', transitions);
}

export function opCommit(state: RepoState, message: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  if (state.conflicts.length > 0) {
    return fail(state, 'error: Committing is not possible because you have unmerged files.\nfix conflicts and then commit the result.');
  }

  if (state.stagingArea.size === 0 && !state.removedFiles.size) {
    const headCommit = getHeadCommit(state);
    if (headCommit) {
      return fail(state, 'nothing to commit, working tree clean');
    }
    if (state.stagingArea.size === 0) {
      return fail(state, 'nothing to commit (create/copy files and use "git add" to track)');
    }
  }

  const parentHashes: string[] = [];
  const headCommit = getHeadCommit(state);
  if (headCommit) {
    parentHashes.push(headCommit.hash);
  }
  if (state.pendingMergeParent) {
    parentHashes.push(state.pendingMergeParent);
  }

  const snapshot = headCommit ? cloneFileMap(headCommit.snapshot) : new Map<string, VirtualFile>();
  for (const [path, file] of state.stagingArea) {
    snapshot.set(path, { ...file });
  }
  for (const path of state.removedFiles) {
    snapshot.delete(path);
  }

  const hash = generateHash(message + Date.now());
  const commit: CommitObject = {
    type: 'commit',
    hash,
    parentHashes,
    message,
    author: state.config.userName,
    timestamp: Date.now(),
    snapshot,
  };

  const commits = new Map(state.commits);
  commits.set(hash, commit);

  let s: RepoState = { ...state, commits, stagingArea: new Map(), removedFiles: new Set(), pendingMergeParent: null };
  s = updateCurrentBranch(s, hash);

  const committedFiles = Array.from(state.stagingArea.keys());
  s = addReflog(s, hash, 'commit', message);

  const shortHash = hash.slice(0, 7);
  const fileCount = committedFiles.length;
  const output = `[${getCurrentBranchName(s)} ${shortHash}] ${message}\n ${fileCount} file${fileCount !== 1 ? 's' : ''} changed`;

  return ok(s, output, [
    { type: 'commit', from: 'staging', to: 'local', files: committedFiles },
  ]);
}

export function opLog(state: RepoState, options?: { oneline?: boolean; all?: boolean; count?: number }): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  const headCommit = getHeadCommit(state);
  if (!headCommit) {
    return fail(state, 'fatal: your current branch does not have any commits yet');
  }

  const commits = getCommitHistory(state, headCommit.hash, options?.count || 10);
  const lines: string[] = [];

  for (const commit of commits) {
    if (options?.oneline) {
      const branchLabels = getBranchLabelsForCommit(state, commit.hash);
      const labelStr = branchLabels.length > 0 ? ` (${branchLabels.join(', ')})` : '';
      lines.push(`${commit.hash}${labelStr} ${commit.message}`);
    } else {
      const branchLabels = getBranchLabelsForCommit(state, commit.hash);
      const labelStr = branchLabels.length > 0 ? ` (${branchLabels.join(', ')})` : '';
      lines.push(`commit ${commit.hash}${labelStr}`);
      lines.push(`Author: ${commit.author}`);
      lines.push(`Date:   ${new Date(commit.timestamp).toLocaleString()}`);
      lines.push('');
      lines.push(`    ${commit.message}`);
      lines.push('');
    }
  }

  return ok(state, lines.join('\n'), []);
}

export function opBranch(state: RepoState, name?: string, options?: { delete?: boolean; list?: boolean }): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  if (!name || options?.list) {
    const currentBranch = getCurrentBranchName(state);
    const lines: string[] = [];
    const branchNames = Array.from(state.branches.keys()).sort();

    if (branchNames.length === 0) {
      lines.push(`* ${currentBranch}`);
    } else {
      for (const b of branchNames) {
        const prefix = b === currentBranch ? '* ' : '  ';
        lines.push(`${prefix}${b}`);
      }
    }
    return ok(state, lines.join('\n'), []);
  }

  if (options?.delete) {
    if (name === getCurrentBranchName(state)) {
      return fail(state, `error: Cannot delete branch '${name}' checked out at current location`);
    }
    if (!state.branches.has(name)) {
      return fail(state, `error: branch '${name}' not found`);
    }
    const branches = new Map(state.branches);
    branches.delete(name);
    return ok({ ...state, branches }, `Deleted branch ${name}`, []);
  }

  if (state.branches.has(name)) {
    return fail(state, `fatal: A branch named '${name}' already exists`);
  }

  const headCommit = getHeadCommit(state);
  if (!headCommit) {
    return fail(state, 'fatal: Not a valid object name: no commits yet');
  }

  const branches = new Map(state.branches);
  branches.set(name, { name, commitHash: headCommit.hash });
  return ok({ ...state, branches }, `Created branch '${name}'`, []);
}

export function opCheckout(state: RepoState, target: string, options?: { createBranch?: boolean }): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  if (state.conflicts.length > 0) {
    return fail(state, 'error: you need to resolve your current merge conflicts before switching branches');
  }

  let s = { ...state };

  if (options?.createBranch) {
    const branchResult = opBranch(s, target);
    if (!branchResult.success) return branchResult;
    s = branchResult.state;
  }

  if (s.branches.has(target)) {
    const branch = s.branches.get(target)!;
    const prevHash = getHeadCommitHash(s);
    s = { ...s, HEAD: { type: 'branch', name: target } };

    const commit = s.commits.get(branch.commitHash);
    if (commit) {
      s = { ...s, workingDirectory: cloneFileMap(commit.snapshot), stagingArea: new Map(), removedFiles: new Set() };
    }

    s = addReflog(s, branch.commitHash, 'checkout', `moving from ${prevHash || 'none'} to ${target}`);

    return ok(s, `Switched to branch '${target}'`, [
      { type: 'checkout', from: 'local', to: 'working', files: Array.from(s.workingDirectory.keys()) },
    ]);
  }

  if (s.commits.has(target)) {
    const commit = s.commits.get(target)!;
    s = {
      ...s,
      HEAD: { type: 'detached', commitHash: target },
      workingDirectory: cloneFileMap(commit.snapshot),
      stagingArea: new Map(),
      removedFiles: new Set(),
    };

    return ok(s, `Note: switching to '${target}'.\nYou are in 'detached HEAD' state.`, [
      { type: 'checkout', from: 'local', to: 'working', files: Array.from(commit.snapshot.keys()) },
    ]);
  }

  return fail(state, `error: pathspec '${target}' did not match any file(s) known to git`);
}

export function opRestoreFile(state: RepoState, filePath: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  const headCommit = getHeadCommit(state);
  if (!headCommit) {
    return fail(state, `error: pathspec '${filePath}' did not match any file(s) known to git`);
  }

  const committedFile = headCommit.snapshot.get(filePath);
  if (!committedFile) {
    return fail(state, `error: pathspec '${filePath}' did not match any file(s) known to git`);
  }

  const wd = new Map(state.workingDirectory);
  wd.set(filePath, { path: filePath, content: committedFile.content });
  const staging = new Map(state.stagingArea);
  staging.delete(filePath);

  return ok({ ...state, workingDirectory: wd, stagingArea: staging }, 'Updated 1 path from the index', [
    { type: 'checkout', from: 'local', to: 'working', files: [filePath] },
  ]);
}

export function opUnstage(state: RepoState, filePath: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  if (state.stagingArea.has(filePath)) {
    const staging = new Map(state.stagingArea);
    staging.delete(filePath);
    return ok({ ...state, stagingArea: staging }, `Unstaged changes after reset:\n${filePath}`, [
      { type: 'reset', from: 'staging', to: 'working', files: [filePath] },
    ]);
  }
  return ok(state, '', []);
}

export function opMerge(state: RepoState, branchName: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  if (!state.branches.has(branchName)) {
    return fail(state, `merge: ${branchName} - not something we can merge`);
  }

  const currentBranch = getCurrentBranchName(state);
  if (branchName === currentBranch) {
    return fail(state, `Already on '${branchName}'`);
  }

  const targetBranch = state.branches.get(branchName)!;
  const targetCommit = state.commits.get(targetBranch.commitHash)!;
  const headCommit = getHeadCommit(state)!;

  // Fast-forward
  if (isAncestor(state, headCommit.hash, targetCommit.hash)) {
    let s = updateCurrentBranch(state, targetCommit.hash);
    s = { ...s, workingDirectory: cloneFileMap(targetCommit.snapshot), stagingArea: new Map() };
    s = addReflog(s, targetCommit.hash, 'merge', `merge ${branchName}: Fast-forward`);

    return ok(s, `Updating ${headCommit.hash}..${targetCommit.hash}\nFast-forward`, [
      { type: 'merge', from: 'local', to: 'working', files: Array.from(targetCommit.snapshot.keys()) },
    ]);
  }

  // Check for conflicts
  const conflicts: ConflictMarker[] = [];
  const mergedSnapshot = cloneFileMap(headCommit.snapshot);

  for (const [path, targetFile] of targetCommit.snapshot) {
    const ourFile = headCommit.snapshot.get(path);
    if (ourFile) {
      if (ourFile.content !== targetFile.content) {
        conflicts.push({ filePath: path, oursContent: ourFile.content, theirsContent: targetFile.content });
        const conflictContent = `<<<<<<< HEAD\n${ourFile.content}\n=======\n${targetFile.content}\n>>>>>>> ${branchName}`;
        mergedSnapshot.set(path, { path, content: conflictContent });
      }
    } else {
      mergedSnapshot.set(path, { ...targetFile });
    }
  }

  if (conflicts.length > 0) {
    const s: RepoState = {
      ...state,
      conflicts,
      pendingMergeParent: targetCommit.hash,
      workingDirectory: cloneFileMap(mergedSnapshot),
    };
    return {
      state: s,
      success: false,
      output: `Auto-merging failed\nCONFLICT (content): Merge conflict in ${conflicts.map(c => c.filePath).join(', ')}\nAutomatic merge failed; fix conflicts and then commit the result.`,
      transitions: [{ type: 'merge', from: 'local', to: 'working', files: conflicts.map(c => c.filePath) }],
    };
  }

  // Clean merge
  const hash = generateHash(`merge-${branchName}-${Date.now()}`);
  const mergeCommit: CommitObject = {
    type: 'commit',
    hash,
    parentHashes: [headCommit.hash, targetCommit.hash],
    message: `Merge branch '${branchName}'`,
    author: state.config.userName,
    timestamp: Date.now(),
    snapshot: mergedSnapshot,
  };

  const commits = new Map(state.commits);
  commits.set(hash, mergeCommit);

  let s: RepoState = { ...state, commits, workingDirectory: cloneFileMap(mergedSnapshot), stagingArea: new Map() };
  s = updateCurrentBranch(s, hash);
  s = addReflog(s, hash, 'merge', `merge ${branchName}`);

  return ok(s, `Merge made by the 'ort' strategy.\nMerge branch '${branchName}'`, [
    { type: 'merge', from: 'local', to: 'working', files: Array.from(mergedSnapshot.keys()) },
  ]);
}

export function opDiff(state: RepoState, target?: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  const lines: string[] = [];

  if (target === '--staged' || target === '--cached') {
    const headCommit = getHeadCommit(state);
    const base = headCommit ? headCommit.snapshot : new Map<string, VirtualFile>();

    for (const [path, stagedFile] of state.stagingArea) {
      const baseFile = base.get(path);
      if (!baseFile) {
        lines.push(`diff --git a/${path} b/${path}`);
        lines.push('new file');
        lines.push(`+++ b/${path}`);
        lines.push(`+${stagedFile.content}`);
      } else if (baseFile.content !== stagedFile.content) {
        lines.push(`diff --git a/${path} b/${path}`);
        lines.push(`--- a/${path}`);
        lines.push(`+++ b/${path}`);
        appendSimpleDiff(lines, baseFile.content, stagedFile.content);
      }
    }
  } else {
    for (const [path, wdFile] of state.workingDirectory) {
      const stagedFile = state.stagingArea.get(path);
      const headCommit = getHeadCommit(state);
      const baseFile = stagedFile || (headCommit ? headCommit.snapshot.get(path) : undefined);

      if (baseFile && baseFile.content !== wdFile.content) {
        lines.push(`diff --git a/${path} b/${path}`);
        lines.push(`--- a/${path}`);
        lines.push(`+++ b/${path}`);
        appendSimpleDiff(lines, baseFile.content, wdFile.content);
      }
    }
  }

  if (lines.length === 0) {
    return ok(state, '', []);
  }

  return ok(state, lines.join('\n'), []);
}

export function opPush(state: RepoState, remote?: string, branch?: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  const remoteName = remote || 'origin';
  const branchName = branch || getCurrentBranchName(state);

  if (!state.remotes.has(remoteName)) {
    return fail(state, `fatal: '${remoteName}' does not appear to be a git repository`);
  }

  const remoteRepo = state.remotes.get(remoteName)!;
  const localBranch = state.branches.get(branchName);
  if (!localBranch) {
    return fail(state, `error: src refspec '${branchName}' does not match any`);
  }

  const commits = getCommitHistory(state, localBranch.commitHash, 100);
  const newRemoteBranches = new Map(remoteRepo.branches);
  const newRemoteCommits = new Map(remoteRepo.commits);

  for (const commit of commits) {
    newRemoteCommits.set(commit.hash, commit);
  }
  newRemoteBranches.set(branchName, localBranch.commitHash);

  const remotes = new Map(state.remotes);
  remotes.set(remoteName, { ...remoteRepo, branches: newRemoteBranches, commits: newRemoteCommits });

  const headCommit = state.commits.get(localBranch.commitHash)!;
  const files = Array.from(headCommit.snapshot.keys());

  return ok({ ...state, remotes }, `To ${remoteRepo.url}\n   ${localBranch.commitHash.slice(0, 7)}..${localBranch.commitHash.slice(0, 7)} ${branchName} -> ${branchName}`, [
    { type: 'push', from: 'local', to: 'remote', files },
  ]);
}

export function opPull(state: RepoState, remote?: string, branch?: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  const remoteName = remote || 'origin';
  const branchName = branch || getCurrentBranchName(state);

  if (!state.remotes.has(remoteName)) {
    return fail(state, `fatal: '${remoteName}' does not appear to be a git repository`);
  }

  const remoteRepo = state.remotes.get(remoteName)!;
  const remoteBranchHash = remoteRepo.branches.get(branchName);

  if (!remoteBranchHash) {
    return fail(state, `fatal: couldn't find remote ref '${branchName}'`);
  }

  const commits = new Map(state.commits);
  for (const [hash, commit] of remoteRepo.commits) {
    if (!commits.has(hash)) {
      commits.set(hash, commit);
    }
  }

  let s: RepoState = { ...state, commits };
  s = updateCurrentBranch(s, remoteBranchHash);
  const remoteCommit = s.commits.get(remoteBranchHash)!;
  s = { ...s, workingDirectory: cloneFileMap(remoteCommit.snapshot), stagingArea: new Map() };
  s = addReflog(s, remoteBranchHash, 'pull', `pull ${remoteName}/${branchName}`);

  return ok(s, `From ${remoteRepo.url}\nUpdating...Fast-forward`, [
    { type: 'pull', from: 'remote', to: 'working', files: Array.from(remoteCommit.snapshot.keys()) },
  ]);
}

export function opFetch(state: RepoState, remote?: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  const remoteName = remote || 'origin';
  if (!state.remotes.has(remoteName)) {
    return fail(state, `fatal: '${remoteName}' does not appear to be a git repository`);
  }

  const remoteRepo = state.remotes.get(remoteName)!;
  const commits = new Map(state.commits);
  for (const [hash, commit] of remoteRepo.commits) {
    if (!commits.has(hash)) {
      commits.set(hash, commit);
    }
  }

  return ok({ ...state, commits }, `From ${remoteRepo.url}\n * [new branch]  main -> ${remoteName}/main`, [
    { type: 'fetch', from: 'remote', to: 'local', files: [] },
  ]);
}

export function opReset(state: RepoState, target?: string, mode?: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  // git reset HEAD <file> - unstage
  if (target && target !== '--soft' && target !== '--mixed' && target !== '--hard' && !target.startsWith('HEAD')) {
    const filePath = target;
    if (mode === 'HEAD' || !mode) {
      if (state.stagingArea.has(filePath)) {
        const staging = new Map(state.stagingArea);
        staging.delete(filePath);
        return ok({ ...state, stagingArea: staging }, `Unstaged changes after reset:\n${filePath}`, [
          { type: 'reset', from: 'staging', to: 'working', files: [filePath] },
        ]);
      }
      return ok(state, '', []);
    }
  }

  let resetMode = 'mixed';
  let resetTarget = 'HEAD';

  if (mode === '--soft' || target === '--soft') resetMode = 'soft';
  if (mode === '--hard' || target === '--hard') resetMode = 'hard';
  if (mode === '--mixed' || target === '--mixed') resetMode = 'mixed';

  if (target && target.startsWith('HEAD~')) {
    const steps = parseInt(target.slice(5)) || 1;
    let commit = getHeadCommit(state);
    for (let i = 0; i < steps && commit && commit.parentHashes.length > 0; i++) {
      commit = state.commits.get(commit.parentHashes[0]) || null;
    }
    if (!commit) return fail(state, 'fatal: cannot reset past initial commit');
    resetTarget = commit.hash;
  } else if (target && !target.startsWith('--')) {
    resetTarget = target;
  }

  let targetCommit: CommitObject | undefined;
  if (resetTarget === 'HEAD') {
    targetCommit = getHeadCommit(state) || undefined;
  } else {
    targetCommit = state.commits.get(resetTarget);
  }

  if (!targetCommit) {
    return fail(state, `fatal: ambiguous argument '${resetTarget}'`);
  }

  let s = updateCurrentBranch(state, targetCommit.hash);

  if (resetMode === 'soft') {
    // Stage any differences vs the target commit
    const staging = new Map(s.stagingArea);
    for (const [path, file] of s.workingDirectory) {
      const targetFile = targetCommit.snapshot.get(path);
      if (!targetFile || targetFile.content !== file.content) {
        staging.set(path, { ...file });
      }
    }
    s = { ...s, stagingArea: staging };
  } else if (resetMode === 'mixed') {
    s = { ...s, stagingArea: new Map() };
  } else if (resetMode === 'hard') {
    s = { ...s, stagingArea: new Map(), workingDirectory: cloneFileMap(targetCommit.snapshot), removedFiles: new Set() };
  }

  s = addReflog(s, targetCommit.hash, 'reset', `reset ${resetMode} to ${targetCommit.hash.slice(0, 7)}`);

  const files = Array.from(targetCommit.snapshot.keys());

  return ok(s, `HEAD is now at ${targetCommit.hash.slice(0, 7)} ${targetCommit.message}`, [
    { type: 'reset', from: 'local', to: resetMode === 'hard' ? 'working' : 'staging', files },
  ]);
}

export function opRevert(state: RepoState, commitHash: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  const commit = state.commits.get(commitHash);
  if (!commit) {
    return fail(state, `fatal: bad revision '${commitHash}'`);
  }

  const parentCommit = commit.parentHashes.length > 0
    ? state.commits.get(commit.parentHashes[0])
    : null;

  const currentSnapshot = getHeadCommit(state)!.snapshot;
  const revertedSnapshot = cloneFileMap(currentSnapshot);

  if (parentCommit) {
    for (const [path] of commit.snapshot) {
      const parentVersion = parentCommit.snapshot.get(path);
      if (parentVersion) {
        revertedSnapshot.set(path, { ...parentVersion });
      } else {
        revertedSnapshot.delete(path);
      }
    }
  }

  const hash = generateHash(`revert-${commitHash}`);
  const revertCommit: CommitObject = {
    type: 'commit',
    hash,
    parentHashes: [getHeadCommitHash(state)!],
    message: `Revert "${commit.message}"`,
    author: state.config.userName,
    timestamp: Date.now(),
    snapshot: revertedSnapshot,
  };

  const commits = new Map(state.commits);
  commits.set(hash, revertCommit);

  let s: RepoState = { ...state, commits, workingDirectory: cloneFileMap(revertedSnapshot), stagingArea: new Map() };
  s = updateCurrentBranch(s, hash);
  s = addReflog(s, hash, 'revert', `revert ${commitHash.slice(0, 7)}`);

  return ok(s, `[${getCurrentBranchName(s)} ${hash.slice(0, 7)}] Revert "${commit.message}"`, [
    { type: 'revert', from: 'local', to: 'working', files: Array.from(revertedSnapshot.keys()) },
  ]);
}

export function opStash(state: RepoState, action?: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  if (!action || action === 'push') {
    const headCommit = getHeadCommit(state);
    if (!headCommit) return fail(state, 'No commits to stash against');

    const hasChanges = state.stagingArea.size > 0 || hasWorkingDirectoryChanges(state, headCommit);
    if (!hasChanges) {
      return fail(state, 'No local changes to save');
    }

    const entry = {
      id: state.stash.length,
      message: `WIP on ${getCurrentBranchName(state)}`,
      workingDirectory: cloneFileMap(state.workingDirectory),
      stagingArea: cloneFileMap(state.stagingArea),
      baseBranch: getCurrentBranchName(state),
      baseCommitHash: headCommit.hash,
    };

    const s: RepoState = {
      ...state,
      stash: [entry, ...state.stash],
      workingDirectory: cloneFileMap(headCommit.snapshot),
      stagingArea: new Map(),
    };

    return ok(s, `Saved working directory and index state ${entry.message}`, [
      { type: 'stash', from: 'working', to: 'local', files: Array.from(entry.workingDirectory.keys()) },
    ]);
  }

  if (action === 'pop') {
    if (state.stash.length === 0) {
      return fail(state, 'error: No stash entries found.');
    }

    const entry = state.stash[0];
    const s: RepoState = {
      ...state,
      stash: state.stash.slice(1),
      workingDirectory: cloneFileMap(entry.workingDirectory),
      stagingArea: cloneFileMap(entry.stagingArea),
    };

    return ok(s, `On branch ${getCurrentBranchName(s)}\nDropped stash@{0}`, [
      { type: 'stash-pop', from: 'local', to: 'working', files: Array.from(entry.workingDirectory.keys()) },
    ]);
  }

  if (action === 'list') {
    if (state.stash.length === 0) {
      return ok(state, '', []);
    }
    const lines = state.stash.map((s, i) => `stash@{${i}}: ${s.message}`);
    return ok(state, lines.join('\n'), []);
  }

  if (action === 'drop') {
    if (state.stash.length === 0) {
      return fail(state, 'error: No stash entries found.');
    }
    return ok({ ...state, stash: state.stash.slice(1) }, 'Dropped stash@{0}', []);
  }

  return fail(state, `error: unknown stash command '${action}'`);
}

export function opReflog(state: RepoState): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  if (state.reflog.length === 0) {
    return ok(state, '', []);
  }

  const lines = state.reflog.map((entry, i) =>
    `${entry.hash?.slice(0, 7) || '0000000'} HEAD@{${i}}: ${entry.action}: ${entry.message}`
  );

  return ok(state, lines.join('\n'), []);
}

export function opRemoteAdd(state: RepoState, name: string, url: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  if (state.remotes.has(name)) {
    return fail(state, `error: remote ${name} already exists.`);
  }

  const remotes = new Map(state.remotes);
  remotes.set(name, { name, url, branches: new Map(), commits: new Map() });

  return ok({ ...state, remotes }, '', []);
}

export function opRm(state: RepoState, path: string): OpResult {
  if (!state.initialized) return fail(state, NOT_INIT_MSG);

  const headCommit = getHeadCommit(state);
  const isTracked = headCommit?.snapshot.has(path) || state.stagingArea.has(path);

  if (!isTracked && !state.workingDirectory.has(path)) {
    return fail(state, `fatal: pathspec '${path}' did not match any files`);
  }

  const wd = new Map(state.workingDirectory);
  wd.delete(path);
  const staging = new Map(state.stagingArea);
  staging.delete(path);
  const removedFiles = new Set(state.removedFiles);
  removedFiles.add(path);

  return ok({ ...state, workingDirectory: wd, stagingArea: staging, removedFiles }, `rm '${path}'`, [
    { type: 'rm', from: 'working', to: 'working', files: [path] },
  ]);
}
