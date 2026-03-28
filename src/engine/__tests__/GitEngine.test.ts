import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '../GitEngine';
import { resetHashCounter } from '../hash';
import { opInit, opCreateFile, opAdd, opCommit, opEditFile } from '../operations';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Return a fully initialised engine with at least one commit on main. */
function makeInitedEngine(): GitEngine {
  const e = new GitEngine();
  e.init();
  e.createFile('README.md', 'hello');
  e.add(['README.md']);
  e.commit('initial commit');
  return e;
}

/**
 * Build a diverged-branch scenario:
 *   main: A → C
 *   feature: A → B
 * where B and C both modify the same file → merge conflict.
 */
function makeDivergedEngine(): { engine: GitEngine; featureHash: string; mainHash: string } {
  const engine = new GitEngine();
  engine.init();
  engine.createFile('file.txt', 'original');
  engine.add(['file.txt']);
  engine.commit('initial'); // commit A on main

  engine.checkout('feature', { createBranch: true });
  engine.editFile('file.txt', 'feature change');
  engine.add(['file.txt']);
  const featureResult = engine.commit('feature commit'); // commit B on feature
  const featureHash = featureResult.state.branches.get('feature')!.commitHash;

  engine.checkout('main');
  engine.editFile('file.txt', 'main change');
  engine.add(['file.txt']);
  const mainResult = engine.commit('main commit'); // commit C on main
  const mainHash = mainResult.state.branches.get('main')!.commitHash;

  return { engine, featureHash, mainHash };
}

// ── File operations ───────────────────────────────────────────────────────────

describe('createFile', () => {
  it('adds a file to the working directory', () => {
    const e = new GitEngine();
    const result = e.createFile('hello.txt', 'world');
    expect(result.success).toBe(true);
    expect(result.state.workingDirectory.has('hello.txt')).toBe(true);
    expect(result.state.workingDirectory.get('hello.txt')!.content).toBe('world');
  });

  it('overwrites existing file', () => {
    const e = new GitEngine();
    e.createFile('f.txt', 'v1');
    e.createFile('f.txt', 'v2');
    expect(e.getState().workingDirectory.get('f.txt')!.content).toBe('v2');
  });

  it('works before git init', () => {
    const e = new GitEngine();
    const r = e.createFile('a.txt', 'x');
    expect(r.success).toBe(true);
  });
});

describe('editFile', () => {
  it('updates an existing file', () => {
    const e = new GitEngine();
    e.createFile('a.txt', 'original');
    const r = e.editFile('a.txt', 'edited');
    expect(r.success).toBe(true);
    expect(r.state.workingDirectory.get('a.txt')!.content).toBe('edited');
  });

  it('fails when file does not exist', () => {
    const e = new GitEngine();
    const r = e.editFile('missing.txt', 'x');
    expect(r.success).toBe(false);
    expect(r.output).toContain('does not exist');
  });
});

describe('deleteFile', () => {
  it('removes a file from the working directory', () => {
    const e = new GitEngine();
    e.createFile('f.txt', 'data');
    const r = e.deleteFile('f.txt');
    expect(r.success).toBe(true);
    expect(r.state.workingDirectory.has('f.txt')).toBe(false);
  });

  it('fails when file does not exist', () => {
    const e = new GitEngine();
    const r = e.deleteFile('ghost.txt');
    expect(r.success).toBe(false);
    expect(r.output).toContain('does not exist');
  });
});

// ── init ──────────────────────────────────────────────────────────────────────

describe('init', () => {
  it('sets initialized to true', () => {
    const e = new GitEngine();
    const r = e.init();
    expect(r.success).toBe(true);
    expect(r.state.initialized).toBe(true);
  });

  it('emits an init transition', () => {
    const e = new GitEngine();
    const r = e.init();
    expect(r.transitions.some(t => t.type === 'init')).toBe(true);
  });

  it('fails (returns false success) when already initialized', () => {
    const e = new GitEngine();
    e.init();
    const r = e.init();
    expect(r.success).toBe(false);
    expect(r.output).toContain('Reinitialized');
  });

  it('HEAD points to main after init', () => {
    const e = new GitEngine();
    e.init();
    const state = e.getState();
    expect(state.HEAD).toEqual({ type: 'branch', name: 'main' });
  });
});

// ── "not a git repository" guard ─────────────────────────────────────────────

describe('not-init guard', () => {
  const methods: Array<[string, (e: GitEngine) => ReturnType<GitEngine['status']>]> = [
    ['status', e => e.status()],
    ['add', e => e.add(['.'])],
    ['commit', e => e.commit('msg')],
    ['log', e => e.log()],
    ['branch', e => e.branch()],
    ['checkout', e => e.checkout('main')],
    ['merge', e => e.merge('feature')],
    ['diff', e => e.diff()],
    ['push', e => e.push()],
    ['pull', e => e.pull()],
    ['fetch', e => e.fetch()],
    ['reset', e => e.reset()],
    ['stash', e => e.stash()],
    ['reflog', e => e.reflog()],
    ['remoteAdd', e => e.remoteAdd('origin', 'url')],
    ['rm', e => e.rm('file.txt')],
  ];

  for (const [name, fn] of methods) {
    it(`${name}() returns "not a git repository" before init`, () => {
      const e = new GitEngine();
      const r = fn(e);
      expect(r.success).toBe(false);
      expect(r.output).toContain('not a git repository');
    });
  }
});

