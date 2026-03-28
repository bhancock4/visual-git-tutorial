import type {
  RepoState,
  CommandResult,
  VirtualFile,
} from './types';
import {
  opInit, opStatus, opAdd, opCommit, opLog, opBranch, opCheckout,
  opRestoreFile, opUnstage, opMerge, opDiff, opPush, opPull, opFetch,
  opReset, opRevert, opStash, opReflog, opRemoteAdd, opRm,
  opCreateFile, opEditFile, opDeleteFile,
  type OpResult,
} from './operations';

// ---- State cloning (for getState/loadState boundary) ----

function cloneFileMap(m: Map<string, VirtualFile>): Map<string, VirtualFile> {
  const result = new Map<string, VirtualFile>();
  for (const [k, v] of m) {
    result.set(k, { ...v });
  }
  return result;
}

function cloneState(state: RepoState): RepoState {
  // Structural sharing: commits, stash entries, and reflog entries are immutable
  // once created, so we share them by reference. Only clone mutable containers.
  return {
    initialized: state.initialized,
    workingDirectory: cloneFileMap(state.workingDirectory),
    stagingArea: cloneFileMap(state.stagingArea),
    HEAD: { ...state.HEAD },
    branches: new Map(Array.from(state.branches).map(([k, v]) => [k, { ...v }])),
    commits: new Map(state.commits),
    remotes: new Map(Array.from(state.remotes).map(([k, v]) => [k, {
      ...v,
      branches: new Map(v.branches),
      commits: new Map(v.commits),
    }])),
    stash: [...state.stash],
    reflog: [...state.reflog],
    conflicts: state.conflicts.map(c => ({ ...c })),
    config: { ...state.config },
    gitignorePatterns: [...state.gitignorePatterns],
    removedFiles: new Set(state.removedFiles),
    pendingMergeParent: state.pendingMergeParent,
  };
}

function createEmptyState(): RepoState {
  return {
    initialized: false,
    workingDirectory: new Map(),
    stagingArea: new Map(),
    HEAD: { type: 'branch', name: 'main' },
    branches: new Map(),
    commits: new Map(),
    remotes: new Map(),
    stash: [],
    reflog: [],
    conflicts: [],
    config: { userName: 'You', userEmail: 'you@example.com' },
    gitignorePatterns: [],
    removedFiles: new Set(),
    pendingMergeParent: null,
  };
}

// ---- GitEngine: stateful wrapper around pure operations ----

export class GitEngine {
  private state: RepoState;

  constructor() {
    this.state = createEmptyState();
  }

  getState(): RepoState {
    return cloneState(this.state);
  }

  loadState(state: RepoState): void {
    this.state = cloneState(state);
  }

  /** Run a pure operation against current state without applying it */
  preview(op: (state: RepoState) => OpResult): CommandResult {
    const result = op(cloneState(this.state));
    return { success: result.success, output: result.output, state: cloneState(result.state), transitions: result.transitions };
  }

  // ---- Apply helper: runs pure op, applies state, returns CommandResult ----

  private apply(result: OpResult): CommandResult {
    this.state = result.state;
    return { success: result.success, output: result.output, state: this.getState(), transitions: result.transitions };
  }

  // ---- File operations ----

  createFile(path: string, content: string): CommandResult {
    return this.apply(opCreateFile(this.state, path, content));
  }

  editFile(path: string, content: string): CommandResult {
    return this.apply(opEditFile(this.state, path, content));
  }

  deleteFile(path: string): CommandResult {
    return this.apply(opDeleteFile(this.state, path));
  }

  // ---- Git commands ----

  init(): CommandResult {
    return this.apply(opInit(this.state));
  }

  status(): CommandResult {
    return this.apply(opStatus(this.state));
  }

  add(paths: string[]): CommandResult {
    return this.apply(opAdd(this.state, paths));
  }

  commit(message: string): CommandResult {
    return this.apply(opCommit(this.state, message));
  }

  log(options?: { oneline?: boolean; all?: boolean; count?: number }): CommandResult {
    return this.apply(opLog(this.state, options));
  }

  branch(name?: string, options?: { delete?: boolean; list?: boolean }): CommandResult {
    return this.apply(opBranch(this.state, name, options));
  }

  checkout(target: string, options?: { createBranch?: boolean }): CommandResult {
    return this.apply(opCheckout(this.state, target, options));
  }

  restoreFile(filePath: string): CommandResult {
    return this.apply(opRestoreFile(this.state, filePath));
  }

  unstage(filePath: string): CommandResult {
    return this.apply(opUnstage(this.state, filePath));
  }

  merge(branchName: string): CommandResult {
    return this.apply(opMerge(this.state, branchName));
  }

  diff(target?: string): CommandResult {
    return this.apply(opDiff(this.state, target));
  }

  push(remote?: string, branch?: string): CommandResult {
    return this.apply(opPush(this.state, remote, branch));
  }

  pull(remote?: string, branch?: string): CommandResult {
    return this.apply(opPull(this.state, remote, branch));
  }

  fetch(remote?: string): CommandResult {
    return this.apply(opFetch(this.state, remote));
  }

  reset(target?: string, mode?: string): CommandResult {
    return this.apply(opReset(this.state, target, mode));
  }

  revert(commitHash: string): CommandResult {
    return this.apply(opRevert(this.state, commitHash));
  }

  stash(action?: string): CommandResult {
    return this.apply(opStash(this.state, action));
  }

  reflog(): CommandResult {
    return this.apply(opReflog(this.state));
  }

  remoteAdd(name: string, url: string): CommandResult {
    return this.apply(opRemoteAdd(this.state, name, url));
  }

  rm(path: string): CommandResult {
    return this.apply(opRm(this.state, path));
  }
}
