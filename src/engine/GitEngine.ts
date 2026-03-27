import type {
  RepoState,
  CommandResult,
  CommitObject,
  StateTransition,
  VirtualFile,
  ConflictMarker,
} from './types';
import { generateHash } from './hash';

function cloneFileMap(m: Map<string, VirtualFile>): Map<string, VirtualFile> {
  const result = new Map<string, VirtualFile>();
  for (const [k, v] of m) {
    result.set(k, { ...v });
  }
  return result;
}

function cloneState(state: RepoState): RepoState {
  return {
    initialized: state.initialized,
    workingDirectory: cloneFileMap(state.workingDirectory),
    stagingArea: cloneFileMap(state.stagingArea),
    HEAD: { ...state.HEAD },
    branches: new Map(Array.from(state.branches).map(([k, v]) => [k, { ...v }])),
    commits: new Map(Array.from(state.commits).map(([k, v]) => [k, {
      ...v,
      parentHashes: [...v.parentHashes],
      snapshot: cloneFileMap(v.snapshot),
    }])),
    remotes: new Map(Array.from(state.remotes).map(([k, v]) => [k, {
      ...v,
      branches: new Map(v.branches),
      commits: new Map(Array.from(v.commits).map(([ck, cv]) => [ck, {
        ...cv,
        parentHashes: [...cv.parentHashes],
        snapshot: cloneFileMap(cv.snapshot),
      }])),
    }])),
    stash: state.stash.map(s => ({
      ...s,
      workingDirectory: cloneFileMap(s.workingDirectory),
      stagingArea: cloneFileMap(s.stagingArea),
    })),
    reflog: state.reflog.map(r => ({ ...r })),
    conflicts: state.conflicts.map(c => ({ ...c })),
    config: { ...state.config },
    gitignorePatterns: [...state.gitignorePatterns],
    removedFiles: new Set(state.removedFiles),
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
  };
}

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

  // ---- File operations (for scenario setup + simulated editing) ----

  createFile(path: string, content: string): CommandResult {
    this.state.workingDirectory.set(path, { path, content });
    return this.result(true, `Created file: ${path}`, []);
  }

  editFile(path: string, content: string): CommandResult {
    if (!this.state.workingDirectory.has(path)) {
      return this.result(false, `error: '${path}' does not exist`, []);
    }
    this.state.workingDirectory.set(path, { path, content });
    return this.result(true, `Edited file: ${path}`, []);
  }

  deleteFile(path: string): CommandResult {
    if (!this.state.workingDirectory.has(path)) {
      return this.result(false, `error: '${path}' does not exist`, []);
    }
    this.state.workingDirectory.delete(path);
    return this.result(true, `Deleted file: ${path}`, []);
  }

  // ---- Git commands ----

  init(): CommandResult {
    if (this.state.initialized) {
      return this.result(false, 'Reinitialized existing Git repository', []);
    }
    this.state.initialized = true;
    this.state.HEAD = { type: 'branch', name: 'main' };
    this.addReflog(null, 'init', 'initial');
    return this.result(true, 'Initialized empty Git repository', [{ type: 'init', from: 'working', to: 'working', files: [] }]);
  }

  status(): CommandResult {
    if (!this.requireInit()) {
      return this.notInitialized();
    }

    const lines: string[] = [];
    const currentBranch = this.getCurrentBranchName();
    lines.push(`On branch ${currentBranch}`);

    const headCommit = this.getHeadCommit();

    // Conflicts
    if (this.state.conflicts.length > 0) {
      lines.push('');
      lines.push('You have unmerged paths.');
      lines.push('  (fix conflicts and run "git add" to mark resolution)');
      lines.push('');
      lines.push('Unmerged paths:');
      for (const c of this.state.conflicts) {
        lines.push(`\tboth modified:   ${c.filePath}`);
      }
    }

    // Staged changes
    const staged = this.getStagedChanges(headCommit);
    if (staged.length > 0) {
      lines.push('');
      lines.push('Changes to be committed:');
      lines.push('  (use "git reset HEAD <file>" to unstage)');
      lines.push('');
      for (const change of staged) {
        lines.push(`\t${change.type}:   ${change.path}`);
      }
    }

    // Unstaged changes
    const unstaged = this.getUnstagedChanges();
    if (unstaged.length > 0) {
      lines.push('');
      lines.push('Changes not staged for commit:');
      lines.push('  (use "git add <file>" to update what will be committed)');
      lines.push('');
      for (const change of unstaged) {
        lines.push(`\t${change.type}:   ${change.path}`);
      }
    }

    // Untracked files
    const untracked = this.getUntrackedFiles(headCommit);
    if (untracked.length > 0) {
      lines.push('');
      lines.push('Untracked files:');
      lines.push('  (use "git add <file>" to include in what will be committed)');
      lines.push('');
      for (const f of untracked) {
        lines.push(`\t${f}`);
      }
    }

    if (staged.length === 0 && unstaged.length === 0 && untracked.length === 0 && this.state.conflicts.length === 0) {
      lines.push('');
      lines.push('nothing to commit, working tree clean');
    }

    return this.result(true, lines.join('\n'), []);
  }

  add(paths: string[]): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    const addAll = paths.includes('.') || paths.includes('-A') || paths.includes('--all');
    const filesToAdd: string[] = [];

    if (addAll) {
      for (const [path] of this.state.workingDirectory) {
        if (!this.isIgnored(path)) {
          filesToAdd.push(path);
        }
      }
      // Also stage deletions
      const headCommit = this.getHeadCommit();
      if (headCommit) {
        for (const [path] of headCommit.snapshot) {
          if (!this.state.workingDirectory.has(path) && !filesToAdd.includes(path)) {
            this.state.stagingArea.delete(path);
            this.state.removedFiles.add(path);
          }
        }
      }
    } else {
      for (const p of paths) {
        if (this.state.workingDirectory.has(p)) {
          if (this.isIgnored(p)) {
            return this.result(false, `The following paths are ignored by one of your .gitignore files:\n${p}`, []);
          }
          filesToAdd.push(p);
        } else {
          // Could be a deletion
          const headCommit = this.getHeadCommit();
          if (headCommit && headCommit.snapshot.has(p)) {
            this.state.stagingArea.delete(p);
            this.state.removedFiles.add(p);
            filesToAdd.push(p);
          } else {
            return this.result(false, `fatal: pathspec '${p}' did not match any files`, []);
          }
        }
      }
    }

    for (const path of filesToAdd) {
      const file = this.state.workingDirectory.get(path);
      if (file) {
        this.state.stagingArea.set(path, { ...file });
        this.state.removedFiles.delete(path);
      }
      // Remove from conflicts if present
      this.state.conflicts = this.state.conflicts.filter(c => c.filePath !== path);
    }

    const transitions: StateTransition[] = filesToAdd.length > 0
      ? [{ type: 'add', from: 'working', to: 'staging', files: filesToAdd }]
      : [];

    return this.result(true, '', transitions);
  }

  commit(message: string): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    if (this.state.conflicts.length > 0) {
      return this.result(false, 'error: Committing is not possible because you have unmerged files.\nfix conflicts and then commit the result.', []);
    }

    if (this.state.stagingArea.size === 0 && !this.state.removedFiles.size) {
      // Check if anything to commit
      const headCommit = this.getHeadCommit();
      if (headCommit) {
        return this.result(false, 'nothing to commit, working tree clean', []);
      }
      if (this.state.stagingArea.size === 0) {
        return this.result(false, 'nothing to commit (create/copy files and use "git add" to track)', []);
      }
    }

    const parentHashes: string[] = [];
    const headCommit = this.getHeadCommit();
    if (headCommit) {
      parentHashes.push(headCommit.hash);
    }

    // Build snapshot: start from parent, apply staging
    const snapshot = headCommit ? cloneFileMap(headCommit.snapshot) : new Map<string, VirtualFile>();

    for (const [path, file] of this.state.stagingArea) {
      snapshot.set(path, { ...file });
    }

    // Remove deleted files
    for (const path of this.state.removedFiles) {
      snapshot.delete(path);
    }

    const hash = generateHash(message + Date.now());
    const commit: CommitObject = {
      type: 'commit',
      hash,
      parentHashes,
      message,
      author: this.state.config.userName,
      timestamp: Date.now(),
      snapshot,
    };

    this.state.commits.set(hash, commit);
    this.updateCurrentBranch(hash);

    const committedFiles = Array.from(this.state.stagingArea.keys());
    this.state.stagingArea.clear();
    this.state.removedFiles.clear();

    this.addReflog(hash, 'commit', message);

    const shortHash = hash.slice(0, 7);
    const fileCount = committedFiles.length;
    const output = `[${this.getCurrentBranchName()} ${shortHash}] ${message}\n ${fileCount} file${fileCount !== 1 ? 's' : ''} changed`;

    return this.result(true, output, [
      { type: 'commit', from: 'staging', to: 'local', files: committedFiles },
    ]);
  }

  log(options?: { oneline?: boolean; all?: boolean; count?: number }): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    const headCommit = this.getHeadCommit();
    if (!headCommit) {
      return this.result(false, 'fatal: your current branch does not have any commits yet', []);
    }

    const commits = this.getCommitHistory(headCommit.hash, options?.count || 10);
    const lines: string[] = [];

    for (const commit of commits) {
      if (options?.oneline) {
        const branchLabels = this.getBranchLabelsForCommit(commit.hash);
        const labelStr = branchLabels.length > 0 ? ` (${branchLabels.join(', ')})` : '';
        lines.push(`${commit.hash}${labelStr} ${commit.message}`);
      } else {
        const branchLabels = this.getBranchLabelsForCommit(commit.hash);
        const labelStr = branchLabels.length > 0 ? ` (${branchLabels.join(', ')})` : '';
        lines.push(`commit ${commit.hash}${labelStr}`);
        lines.push(`Author: ${commit.author}`);
        lines.push(`Date:   ${new Date(commit.timestamp).toLocaleString()}`);
        lines.push('');
        lines.push(`    ${commit.message}`);
        lines.push('');
      }
    }

    return this.result(true, lines.join('\n'), []);
  }

  branch(name?: string, options?: { delete?: boolean; list?: boolean }): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    // List branches
    if (!name || options?.list) {
      const currentBranch = this.getCurrentBranchName();
      const lines: string[] = [];
      const branchNames = Array.from(this.state.branches.keys()).sort();

      if (branchNames.length === 0) {
        // No commits yet, just show current branch
        lines.push(`* ${currentBranch}`);
      } else {
        for (const b of branchNames) {
          const prefix = b === currentBranch ? '* ' : '  ';
          lines.push(`${prefix}${b}`);
        }
      }
      return this.result(true, lines.join('\n'), []);
    }

    // Delete branch
    if (options?.delete) {
      if (name === this.getCurrentBranchName()) {
        return this.result(false, `error: Cannot delete branch '${name}' checked out at current location`, []);
      }
      if (!this.state.branches.has(name)) {
        return this.result(false, `error: branch '${name}' not found`, []);
      }
      this.state.branches.delete(name);
      return this.result(true, `Deleted branch ${name}`, []);
    }

    // Create branch
    if (this.state.branches.has(name)) {
      return this.result(false, `fatal: A branch named '${name}' already exists`, []);
    }

    const headCommit = this.getHeadCommit();
    if (!headCommit) {
      return this.result(false, 'fatal: Not a valid object name: no commits yet', []);
    }

    this.state.branches.set(name, { name, commitHash: headCommit.hash });
    return this.result(true, `Created branch '${name}'`, []);
  }

  checkout(target: string, options?: { createBranch?: boolean }): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    if (this.state.conflicts.length > 0) {
      return this.result(false, 'error: you need to resolve your current merge conflicts before switching branches', []);
    }

    // Create and switch
    if (options?.createBranch) {
      const branchResult = this.branch(target);
      if (!branchResult.success) return branchResult;
    }

    // Switch to branch
    if (this.state.branches.has(target)) {
      const branch = this.state.branches.get(target)!;
      const prevHash = this.getHeadCommitHash();
      this.state.HEAD = { type: 'branch', name: target };

      const commit = this.state.commits.get(branch.commitHash);
      if (commit) {
        // Update working directory to match branch's latest commit
        this.state.workingDirectory = cloneFileMap(commit.snapshot);
        this.state.stagingArea.clear();
        this.state.removedFiles.clear();
      }

      this.addReflog(branch.commitHash, 'checkout', `moving from ${prevHash || 'none'} to ${target}`);

      return this.result(true, `Switched to branch '${target}'`, [
        { type: 'checkout', from: 'local', to: 'working', files: Array.from(this.state.workingDirectory.keys()) },
      ]);
    }

    // Detached HEAD to commit
    if (this.state.commits.has(target)) {
      const commit = this.state.commits.get(target)!;
      this.state.HEAD = { type: 'detached', commitHash: target };
      this.state.workingDirectory = cloneFileMap(commit.snapshot);
      this.state.stagingArea.clear();
      this.state.removedFiles.clear();

      return this.result(true, `Note: switching to '${target}'.\nYou are in 'detached HEAD' state.`, [
        { type: 'checkout', from: 'local', to: 'working', files: Array.from(commit.snapshot.keys()) },
      ]);
    }

    return this.result(false, `error: pathspec '${target}' did not match any file(s) known to git`, []);
  }

  merge(branchName: string): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    if (!this.state.branches.has(branchName)) {
      return this.result(false, `merge: ${branchName} - not something we can merge`, []);
    }

    const currentBranch = this.getCurrentBranchName();
    if (branchName === currentBranch) {
      return this.result(false, `Already on '${branchName}'`, []);
    }

    const targetBranch = this.state.branches.get(branchName)!;
    const targetCommit = this.state.commits.get(targetBranch.commitHash)!;
    const headCommit = this.getHeadCommit()!;

    // Check for fast-forward
    if (this.isAncestor(headCommit.hash, targetCommit.hash)) {
      // Fast-forward
      this.updateCurrentBranch(targetCommit.hash);
      this.state.workingDirectory = cloneFileMap(targetCommit.snapshot);
      this.state.stagingArea.clear();

      this.addReflog(targetCommit.hash, 'merge', `merge ${branchName}: Fast-forward`);

      return this.result(true, `Updating ${headCommit.hash}..${targetCommit.hash}\nFast-forward`, [
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
          // Conflict!
          conflicts.push({
            filePath: path,
            oursContent: ourFile.content,
            theirsContent: targetFile.content,
          });
          // Put conflict markers in working directory
          const conflictContent = `<<<<<<< HEAD\n${ourFile.content}\n=======\n${targetFile.content}\n>>>>>>> ${branchName}`;
          mergedSnapshot.set(path, { path, content: conflictContent });
        }
        // else: same content, no conflict
      } else {
        // New file from target branch
        mergedSnapshot.set(path, { ...targetFile });
      }
    }

    if (conflicts.length > 0) {
      this.state.conflicts = conflicts;
      this.state.workingDirectory = cloneFileMap(mergedSnapshot);
      return this.result(false,
        `Auto-merging failed\nCONFLICT (content): Merge conflict in ${conflicts.map(c => c.filePath).join(', ')}\nAutomatic merge failed; fix conflicts and then commit the result.`,
        [{ type: 'merge', from: 'local', to: 'working', files: conflicts.map(c => c.filePath) }]
      );
    }

    // Clean merge - create merge commit
    const hash = generateHash(`merge-${branchName}-${Date.now()}`);
    const mergeCommit: CommitObject = {
      type: 'commit',
      hash,
      parentHashes: [headCommit.hash, targetCommit.hash],
      message: `Merge branch '${branchName}'`,
      author: this.state.config.userName,
      timestamp: Date.now(),
      snapshot: mergedSnapshot,
    };

    this.state.commits.set(hash, mergeCommit);
    this.updateCurrentBranch(hash);
    this.state.workingDirectory = cloneFileMap(mergedSnapshot);
    this.state.stagingArea.clear();

    this.addReflog(hash, 'merge', `merge ${branchName}`);

    return this.result(true, `Merge made by the 'ort' strategy.\nMerge branch '${branchName}'`, [
      { type: 'merge', from: 'local', to: 'working', files: Array.from(mergedSnapshot.keys()) },
    ]);
  }

  diff(target?: string): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    const lines: string[] = [];

    if (target === '--staged' || target === '--cached') {
      // Diff between staging and HEAD
      const headCommit = this.getHeadCommit();
      const base = headCommit ? headCommit.snapshot : new Map<string, VirtualFile>();

      for (const [path, stagedFile] of this.state.stagingArea) {
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
          this.appendSimpleDiff(lines, baseFile.content, stagedFile.content);
        }
      }
    } else {
      // Diff between working directory and staging (or HEAD if not staged)
      for (const [path, wdFile] of this.state.workingDirectory) {
        const stagedFile = this.state.stagingArea.get(path);
        const headCommit = this.getHeadCommit();
        const baseFile = stagedFile || (headCommit ? headCommit.snapshot.get(path) : undefined);

        if (baseFile && baseFile.content !== wdFile.content) {
          lines.push(`diff --git a/${path} b/${path}`);
          lines.push(`--- a/${path}`);
          lines.push(`+++ b/${path}`);
          this.appendSimpleDiff(lines, baseFile.content, wdFile.content);
        }
      }
    }

    if (lines.length === 0) {
      return this.result(true, '', []);
    }

    return this.result(true, lines.join('\n'), []);
  }

  push(remote?: string, branch?: string): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    const remoteName = remote || 'origin';
    const branchName = branch || this.getCurrentBranchName();

    if (!this.state.remotes.has(remoteName)) {
      return this.result(false, `fatal: '${remoteName}' does not appear to be a git repository`, []);
    }

    const remoteRepo = this.state.remotes.get(remoteName)!;
    const localBranch = this.state.branches.get(branchName);
    if (!localBranch) {
      return this.result(false, `error: src refspec '${branchName}' does not match any`, []);
    }

    // Copy all reachable commits to remote
    const commits = this.getCommitHistory(localBranch.commitHash, 100);
    for (const commit of commits) {
      remoteRepo.commits.set(commit.hash, {
        ...commit,
        parentHashes: [...commit.parentHashes],
        snapshot: cloneFileMap(commit.snapshot),
      });
    }

    remoteRepo.branches.set(branchName, localBranch.commitHash);

    const headCommit = this.state.commits.get(localBranch.commitHash)!;
    const files = Array.from(headCommit.snapshot.keys());

    return this.result(true, `To ${remoteRepo.url}\n   ${localBranch.commitHash.slice(0, 7)}..${localBranch.commitHash.slice(0, 7)} ${branchName} -> ${branchName}`, [
      { type: 'push', from: 'local', to: 'remote', files },
    ]);
  }

  pull(remote?: string, branch?: string): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    const remoteName = remote || 'origin';
    const branchName = branch || this.getCurrentBranchName();

    if (!this.state.remotes.has(remoteName)) {
      return this.result(false, `fatal: '${remoteName}' does not appear to be a git repository`, []);
    }

    const remoteRepo = this.state.remotes.get(remoteName)!;
    const remoteBranchHash = remoteRepo.branches.get(branchName);

    if (!remoteBranchHash) {
      return this.result(false, `fatal: couldn't find remote ref '${branchName}'`, []);
    }

    // Copy commits from remote to local
    for (const [hash, commit] of remoteRepo.commits) {
      if (!this.state.commits.has(hash)) {
        this.state.commits.set(hash, {
          ...commit,
          parentHashes: [...commit.parentHashes],
          snapshot: cloneFileMap(commit.snapshot),
        });
      }
    }

    // Update local branch
    this.updateCurrentBranch(remoteBranchHash);
    const remoteCommit = this.state.commits.get(remoteBranchHash)!;
    this.state.workingDirectory = cloneFileMap(remoteCommit.snapshot);
    this.state.stagingArea.clear();

    this.addReflog(remoteBranchHash, 'pull', `pull ${remoteName}/${branchName}`);

    return this.result(true, `From ${remoteRepo.url}\nUpdating...Fast-forward`, [
      { type: 'pull', from: 'remote', to: 'working', files: Array.from(remoteCommit.snapshot.keys()) },
    ]);
  }

  fetch(remote?: string): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    const remoteName = remote || 'origin';
    if (!this.state.remotes.has(remoteName)) {
      return this.result(false, `fatal: '${remoteName}' does not appear to be a git repository`, []);
    }

    const remoteRepo = this.state.remotes.get(remoteName)!;

    // Copy all remote commits to local object store
    for (const [hash, commit] of remoteRepo.commits) {
      if (!this.state.commits.has(hash)) {
        this.state.commits.set(hash, {
          ...commit,
          parentHashes: [...commit.parentHashes],
          snapshot: cloneFileMap(commit.snapshot),
        });
      }
    }

    return this.result(true, `From ${remoteRepo.url}\n * [new branch]  main -> ${remoteName}/main`, [
      { type: 'fetch', from: 'remote', to: 'local', files: [] },
    ]);
  }

  reset(target?: string, mode?: string): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    // git reset HEAD <file> - unstage
    if (target && target !== '--soft' && target !== '--mixed' && target !== '--hard' && !target.startsWith('HEAD')) {
      // Unstage specific file
      const filePath = target;
      if (mode === 'HEAD' || !mode) {
        if (this.state.stagingArea.has(filePath)) {
          this.state.stagingArea.delete(filePath);
          return this.result(true, `Unstaged changes after reset:\n${filePath}`, [
            { type: 'reset', from: 'staging', to: 'working', files: [filePath] },
          ]);
        }
        return this.result(true, '', []);
      }
    }

    // Parse mode and target
    let resetMode = 'mixed';
    let resetTarget = 'HEAD';

    if (mode === '--soft' || target === '--soft') resetMode = 'soft';
    if (mode === '--hard' || target === '--hard') resetMode = 'hard';
    if (mode === '--mixed' || target === '--mixed') resetMode = 'mixed';

    // Find target commit
    if (target && target.startsWith('HEAD~')) {
      const steps = parseInt(target.slice(5)) || 1;
      let commit = this.getHeadCommit();
      for (let i = 0; i < steps && commit && commit.parentHashes.length > 0; i++) {
        commit = this.state.commits.get(commit.parentHashes[0]) || null;
      }
      if (!commit) return this.result(false, 'fatal: cannot reset past initial commit', []);
      resetTarget = commit.hash;
    } else if (target && !target.startsWith('--')) {
      resetTarget = target;
    }

    let targetCommit: CommitObject | undefined;
    if (resetTarget === 'HEAD') {
      targetCommit = this.getHeadCommit() || undefined;
    } else {
      targetCommit = this.state.commits.get(resetTarget);
    }

    if (!targetCommit) {
      return this.result(false, `fatal: ambiguous argument '${resetTarget}'`, []);
    }

    // Move branch pointer
    this.updateCurrentBranch(targetCommit.hash);

    if (resetMode === 'soft') {
      // Only move HEAD, keep staging and working directory
    } else if (resetMode === 'mixed') {
      // Reset staging, keep working directory
      this.state.stagingArea.clear();
    } else if (resetMode === 'hard') {
      // Reset everything
      this.state.stagingArea.clear();
      this.state.workingDirectory = cloneFileMap(targetCommit.snapshot);
      this.state.removedFiles.clear();
    }

    this.addReflog(targetCommit.hash, 'reset', `reset ${resetMode} to ${targetCommit.hash.slice(0, 7)}`);

    const files = Array.from(targetCommit.snapshot.keys());
    const transitionType = resetMode === 'hard' ? 'reset' as const : 'reset' as const;

    return this.result(true, `HEAD is now at ${targetCommit.hash.slice(0, 7)} ${targetCommit.message}`, [
      { type: transitionType, from: 'local', to: resetMode === 'hard' ? 'working' : 'staging', files },
    ]);
  }

  revert(commitHash: string): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    const commit = this.state.commits.get(commitHash);
    if (!commit) {
      return this.result(false, `fatal: bad revision '${commitHash}'`, []);
    }

    // Create a new commit that undoes the changes from the target commit
    const parentCommit = commit.parentHashes.length > 0
      ? this.state.commits.get(commit.parentHashes[0])
      : null;

    const currentSnapshot = this.getHeadCommit()!.snapshot;
    const revertedSnapshot = cloneFileMap(currentSnapshot);

    // For each file changed in the commit, revert to parent's version
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
      parentHashes: [this.getHeadCommitHash()!],
      message: `Revert "${commit.message}"`,
      author: this.state.config.userName,
      timestamp: Date.now(),
      snapshot: revertedSnapshot,
    };

    this.state.commits.set(hash, revertCommit);
    this.updateCurrentBranch(hash);
    this.state.workingDirectory = cloneFileMap(revertedSnapshot);
    this.state.stagingArea.clear();

    this.addReflog(hash, 'revert', `revert ${commitHash.slice(0, 7)}`);

    return this.result(true, `[${this.getCurrentBranchName()} ${hash.slice(0, 7)}] Revert "${commit.message}"`, [
      { type: 'revert', from: 'local', to: 'working', files: Array.from(revertedSnapshot.keys()) },
    ]);
  }

  stash(action?: string): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    if (!action || action === 'push') {
      // Check for changes to stash
      const headCommit = this.getHeadCommit();
      if (!headCommit) return this.result(false, 'No commits to stash against', []);

      const hasChanges = this.state.stagingArea.size > 0 ||
        this.hasWorkingDirectoryChanges(headCommit);

      if (!hasChanges) {
        return this.result(false, 'No local changes to save', []);
      }

      const entry = {
        id: this.state.stash.length,
        message: `WIP on ${this.getCurrentBranchName()}`,
        workingDirectory: cloneFileMap(this.state.workingDirectory),
        stagingArea: cloneFileMap(this.state.stagingArea),
        baseBranch: this.getCurrentBranchName(),
        baseCommitHash: headCommit.hash,
      };

      this.state.stash.unshift(entry);

      // Reset to HEAD
      this.state.workingDirectory = cloneFileMap(headCommit.snapshot);
      this.state.stagingArea.clear();

      return this.result(true, `Saved working directory and index state ${entry.message}`, [
        { type: 'stash', from: 'working', to: 'local', files: Array.from(entry.workingDirectory.keys()) },
      ]);
    }

    if (action === 'pop') {
      if (this.state.stash.length === 0) {
        return this.result(false, 'error: No stash entries found.', []);
      }

      const entry = this.state.stash.shift()!;
      this.state.workingDirectory = cloneFileMap(entry.workingDirectory);
      this.state.stagingArea = cloneFileMap(entry.stagingArea);

      return this.result(true, `On branch ${this.getCurrentBranchName()}\nDropped stash@{0}`, [
        { type: 'stash-pop', from: 'local', to: 'working', files: Array.from(entry.workingDirectory.keys()) },
      ]);
    }

    if (action === 'list') {
      if (this.state.stash.length === 0) {
        return this.result(true, '', []);
      }
      const lines = this.state.stash.map((s, i) => `stash@{${i}}: ${s.message}`);
      return this.result(true, lines.join('\n'), []);
    }

    if (action === 'drop') {
      if (this.state.stash.length === 0) {
        return this.result(false, 'error: No stash entries found.', []);
      }
      this.state.stash.shift();
      return this.result(true, 'Dropped stash@{0}', []);
    }

    return this.result(false, `error: unknown stash command '${action}'`, []);
  }

  reflog(): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    if (this.state.reflog.length === 0) {
      return this.result(true, '', []);
    }

    const lines = this.state.reflog.map((entry, i) =>
      `${entry.hash?.slice(0, 7) || '0000000'} HEAD@{${i}}: ${entry.action}: ${entry.message}`
    );

    return this.result(true, lines.join('\n'), []);
  }

  remoteAdd(name: string, url: string): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    if (this.state.remotes.has(name)) {
      return this.result(false, `error: remote ${name} already exists.`, []);
    }

    this.state.remotes.set(name, {
      name,
      url,
      branches: new Map(),
      commits: new Map(),
    });

    return this.result(true, '', []);
  }

  rm(path: string): CommandResult {
    if (!this.requireInit()) return this.notInitialized();

    const headCommit = this.getHeadCommit();
    const isTracked = headCommit?.snapshot.has(path) || this.state.stagingArea.has(path);

    if (!isTracked && !this.state.workingDirectory.has(path)) {
      return this.result(false, `fatal: pathspec '${path}' did not match any files`, []);
    }

    this.state.workingDirectory.delete(path);
    this.state.stagingArea.delete(path);
    this.state.removedFiles.add(path);

    return this.result(true, `rm '${path}'`, [
      { type: 'rm', from: 'working', to: 'working', files: [path] },
    ]);
  }

  // ---- Internal helpers ----

  private requireInit(): boolean {
    return this.state.initialized;
  }

  private notInitialized(): CommandResult {
    return this.result(false, 'fatal: not a git repository (or any of the parent directories): .git', []);
  }

  private result(success: boolean, output: string, transitions: StateTransition[]): CommandResult {
    return { success, output, state: this.getState(), transitions };
  }

  private getCurrentBranchName(): string {
    if (this.state.HEAD.type === 'branch') return this.state.HEAD.name;
    return 'HEAD (detached)';
  }

  private getHeadCommit(): CommitObject | null {
    if (this.state.HEAD.type === 'branch') {
      const branch = this.state.branches.get(this.state.HEAD.name);
      if (!branch) return null;
      return this.state.commits.get(branch.commitHash) || null;
    }
    return this.state.commits.get(this.state.HEAD.commitHash) || null;
  }

  private getHeadCommitHash(): string | null {
    const commit = this.getHeadCommit();
    return commit ? commit.hash : null;
  }

  private updateCurrentBranch(commitHash: string): void {
    if (this.state.HEAD.type === 'branch') {
      this.state.branches.set(this.state.HEAD.name, {
        name: this.state.HEAD.name,
        commitHash,
      });
    } else {
      this.state.HEAD = { type: 'detached', commitHash };
    }
  }

  private getCommitHistory(startHash: string, limit: number): CommitObject[] {
    const result: CommitObject[] = [];
    const visited = new Set<string>();
    const queue = [startHash];

    while (queue.length > 0 && result.length < limit) {
      const hash = queue.shift()!;
      if (visited.has(hash)) continue;
      visited.add(hash);

      const commit = this.state.commits.get(hash);
      if (!commit) continue;

      result.push(commit);
      queue.push(...commit.parentHashes);
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  private getBranchLabelsForCommit(hash: string): string[] {
    const labels: string[] = [];
    for (const [name, branch] of this.state.branches) {
      if (branch.commitHash === hash) {
        const isHead = this.state.HEAD.type === 'branch' && this.state.HEAD.name === name;
        labels.push(isHead ? `HEAD -> ${name}` : name);
      }
    }
    return labels;
  }

  private isAncestor(ancestorHash: string, descendantHash: string): boolean {
    const visited = new Set<string>();
    const queue = [descendantHash];

    while (queue.length > 0) {
      const hash = queue.shift()!;
      if (hash === ancestorHash) return true;
      if (visited.has(hash)) continue;
      visited.add(hash);

      const commit = this.state.commits.get(hash);
      if (commit) queue.push(...commit.parentHashes);
    }

    return false;
  }

  private getStagedChanges(headCommit: CommitObject | null): Array<{ type: string; path: string }> {
    const changes: Array<{ type: string; path: string }> = [];
    const base = headCommit ? headCommit.snapshot : new Map<string, VirtualFile>();

    for (const [path] of this.state.stagingArea) {
      if (!base.has(path)) {
        changes.push({ type: 'new file', path });
      } else {
        const baseFile = base.get(path)!;
        const stagedFile = this.state.stagingArea.get(path)!;
        if (baseFile.content !== stagedFile.content) {
          changes.push({ type: 'modified', path });
        }
      }
    }

    for (const path of this.state.removedFiles) {
      changes.push({ type: 'deleted', path });
    }

    return changes;
  }

  private getUnstagedChanges(): Array<{ type: string; path: string }> {
    const changes: Array<{ type: string; path: string }> = [];

    for (const [path, wdFile] of this.state.workingDirectory) {
      const stagedFile = this.state.stagingArea.get(path);
      if (stagedFile && stagedFile.content !== wdFile.content) {
        changes.push({ type: 'modified', path });
      }
    }

    return changes;
  }

  private getUntrackedFiles(headCommit: CommitObject | null): string[] {
    const tracked = new Set<string>();
    if (headCommit) {
      for (const [path] of headCommit.snapshot) tracked.add(path);
    }
    for (const [path] of this.state.stagingArea) tracked.add(path);

    const untracked: string[] = [];
    for (const [path] of this.state.workingDirectory) {
      if (!tracked.has(path) && !this.isIgnored(path)) {
        untracked.push(path);
      }
    }
    return untracked;
  }

  private hasWorkingDirectoryChanges(headCommit: CommitObject): boolean {
    if (this.state.workingDirectory.size !== headCommit.snapshot.size) return true;
    for (const [path, file] of this.state.workingDirectory) {
      const committed = headCommit.snapshot.get(path);
      if (!committed || committed.content !== file.content) return true;
    }
    return false;
  }

  private isIgnored(path: string): boolean {
    for (const pattern of this.state.gitignorePatterns) {
      if (this.matchGitignore(pattern, path)) return true;
    }
    return false;
  }

  private matchGitignore(pattern: string, path: string): boolean {
    // Simple gitignore matching
    const regex = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(path) || new RegExp(`^${regex}$`).test(path.split('/').pop() || '');
  }

  private appendSimpleDiff(lines: string[], oldContent: string, newContent: string): void {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // Simple line-by-line diff
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

  private addReflog(hash: string | null, action: string, message: string): void {
    const prevEntry = this.state.reflog.length > 0 ? this.state.reflog[0] : null;
    this.state.reflog.unshift({
      hash: hash || '0000000',
      previousHash: prevEntry?.hash || null,
      action,
      message,
      timestamp: Date.now(),
    });
  }
}