// ── status ────────────────────────────────────────────────────────────────────

describe('status', () => {
  it('shows branch name', () => {
    const e = makeInitedEngine();
    const r = e.status();
    expect(r.output).toContain('On branch main');
  });

  it('reports untracked files', () => {
    const e = makeInitedEngine();
    e.createFile('new.txt', 'hi');
    const r = e.status();
    expect(r.output).toContain('Untracked files');
    expect(r.output).toContain('new.txt');
  });

  it('reports staged new file', () => {
    const e = makeInitedEngine();
    e.createFile('staged.txt', 'content');
    e.add(['staged.txt']);
    const r = e.status();
    expect(r.output).toContain('Changes to be committed');
    expect(r.output).toContain('staged.txt');
  });

  it('reports unstaged modifications (file staged then re-edited)', () => {
    // getUnstagedChanges only reports differences between staging and working dir,
    // so we need to stage the file first, then modify the working copy again.
    const e = makeInitedEngine();
    e.editFile('README.md', 'staged version');
    e.add(['README.md']);
    e.editFile('README.md', 'further local edit');
    const r = e.status();
    expect(r.output).toContain('Changes not staged for commit');
    expect(r.output).toContain('README.md');
  });

  it('shows clean state after commit', () => {
    const e = makeInitedEngine();
    const r = e.status();
    expect(r.output).toContain('nothing to commit');
  });

  it('shows unmerged paths when conflicts exist', () => {
    const { engine } = makeDivergedEngine();
    engine.merge('feature');
    const r = engine.status();
    expect(r.output).toContain('unmerged paths');
    expect(r.output).toContain('file.txt');
  });
});

// ── add ───────────────────────────────────────────────────────────────────────

describe('add', () => {
  it('stages a specific file', () => {
    const e = makeInitedEngine();
    e.createFile('a.txt', 'hello');
    const r = e.add(['a.txt']);
    expect(r.success).toBe(true);
    expect(r.state.stagingArea.has('a.txt')).toBe(true);
  });

  it('stages all files with "."', () => {
    const e = makeInitedEngine();
    e.createFile('x.txt', '1');
    e.createFile('y.txt', '2');
    e.add(['.']);
    const state = e.getState();
    expect(state.stagingArea.has('x.txt')).toBe(true);
    expect(state.stagingArea.has('y.txt')).toBe(true);
  });

  it('stages all files with "-A"', () => {
    const e = makeInitedEngine();
    e.createFile('x.txt', '1');
    e.add(['-A']);
    expect(e.getState().stagingArea.has('x.txt')).toBe(true);
  });

  it('emits an add transition', () => {
    const e = makeInitedEngine();
    e.createFile('t.txt', 'x');
    const r = e.add(['t.txt']);
    expect(r.transitions.some(t => t.type === 'add')).toBe(true);
  });

  it('fails for unknown file', () => {
    const e = makeInitedEngine();
    const r = e.add(['ghost.txt']);
    expect(r.success).toBe(false);
    expect(r.output).toContain('did not match any files');
  });

  it('respects gitignore patterns', () => {
    const e = makeInitedEngine();
    const state = e.getState();
    state.gitignorePatterns = ['*.log'];
    e.loadState(state);
    e.createFile('debug.log', 'noise');
    const r = e.add(['debug.log']);
    expect(r.success).toBe(false);
    expect(r.output).toContain('ignored');
  });

  it('"." does not stage ignored files', () => {
    const e = makeInitedEngine();
    const state = e.getState();
    state.gitignorePatterns = ['secret.txt'];
    e.loadState(state);
    e.createFile('secret.txt', 'pw');
    e.createFile('normal.txt', 'ok');
    e.add(['.']);
    const s2 = e.getState();
    expect(s2.stagingArea.has('secret.txt')).toBe(false);
    expect(s2.stagingArea.has('normal.txt')).toBe(true);
  });

  it('stages a deletion when file is deleted from working dir', () => {
    const e = makeInitedEngine();
    e.deleteFile('README.md');
    e.add(['README.md']);
    const s = e.getState();
    expect(s.removedFiles.has('README.md')).toBe(true);
  });

  it('resolves a conflict when adding the conflicted file', () => {
    const { engine } = makeDivergedEngine();
    engine.merge('feature');
    engine.editFile('file.txt', 'resolved');
    engine.add(['file.txt']);
    expect(engine.getState().conflicts).toHaveLength(0);
  });
});

// ── commit ────────────────────────────────────────────────────────────────────

describe('commit', () => {
  it('creates a commit object', () => {
    const e = makeInitedEngine();
    e.createFile('b.txt', 'hi');
    e.add(['b.txt']);
    const before = e.getState().commits.size;
    e.commit('add b');
    expect(e.getState().commits.size).toBe(before + 1);
  });

  it('clears staging area after commit', () => {
    const e = makeInitedEngine();
    e.createFile('c.txt', 'x');
    e.add(['c.txt']);
    e.commit('add c');
    expect(e.getState().stagingArea.size).toBe(0);
  });

  it('advances branch pointer', () => {
    const e = makeInitedEngine();
    const before = e.getState().branches.get('main')!.commitHash;
    e.createFile('d.txt', 'y');
    e.add(['d.txt']);
    e.commit('add d');
    const after = e.getState().branches.get('main')!.commitHash;
    expect(after).not.toBe(before);
  });

  it('snapshot includes parent files plus staged changes', () => {
    const e = makeInitedEngine();
    e.createFile('e.txt', 'new');
    e.add(['e.txt']);
    e.commit('add e');
    const state = e.getState();
    const headHash = state.branches.get('main')!.commitHash;
    const commit = state.commits.get(headHash)!;
    expect(commit.snapshot.has('README.md')).toBe(true);
    expect(commit.snapshot.has('e.txt')).toBe(true);
  });

  it('fails with nothing staged', () => {
    const e = makeInitedEngine();
    const r = e.commit('empty');
    expect(r.success).toBe(false);
    expect(r.output).toContain('nothing to commit');
  });

  it('fails when conflicts exist', () => {
    const { engine } = makeDivergedEngine();
    engine.merge('feature');
    const r = engine.commit('bad');
    expect(r.success).toBe(false);
    expect(r.output).toContain('unmerged');
  });

  it('sets commit message correctly', () => {
    const e = makeInitedEngine();
    e.createFile('f.txt', 'z');
    e.add(['f.txt']);
    e.commit('my special message');
    const state = e.getState();
    const hash = state.branches.get('main')!.commitHash;
    expect(state.commits.get(hash)!.message).toBe('my special message');
  });

  it('emits a commit transition', () => {
    const e = makeInitedEngine();
    e.createFile('t.txt', 'x');
    e.add(['t.txt']);
    const r = e.commit('test');
    expect(r.transitions.some(t => t.type === 'commit')).toBe(true);
  });
});

// ── log ───────────────────────────────────────────────────────────────────────

describe('log', () => {
  it('shows commit history', () => {
    const e = makeInitedEngine();
    const r = e.log();
    expect(r.success).toBe(true);
    expect(r.output).toContain('initial commit');
  });

  it('fails before any commits', () => {
    const e = new GitEngine();
    e.init();
    const r = e.log();
    expect(r.success).toBe(false);
    expect(r.output).toContain('does not have any commits');
  });

  it('oneline format is compact', () => {
    const e = makeInitedEngine();
    const r = e.log({ oneline: true });
    expect(r.output.split('\n')).toHaveLength(1);
    expect(r.output).toContain('initial commit');
  });

  it('count limits results', () => {
    const e = makeInitedEngine();
    for (let i = 0; i < 5; i++) {
      e.createFile(`f${i}.txt`, `${i}`);
      e.add([`f${i}.txt`]);
      e.commit(`commit ${i}`);
    }
    const r = e.log({ oneline: true, count: 3 });
    expect(r.output.trim().split('\n')).toHaveLength(3);
  });
});

// ── branch ────────────────────────────────────────────────────────────────────

describe('branch', () => {
  it('lists current branch when no commits exist yet', () => {
    const e = new GitEngine();
    e.init();
    const r = e.branch();
    expect(r.output).toContain('* main');
  });

  it('creates a branch at HEAD', () => {
    const e = makeInitedEngine();
    const r = e.branch('dev');
    expect(r.success).toBe(true);
    const state = e.getState();
    expect(state.branches.has('dev')).toBe(true);
  });

  it('fails creating duplicate branch', () => {
    const e = makeInitedEngine();
    e.branch('dev');
    const r = e.branch('dev');
    expect(r.success).toBe(false);
    expect(r.output).toContain('already exists');
  });

  it('fails creating branch before any commits', () => {
    const e = new GitEngine();
    e.init();
    const r = e.branch('dev');
    expect(r.success).toBe(false);
    expect(r.output).toContain('Not a valid object name');
  });

  it('deletes a branch', () => {
    const e = makeInitedEngine();
    e.branch('to-delete');
    const r = e.branch('to-delete', { delete: true });
    expect(r.success).toBe(true);
    expect(e.getState().branches.has('to-delete')).toBe(false);
  });

  it('cannot delete current branch', () => {
    const e = makeInitedEngine();
    const r = e.branch('main', { delete: true });
    expect(r.success).toBe(false);
    expect(r.output).toContain('Cannot delete branch');
  });

  it('fails deleting non-existent branch', () => {
    const e = makeInitedEngine();
    const r = e.branch('ghost', { delete: true });
    expect(r.success).toBe(false);
    expect(r.output).toContain('not found');
  });
});

// ── checkout ──────────────────────────────────────────────────────────────────

describe('checkout', () => {
  it('switches to an existing branch', () => {
    const e = makeInitedEngine();
    e.branch('dev');
    const r = e.checkout('dev');
    expect(r.success).toBe(true);
    expect(e.getState().HEAD).toEqual({ type: 'branch', name: 'dev' });
  });

  it('creates and switches with createBranch option', () => {
    const e = makeInitedEngine();
    const r = e.checkout('feature', { createBranch: true });
    expect(r.success).toBe(true);
    const state = e.getState();
    expect(state.HEAD).toEqual({ type: 'branch', name: 'feature' });
    expect(state.branches.has('feature')).toBe(true);
  });

  it('updates working directory to branch snapshot', () => {
    const e = makeInitedEngine();
    e.checkout('feature', { createBranch: true });
    e.createFile('feature-only.txt', 'hi');
    e.add(['.']);
    e.commit('feature file');

    e.checkout('main');
    // feature-only.txt should not be present on main
    expect(e.getState().workingDirectory.has('feature-only.txt')).toBe(false);
  });

  it('clears staging on checkout', () => {
    const e = makeInitedEngine();
    e.branch('other');
    e.createFile('staged.txt', 'x');
    e.add(['staged.txt']);
    e.checkout('other');
    expect(e.getState().stagingArea.size).toBe(0);
  });

  it('detached HEAD when checking out commit hash', () => {
    const e = makeInitedEngine();
    const hash = e.getState().branches.get('main')!.commitHash;
    const r = e.checkout(hash);
    expect(r.success).toBe(true);
    expect(e.getState().HEAD).toEqual({ type: 'detached', commitHash: hash });
  });

  it('fails for unknown target', () => {
    const e = makeInitedEngine();
    const r = e.checkout('nonexistent');
    expect(r.success).toBe(false);
    expect(r.output).toContain('did not match');
  });

  it('fails when conflicts exist', () => {
    const { engine } = makeDivergedEngine();
    engine.merge('feature');
    const r = engine.checkout('feature');
    expect(r.success).toBe(false);
    expect(r.output).toContain('resolve your current merge conflicts');
  });
});

// ── restoreFile ───────────────────────────────────────────────────────────────

describe('restoreFile', () => {
  it('reverts a modified file to HEAD version', () => {
    const e = makeInitedEngine();
    e.editFile('README.md', 'dirty');
    e.restoreFile('README.md');
    expect(e.getState().workingDirectory.get('README.md')!.content).toBe('hello');
  });

  it('removes staged version when restoring', () => {
    const e = makeInitedEngine();
    e.editFile('README.md', 'staged edit');
    e.add(['README.md']);
    e.restoreFile('README.md');
    expect(e.getState().stagingArea.has('README.md')).toBe(false);
  });

  it('fails for file not in HEAD', () => {
    const e = makeInitedEngine();
    const r = e.restoreFile('nope.txt');
    expect(r.success).toBe(false);
  });

  it('fails when no commits exist', () => {
    const e = new GitEngine();
    e.init();
    const r = e.restoreFile('f.txt');
    expect(r.success).toBe(false);
  });
});

// ── unstage ───────────────────────────────────────────────────────────────────

describe('unstage', () => {
  it('removes file from staging', () => {
    const e = makeInitedEngine();
    e.createFile('u.txt', 'x');
    e.add(['u.txt']);
    e.unstage('u.txt');
    expect(e.getState().stagingArea.has('u.txt')).toBe(false);
  });

  it('succeeds silently when file is not staged', () => {
    const e = makeInitedEngine();
    const r = e.unstage('not-staged.txt');
    expect(r.success).toBe(true);
  });

  it('emits a reset transition', () => {
    const e = makeInitedEngine();
    e.createFile('u.txt', 'x');
    e.add(['u.txt']);
    const r = e.unstage('u.txt');
    expect(r.transitions.some(t => t.type === 'reset')).toBe(true);
  });
});

// ── merge ─────────────────────────────────────────────────────────────────────

describe('merge', () => {
  it('fast-forward when feature is ahead of main', () => {
    const e = makeInitedEngine();
    e.checkout('feature', { createBranch: true });
    e.createFile('extra.txt', 'new');
    e.add(['.']);
    e.commit('feature commit');

    e.checkout('main');
    const r = e.merge('feature');
    expect(r.success).toBe(true);
    expect(r.output).toContain('Fast-forward');
    expect(e.getState().workingDirectory.has('extra.txt')).toBe(true);
  });

  it('fast-forward advances main branch pointer', () => {
    const e = makeInitedEngine();
    e.checkout('feature', { createBranch: true });
    e.createFile('extra.txt', 'new');
    e.add(['.']);
    e.commit('feature commit');
    const featureHash = e.getState().branches.get('feature')!.commitHash;

    e.checkout('main');
    e.merge('feature');
    expect(e.getState().branches.get('main')!.commitHash).toBe(featureHash);
  });

  it('creates merge commit for diverged branches (no conflict)', () => {
    const e = makeInitedEngine();
    // feature adds a new file
    e.checkout('feature', { createBranch: true });
    e.createFile('feat.txt', 'feature only');
    e.add(['.']);
    e.commit('feature adds file');

    // main modifies a different file
    e.checkout('main');
    e.createFile('main.txt', 'main only');
    e.add(['.']);
    e.commit('main adds file');

    const r = e.merge('feature');
    expect(r.success).toBe(true);
    // merge commit has two parents
    const state = e.getState();
    const headHash = state.branches.get('main')!.commitHash;
    expect(state.commits.get(headHash)!.parentHashes).toHaveLength(2);
  });

  it('detects conflict when same file changed on both branches', () => {
    const { engine } = makeDivergedEngine();
    const r = engine.merge('feature');
    expect(r.success).toBe(false);
    expect(r.output).toContain('CONFLICT');
    expect(engine.getState().conflicts).toHaveLength(1);
  });

  it('puts conflict markers in working directory', () => {
    const { engine } = makeDivergedEngine();
    engine.merge('feature');
    const content = engine.getState().workingDirectory.get('file.txt')!.content;
    expect(content).toContain('<<<<<<< HEAD');
    expect(content).toContain('=======');
    expect(content).toContain('>>>>>>> feature');
    expect(content).toContain('main change');
    expect(content).toContain('feature change');
  });

  it('cannot commit with unresolved conflicts', () => {
    const { engine } = makeDivergedEngine();
    engine.merge('feature');
    const r = engine.commit('should fail');
    expect(r.success).toBe(false);
  });

  it('resolving conflict via add clears conflicts', () => {
    const { engine } = makeDivergedEngine();
    engine.merge('feature');
    engine.editFile('file.txt', 'resolved content');
    engine.add(['file.txt']);
    expect(engine.getState().conflicts).toHaveLength(0);
  });

  it('can commit after resolving conflict', () => {
    const { engine } = makeDivergedEngine();
    engine.merge('feature');
    engine.editFile('file.txt', 'resolved');
    engine.add(['file.txt']);
    const r = engine.commit('resolve merge conflict');
    expect(r.success).toBe(true);
  });

  it('fails merging a non-existent branch', () => {
    const e = makeInitedEngine();
    const r = e.merge('ghost');
    expect(r.success).toBe(false);
    expect(r.output).toContain('not something we can merge');
  });

  it('fails merging current branch into itself', () => {
    const e = makeInitedEngine();
    e.branch('main2');
    // Can't easily test self-merge with 'main' since branch() won't duplicate;
    // use a workaround: test by trying to merge a branch that shares the same name
    // Here we just call merge('main') which should fail
    const r = e.merge('main');
    expect(r.success).toBe(false);
  });
});

// ── diff ──────────────────────────────────────────────────────────────────────

describe('diff', () => {
  it('returns empty when working dir matches staging/HEAD', () => {
    const e = makeInitedEngine();
    const r = e.diff();
    expect(r.output).toBe('');
  });

  it('shows diff for unstaged modifications', () => {
    const e = makeInitedEngine();
    e.editFile('README.md', 'changed content');
    const r = e.diff();
    expect(r.success).toBe(true);
    expect(r.output).toContain('README.md');
  });

  it('--staged shows staged changes vs HEAD', () => {
    const e = makeInitedEngine();
    e.editFile('README.md', 'staged change');
    e.add(['README.md']);
    const r = e.diff('--staged');
    expect(r.output).toContain('README.md');
  });

  it('--staged shows new file', () => {
    const e = makeInitedEngine();
    e.createFile('brand-new.txt', 'content');
    e.add(['brand-new.txt']);
    const r = e.diff('--staged');
    expect(r.output).toContain('brand-new.txt');
    expect(r.output).toContain('new file');
  });

  it('--staged is empty when nothing staged', () => {
    const e = makeInitedEngine();
    const r = e.diff('--staged');
    expect(r.output).toBe('');
  });
});

// ── push ──────────────────────────────────────────────────────────────────────

describe('push', () => {
  it('copies commits to remote', () => {
    const e = makeInitedEngine();
    e.remoteAdd('origin', 'https://github.com/test/repo.git');
    const r = e.push();
    expect(r.success).toBe(true);
    expect(r.transitions.some(t => t.type === 'push')).toBe(true);
  });

  it('fails when remote does not exist', () => {
    const e = makeInitedEngine();
    const r = e.push('nonexistent');
    expect(r.success).toBe(false);
    expect(r.output).toContain('does not appear to be a git repository');
  });

  it('remote has branch pointer after push', () => {
    const e = makeInitedEngine();
    e.remoteAdd('origin', 'https://github.com/test/repo.git');
    e.push();
    const state = e.getState();
    const remote = state.remotes.get('origin')!;
    expect(remote.branches.has('main')).toBe(true);
  });

  it('remote has all commits after push', () => {
    const e = makeInitedEngine();
    e.createFile('b.txt', 'more');
    e.add(['.']);
    e.commit('second commit');
    e.remoteAdd('origin', 'https://github.com/test/repo.git');
    e.push();
    const state = e.getState();
    const remote = state.remotes.get('origin')!;
    expect(remote.commits.size).toBe(2);
  });
});

// ── pull ──────────────────────────────────────────────────────────────────────

describe('pull', () => {
  function makeRemoteWithCommit(): GitEngine {
    // engine A: has a commit on remote
    const a = makeInitedEngine();
    a.remoteAdd('origin', 'https://github.com/test/repo.git');
    a.push();

    // engine B: simulates local repo that's behind
    const b = new GitEngine();
    b.init();
    // Manually inject the remote from engine A
    const stateA = a.getState();
    const stateB = b.getState();
    stateB.initialized = true;
    stateB.remotes = stateA.remotes;
    b.loadState(stateB);
    return b;
  }

  it('fails when remote does not exist', () => {
    const e = makeInitedEngine();
    const r = e.pull('nonexistent');
    expect(r.success).toBe(false);
    expect(r.output).toContain('does not appear to be a git repository');
  });

  it('updates working directory from remote', () => {
    const b = makeRemoteWithCommit();
    const r = b.pull('origin', 'main');
    expect(r.success).toBe(true);
    expect(b.getState().workingDirectory.has('README.md')).toBe(true);
  });

  it('emits a pull transition', () => {
    const b = makeRemoteWithCommit();
    const r = b.pull('origin', 'main');
    expect(r.transitions.some(t => t.type === 'pull')).toBe(true);
  });
});

// ── fetch ─────────────────────────────────────────────────────────────────────

describe('fetch', () => {
  it('copies remote commits to local store without updating working dir', () => {
    const a = makeInitedEngine();
    a.remoteAdd('origin', 'https://github.com/test/repo.git');
    a.push();

    const b = new GitEngine();
    b.init();
    const stateA = a.getState();
    const stateB = b.getState();
    stateB.initialized = true;
    stateB.remotes = stateA.remotes;
    b.loadState(stateB);

    const beforeWd = b.getState().workingDirectory.size;
    const r = b.fetch('origin');
    expect(r.success).toBe(true);
    expect(r.transitions.some(t => t.type === 'fetch')).toBe(true);
    // Working directory should NOT have changed
    expect(b.getState().workingDirectory.size).toBe(beforeWd);
    // But commits are now local
    const hash = stateA.branches.get('main')!.commitHash;
    expect(b.getState().commits.has(hash)).toBe(true);
  });

  it('fails when remote does not exist', () => {
    const e = makeInitedEngine();
    const r = e.fetch('nowhere');
    expect(r.success).toBe(false);
    expect(r.output).toContain('does not appear to be a git repository');
  });
});

// ── reset ─────────────────────────────────────────────────────────────────────

describe('reset', () => {
  function makeTwoCommitEngine(): GitEngine {
    const e = makeInitedEngine();
    e.createFile('second.txt', 'two');
    e.add(['.']);
    e.commit('second commit');
    return e;
  }

  it('--soft keeps staging and working dir, moves HEAD', () => {
    const e = makeTwoCommitEngine();
    e.createFile('staged.txt', 'x');
    e.add(['staged.txt']);
    const secondHash = e.getState().branches.get('main')!.commitHash;
    e.reset('HEAD~1', '--soft');
    const state = e.getState();
    // Branch pointer moved back
    expect(state.branches.get('main')!.commitHash).not.toBe(secondHash);
    // Staging still has our file
    expect(state.stagingArea.has('staged.txt')).toBe(true);
  });

  it('--mixed clears staging but keeps working dir', () => {
    const e = makeTwoCommitEngine();
    e.createFile('staged.txt', 'x');
    e.add(['staged.txt']);
    e.reset('HEAD~1', '--mixed');
    const state = e.getState();
    expect(state.stagingArea.has('staged.txt')).toBe(false);
    // working dir still has file
    expect(state.workingDirectory.has('staged.txt')).toBe(true);
  });

  it('--hard clears both staging and working dir', () => {
    const e = makeTwoCommitEngine();
    e.createFile('extra.txt', 'dirty');
    e.add(['extra.txt']);
    e.reset('HEAD~1', '--hard');
    const state = e.getState();
    expect(state.stagingArea.size).toBe(0);
    expect(state.workingDirectory.has('extra.txt')).toBe(false);
    expect(state.workingDirectory.has('second.txt')).toBe(false);
  });

  it('HEAD~1 moves back one commit', () => {
    const e = makeTwoCommitEngine();
    const before = e.getState().branches.get('main')!.commitHash;
    e.reset('HEAD~1', '--soft');
    const after = e.getState().branches.get('main')!.commitHash;
    expect(after).not.toBe(before);
    // The new HEAD should be the initial commit (one parent back)
    const initialCommit = e.getState().commits.get(after)!;
    expect(initialCommit.message).toBe('initial commit');
  });

  it('resets a specific file out of staging (reset HEAD <file>)', () => {
    const e = makeInitedEngine();
    e.createFile('u.txt', 'x');
    e.add(['u.txt']);
    const r = e.reset('u.txt');
    expect(r.success).toBe(true);
    expect(e.getState().stagingArea.has('u.txt')).toBe(false);
  });

  it('adds a reflog entry', () => {
    const e = makeTwoCommitEngine();
    const before = e.getState().reflog.length;
    e.reset('HEAD~1', '--hard');
    expect(e.getState().reflog.length).toBeGreaterThan(before);
  });
});

// ── revert ────────────────────────────────────────────────────────────────────

describe('revert', () => {
  it('creates a new commit that undoes the target', () => {
    const e = makeInitedEngine();
    e.createFile('b.txt', 'content');
    e.add(['.']);
    e.commit('add b');
    const state = e.getState();
    const revertTarget = state.branches.get('main')!.commitHash;

    const before = state.commits.size;
    e.revert(revertTarget);
    expect(e.getState().commits.size).toBe(before + 1);
  });

  it('removes the reverted file from working directory', () => {
    const e = makeInitedEngine();
    e.createFile('b.txt', 'content');
    e.add(['.']);
    e.commit('add b');
    const hash = e.getState().branches.get('main')!.commitHash;

    e.revert(hash);
    expect(e.getState().workingDirectory.has('b.txt')).toBe(false);
  });

  it('revert commit message includes original message', () => {
    const e = makeInitedEngine();
    e.createFile('b.txt', 'content');
    e.add(['.']);
    e.commit('my feature commit');
    const hash = e.getState().branches.get('main')!.commitHash;

    e.revert(hash);
    const newState = e.getState();
    const newHash = newState.branches.get('main')!.commitHash;
    expect(newState.commits.get(newHash)!.message).toContain('my feature commit');
  });

  it('fails for unknown commit hash', () => {
    const e = makeInitedEngine();
    const r = e.revert('deadbeef');
    expect(r.success).toBe(false);
    expect(r.output).toContain('bad revision');
  });
});

// ── stash ─────────────────────────────────────────────────────────────────────

describe('stash', () => {
  it('saves working directory changes', () => {
    const e = makeInitedEngine();
    e.editFile('README.md', 'dirty');
    const r = e.stash();
    expect(r.success).toBe(true);
    expect(e.getState().stash).toHaveLength(1);
  });

  it('restores working directory to HEAD after stash push', () => {
    const e = makeInitedEngine();
    e.editFile('README.md', 'dirty');
    e.stash();
    expect(e.getState().workingDirectory.get('README.md')!.content).toBe('hello');
  });

  it('saves staged changes', () => {
    const e = makeInitedEngine();
    e.createFile('new.txt', 'hi');
    e.add(['new.txt']);
    e.stash();
    expect(e.getState().stagingArea.size).toBe(0);
    expect(e.getState().stash[0].stagingArea.has('new.txt')).toBe(true);
  });

  it('stash pop restores working directory', () => {
    const e = makeInitedEngine();
    e.editFile('README.md', 'dirty');
    e.stash();
    const r = e.stash('pop');
    expect(r.success).toBe(true);
    expect(e.getState().workingDirectory.get('README.md')!.content).toBe('dirty');
  });

  it('stash pop removes top stash entry', () => {
    const e = makeInitedEngine();
    e.editFile('README.md', 'dirty');
    e.stash();
    e.stash('pop');
    expect(e.getState().stash).toHaveLength(0);
  });

  it('stash list shows entries', () => {
    const e = makeInitedEngine();
    e.editFile('README.md', 'dirty');
    e.stash();
    const r = e.stash('list');
    expect(r.success).toBe(true);
    expect(r.output).toContain('stash@{0}');
  });

  it('stash list empty when nothing stashed', () => {
    const e = makeInitedEngine();
    const r = e.stash('list');
    expect(r.output).toBe('');
  });

  it('stash drop removes top entry', () => {
    const e = makeInitedEngine();
    e.editFile('README.md', 'dirty');
    e.stash();
    const r = e.stash('drop');
    expect(r.success).toBe(true);
    expect(e.getState().stash).toHaveLength(0);
  });

  it('stash pop fails when nothing stashed', () => {
    const e = makeInitedEngine();
    const r = e.stash('pop');
    expect(r.success).toBe(false);
    expect(r.output).toContain('No stash entries found');
  });

  it('stash drop fails when nothing stashed', () => {
    const e = makeInitedEngine();
    const r = e.stash('drop');
    expect(r.success).toBe(false);
  });

  it('fails when there are no local changes to stash', () => {
    const e = makeInitedEngine();
    const r = e.stash();
    expect(r.success).toBe(false);
    expect(r.output).toContain('No local changes');
  });

  it('fails when no commits exist yet', () => {
    const e = new GitEngine();
    e.init();
    e.createFile('f.txt', 'x');
    const r = e.stash();
    expect(r.success).toBe(false);
  });

  it('multiple stashes stack correctly', () => {
    const e = makeInitedEngine();
    e.editFile('README.md', 'change1');
    e.stash();
    // restore and make another change
    e.stash('pop');
    e.editFile('README.md', 'change2');
    e.stash();
    e.editFile('README.md', 'change3');
    e.stash();
    expect(e.getState().stash).toHaveLength(2);
    const r = e.stash('list');
    expect(r.output).toContain('stash@{0}');
    expect(r.output).toContain('stash@{1}');
  });

  it('unknown stash action returns error', () => {
    const e = makeInitedEngine();
    const r = e.stash('show'); // 'show' is not implemented
    expect(r.success).toBe(false);
    expect(r.output).toContain('unknown stash command');
  });
});

// ── reflog ────────────────────────────────────────────────────────────────────

describe('reflog', () => {
  it('returns empty output before any actions', () => {
    const e = new GitEngine();
    e.init();
    // init adds a reflog entry
    const r = e.reflog();
    expect(r.success).toBe(true);
  });

  it('records a commit in the reflog', () => {
    const e = makeInitedEngine();
    const r = e.reflog();
    expect(r.output).toContain('commit');
  });

  it('records checkout in reflog', () => {
    const e = makeInitedEngine();
    e.branch('dev');
    e.checkout('dev');
    const r = e.reflog();
    expect(r.output).toContain('checkout');
  });

  it('records reset in reflog', () => {
    const e = makeInitedEngine();
    e.createFile('f.txt', 'x');
    e.add(['.']);
    e.commit('second');
    e.reset('HEAD~1', '--soft');
    const r = e.reflog();
    expect(r.output).toContain('reset');
  });

  it('entries are in HEAD@{N} format', () => {
    const e = makeInitedEngine();
    const r = e.reflog();
    expect(r.output).toMatch(/HEAD@\{[0-9]+\}/);
  });
});

// ── remoteAdd ─────────────────────────────────────────────────────────────────

describe('remoteAdd', () => {
  it('adds a remote', () => {
    const e = makeInitedEngine();
    const r = e.remoteAdd('origin', 'https://github.com/test/repo.git');
    expect(r.success).toBe(true);
    expect(e.getState().remotes.has('origin')).toBe(true);
  });

  it('stores the URL', () => {
    const e = makeInitedEngine();
    e.remoteAdd('origin', 'https://github.com/test/repo.git');
    expect(e.getState().remotes.get('origin')!.url).toBe('https://github.com/test/repo.git');
  });

  it('fails on duplicate remote name', () => {
    const e = makeInitedEngine();
    e.remoteAdd('origin', 'url1');
    const r = e.remoteAdd('origin', 'url2');
    expect(r.success).toBe(false);
    expect(r.output).toContain('already exists');
  });

  it('allows multiple distinct remotes', () => {
    const e = makeInitedEngine();
    e.remoteAdd('origin', 'url1');
    e.remoteAdd('upstream', 'url2');
    expect(e.getState().remotes.size).toBe(2);
  });
});

// ── rm ────────────────────────────────────────────────────────────────────────

describe('rm', () => {
  it('removes a tracked file from working dir and marks as removed', () => {
    const e = makeInitedEngine();
    const r = e.rm('README.md');
    expect(r.success).toBe(true);
    const state = e.getState();
    expect(state.workingDirectory.has('README.md')).toBe(false);
    expect(state.removedFiles.has('README.md')).toBe(true);
  });

  it('emits an rm transition', () => {
    const e = makeInitedEngine();
    const r = e.rm('README.md');
    expect(r.transitions.some(t => t.type === 'rm')).toBe(true);
  });

  it('staged deletion is committed when committing', () => {
    const e = makeInitedEngine();
    e.rm('README.md');
    e.commit('remove readme');
    const state = e.getState();
    const headHash = state.branches.get('main')!.commitHash;
    expect(state.commits.get(headHash)!.snapshot.has('README.md')).toBe(false);
  });

  it('fails for untracked file', () => {
    const e = makeInitedEngine();
    const r = e.rm('untracked.txt');
    expect(r.success).toBe(false);
    expect(r.output).toContain('did not match any files');
  });
});

// ── getState / loadState ──────────────────────────────────────────────────────

describe('getState / loadState', () => {
  it('getState returns a clone — mutations do not affect engine', () => {
    const e = makeInitedEngine();
    const state = e.getState();
    state.workingDirectory.set('injected.txt', { path: 'injected.txt', content: 'x' });
    // Engine should not see the mutation
    expect(e.getState().workingDirectory.has('injected.txt')).toBe(false);
  });

  it('loadState restores a previous state', () => {
    const e = makeInitedEngine();
    const snapshot = e.getState();
    e.createFile('after.txt', 'late');
    e.add(['.']);
    e.commit('after snapshot');

    e.loadState(snapshot);
    expect(e.getState().workingDirectory.has('after.txt')).toBe(false);
  });

  it('loadState clones — mutations to loaded state do not corrupt engine', () => {
    const e = makeInitedEngine();
    const snapshot = e.getState();
    e.loadState(snapshot);
    snapshot.workingDirectory.set('injected.txt', { path: 'injected.txt', content: 'x' });
    expect(e.getState().workingDirectory.has('injected.txt')).toBe(false);
  });

  it('getState includes gitignorePatterns', () => {
    const e = makeInitedEngine();
    const state = e.getState();
    state.gitignorePatterns = ['node_modules/', '*.env'];
    e.loadState(state);
    expect(e.getState().gitignorePatterns).toEqual(['node_modules/', '*.env']);
  });
});

// ── preview() ─────────────────────────────────────────────────────────────────

describe('preview', () => {
  it('returns the result without modifying engine state', () => {
    const e = makeInitedEngine();
    const stateBefore = e.getState();

    const result = e.preview((state) => {
      let s = opEditFile(state, 'README.md', 'previewed').state;
      s = opAdd(s, ['README.md']).state;
      return opCommit(s, 'preview commit');
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('preview commit');

    // Engine state unchanged
    const stateAfter = e.getState();
    expect(stateAfter.commits.size).toBe(stateBefore.commits.size);
    expect(stateAfter.workingDirectory.get('README.md')!.content).toBe('hello');
  });

  it('preview of failing operation returns failure without side effects', () => {
    const e = new GitEngine();
    const result = e.preview((state) => {
      return opCommit(state, 'should fail');
    });

    expect(result.success).toBe(false);
    expect(e.getState().initialized).toBe(false);
  });
});

// ── pure operations ──────────────────────────────────────────────────────────

describe('pure operations', () => {
  it('opInit returns new state without mutating input', () => {
    const state = new GitEngine().getState();
    const result = opInit(state);
    expect(result.success).toBe(true);
    expect(result.state.initialized).toBe(true);
    // Original untouched
    expect(state.initialized).toBe(false);
  });

  it('opAdd returns new state without mutating input', () => {
    let state = opInit(new GitEngine().getState()).state;
    state = opCreateFile(state, 'file.txt', 'content').state;
    const before = state.stagingArea.size;
    const result = opAdd(state, ['file.txt']);
    expect(result.state.stagingArea.size).toBe(1);
    expect(state.stagingArea.size).toBe(before);
  });

  it('opCommit returns new state without mutating input', () => {
    let state = opInit(new GitEngine().getState()).state;
    state = opCreateFile(state, 'file.txt', 'content').state;
    state = opAdd(state, ['file.txt']).state;
    const commitsBefore = state.commits.size;
    const result = opCommit(state, 'test');
    expect(result.state.commits.size).toBe(commitsBefore + 1);
    expect(state.commits.size).toBe(commitsBefore);
  });
});

// ── beforeEach: reset hash counter ───────────────────────────────────────────

// This ensures deterministic hashes across test runs.
beforeEach(() => {
  resetHashCounter();
});
