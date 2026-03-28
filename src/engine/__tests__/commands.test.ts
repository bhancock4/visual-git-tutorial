import { describe, it, expect, beforeEach } from 'vitest';
import { executeCommand } from '../commands';
import { GitEngine } from '../GitEngine';
import { resetHashCounter } from '../hash';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Run a sequence of commands on an engine, ignoring results. */
function run(engine: GitEngine, ...cmds: string[]): void {
  for (const cmd of cmds) executeCommand(engine, cmd);
}

/** Create an initialised engine with one commit on main. */
function makeInitedEngine(): GitEngine {
  const e = new GitEngine();
  run(e, 'git init', 'touch README.md', 'git add README.md', 'git commit -m "initial commit"');
  return e;
}

// ── setup ─────────────────────────────────────────────────────────────────────

let engine: GitEngine;

beforeEach(() => {
  resetHashCounter();
  engine = new GitEngine();
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty / whitespace input
// ─────────────────────────────────────────────────────────────────────────────

describe('empty input', () => {
  it('returns success with empty output for empty string', () => {
    const r = executeCommand(engine, '');
    expect(r.success).toBe(true);
    expect(r.output).toBe('');
    expect(r.transitions).toHaveLength(0);
  });

  it('returns success with empty output for whitespace-only input', () => {
    const r = executeCommand(engine, '   ');
    expect(r.success).toBe(true);
    expect(r.output).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unknown programs
// ─────────────────────────────────────────────────────────────────────────────

describe('unknown program', () => {
  it('returns failure for unrecognised command', () => {
    const r = executeCommand(engine, 'foobar');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/command not found/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shell: ls
// ─────────────────────────────────────────────────────────────────────────────

describe('ls', () => {
  it('returns empty string when working directory is empty', () => {
    const r = executeCommand(engine, 'ls');
    expect(r.success).toBe(true);
    expect(r.output).toBe('');
  });

  it('lists files in the working directory', () => {
    engine.createFile('alpha.txt', '');
    engine.createFile('beta.txt', '');
    const r = executeCommand(engine, 'ls');
    expect(r.success).toBe(true);
    expect(r.output).toContain('alpha.txt');
    expect(r.output).toContain('beta.txt');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shell: cat
// ─────────────────────────────────────────────────────────────────────────────

describe('cat', () => {
  it('prints file content for an existing file', () => {
    engine.createFile('notes.txt', 'hello world');
    const r = executeCommand(engine, 'cat notes.txt');
    expect(r.success).toBe(true);
    expect(r.output).toBe('hello world');
  });

  it('returns error for a non-existent file', () => {
    const r = executeCommand(engine, 'cat missing.txt');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/No such file or directory/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shell: touch
// ─────────────────────────────────────────────────────────────────────────────

describe('touch', () => {
  it('creates an empty file in the working directory', () => {
    const r = executeCommand(engine, 'touch newfile.txt');
    expect(r.success).toBe(true);
    const state = r.state;
    expect(state.workingDirectory.has('newfile.txt')).toBe(true);
    expect(state.workingDirectory.get('newfile.txt')?.content).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shell: echo
// ─────────────────────────────────────────────────────────────────────────────

describe('echo', () => {
  it('creates a file with content using >', () => {
    const r = executeCommand(engine, 'echo "hello world" > greet.txt');
    expect(r.success).toBe(true);
    expect(r.state.workingDirectory.get('greet.txt')?.content).toBe('hello world');
  });

  it('handles single-quoted content with >', () => {
    const r = executeCommand(engine, "echo 'hello single' > single.txt");
    expect(r.success).toBe(true);
    expect(r.state.workingDirectory.get('single.txt')?.content).toBe('hello single');
  });

  it('appends to an existing file with >>', () => {
    engine.createFile('log.txt', 'line one');
    const r = executeCommand(engine, 'echo "line two" >> log.txt');
    expect(r.success).toBe(true);
    expect(r.state.workingDirectory.get('log.txt')?.content).toBe('line one\nline two');
  });

  it('creates a new file with >> when the file does not exist', () => {
    const r = executeCommand(engine, 'echo "first line" >> fresh.txt');
    expect(r.success).toBe(true);
    expect(r.state.workingDirectory.get('fresh.txt')?.content).toBe('first line');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shell: rm
// ─────────────────────────────────────────────────────────────────────────────

describe('rm', () => {
  it('removes an existing file from the working directory', () => {
    engine.createFile('todelete.txt', '');
    const r = executeCommand(engine, 'rm todelete.txt');
    expect(r.success).toBe(true);
    expect(r.state.workingDirectory.has('todelete.txt')).toBe(false);
  });

  it('returns error for non-existent file', () => {
    const r = executeCommand(engine, 'rm ghost.txt');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/No such file or directory/);
  });

  it('returns error when no filename is given', () => {
    const r = executeCommand(engine, 'rm');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/missing operand/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shell: mkdir
// ─────────────────────────────────────────────────────────────────────────────

describe('mkdir', () => {
  it('silently succeeds (dirs are not modelled)', () => {
    const r = executeCommand(engine, 'mkdir some-dir');
    expect(r.success).toBe(true);
    expect(r.output).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shell: pwd
// ─────────────────────────────────────────────────────────────────────────────

describe('pwd', () => {
  it('returns the virtual project path', () => {
    const r = executeCommand(engine, 'pwd');
    expect(r.success).toBe(true);
    expect(r.output).toBe('/home/user/project');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shell: clear
// ─────────────────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('returns the __CLEAR__ sentinel', () => {
    const r = executeCommand(engine, 'clear');
    expect(r.success).toBe(true);
    expect(r.output).toBe('__CLEAR__');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shell: help
// ─────────────────────────────────────────────────────────────────────────────

describe('help', () => {
  it('returns help text listing available commands', () => {
    const r = executeCommand(engine, 'help');
    expect(r.success).toBe(true);
    expect(r.output).toMatch(/git init/);
    expect(r.output).toMatch(/git commit/);
    expect(r.output).toMatch(/ls/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git init
// ─────────────────────────────────────────────────────────────────────────────

describe('git init', () => {
  it('initialises an empty repository', () => {
    const r = executeCommand(engine, 'git init');
    expect(r.success).toBe(true);
    expect(r.output).toMatch(/Initialized empty Git repository/);
    expect(r.state.initialized).toBe(true);
  });

  it('returns a transition of type init', () => {
    const r = executeCommand(engine, 'git init');
    expect(r.transitions).toHaveLength(1);
    expect(r.transitions[0].type).toBe('init');
  });

  it('reports reinitialization on a second init', () => {
    executeCommand(engine, 'git init');
    const r = executeCommand(engine, 'git init');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/Reinitialized/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git status
// ─────────────────────────────────────────────────────────────────────────────

describe('git status', () => {
  it('requires an initialised repo', () => {
    const r = executeCommand(engine, 'git status');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/not a git repository/i);
  });

  it('reports untracked files', () => {
    run(engine, 'git init', 'touch file.txt');
    const r = executeCommand(engine, 'git status');
    expect(r.success).toBe(true);
    expect(r.output).toMatch(/Untracked files/);
    expect(r.output).toContain('file.txt');
  });

  it('reports staged files', () => {
    run(engine, 'git init', 'touch file.txt', 'git add file.txt');
    const r = executeCommand(engine, 'git status');
    expect(r.output).toMatch(/Changes to be committed/);
  });

  it('reports clean working tree after commit', () => {
    engine = makeInitedEngine();
    const r = executeCommand(engine, 'git status');
    expect(r.output).toMatch(/nothing to commit/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git add
// ─────────────────────────────────────────────────────────────────────────────

describe('git add', () => {
  beforeEach(() => {
    run(engine, 'git init', 'touch a.txt', 'touch b.txt');
  });

  it('stages a specific file', () => {
    const r = executeCommand(engine, 'git add a.txt');
    expect(r.success).toBe(true);
    expect(r.state.stagingArea.has('a.txt')).toBe(true);
    expect(r.state.stagingArea.has('b.txt')).toBe(false);
  });

  it('stages all files with git add .', () => {
    const r = executeCommand(engine, 'git add .');
    expect(r.state.stagingArea.has('a.txt')).toBe(true);
    expect(r.state.stagingArea.has('b.txt')).toBe(true);
  });

  it('stages all files with git add -A', () => {
    const r = executeCommand(engine, 'git add -A');
    expect(r.state.stagingArea.has('a.txt')).toBe(true);
    expect(r.state.stagingArea.has('b.txt')).toBe(true);
  });

  it('returns error when no path is given', () => {
    const r = executeCommand(engine, 'git add');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/Nothing specified/);
  });

  it('returns error for a non-existent file', () => {
    const r = executeCommand(engine, 'git add ghost.txt');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/did not match any files/);
  });

  it('produces an add transition', () => {
    const r = executeCommand(engine, 'git add a.txt');
    expect(r.transitions).toHaveLength(1);
    expect(r.transitions[0].type).toBe('add');
    expect(r.transitions[0].from).toBe('working');
    expect(r.transitions[0].to).toBe('staging');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git commit
// ─────────────────────────────────────────────────────────────────────────────

describe('git commit', () => {
  beforeEach(() => {
    run(engine, 'git init', 'touch file.txt', 'git add file.txt');
  });

  it('commits staged files with a double-quoted message', () => {
    const r = executeCommand(engine, 'git commit -m "my first commit"');
    expect(r.success).toBe(true);
    expect(r.output).toContain('my first commit');
    expect(r.state.stagingArea.size).toBe(0);
  });

  it('commits with a single-quoted message', () => {
    const r = executeCommand(engine, "git commit -m 'single quoted'");
    expect(r.success).toBe(true);
    expect(r.output).toContain('single quoted');
  });

  it('commits with an unquoted single-word message', () => {
    const r = executeCommand(engine, 'git commit -m fixup');
    expect(r.success).toBe(true);
    expect(r.output).toContain('fixup');
  });

  it('returns error when -m flag has no value', () => {
    const r = executeCommand(engine, 'git commit');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/requires a value/);
  });

  it('returns error when nothing is staged', () => {
    // flush the staged file from beforeEach with a commit, then try again
    run(engine, 'git commit -m "setup"');
    const r = executeCommand(engine, 'git commit -m "empty"');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/nothing to commit/);
  });

  it('produces a commit transition from staging to local', () => {
    const r = executeCommand(engine, 'git commit -m "initial"');
    expect(r.transitions).toHaveLength(1);
    expect(r.transitions[0].type).toBe('commit');
    expect(r.transitions[0].from).toBe('staging');
    expect(r.transitions[0].to).toBe('local');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git log
// ─────────────────────────────────────────────────────────────────────────────

describe('git log', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
  });

  it('returns commit history', () => {
    const r = executeCommand(engine, 'git log');
    expect(r.success).toBe(true);
    expect(r.output).toContain('initial commit');
  });

  it('--oneline shows condensed output', () => {
    const r = executeCommand(engine, 'git log --oneline');
    expect(r.success).toBe(true);
    // Oneline format: hash + message, no "Author:" line
    expect(r.output).not.toMatch(/Author:/);
    expect(r.output).toContain('initial commit');
  });

  it('returns error before any commits', () => {
    executeCommand(engine, 'git init');
    const fresh = new GitEngine();
    executeCommand(fresh, 'git init');
    const r = executeCommand(fresh, 'git log');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/does not have any commits yet/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git branch
// ─────────────────────────────────────────────────────────────────────────────

describe('git branch', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
  });

  it('lists branches', () => {
    const r = executeCommand(engine, 'git branch');
    expect(r.success).toBe(true);
    expect(r.output).toContain('main');
  });

  it('creates a new branch', () => {
    const r = executeCommand(engine, 'git branch feature');
    expect(r.success).toBe(true);
    expect(r.state.branches.has('feature')).toBe(true);
  });

  it('deletes a branch with -d', () => {
    run(engine, 'git branch to-delete');
    const r = executeCommand(engine, 'git branch -d to-delete');
    expect(r.success).toBe(true);
    expect(r.state.branches.has('to-delete')).toBe(false);
  });

  it('deletes a branch with -D', () => {
    run(engine, 'git branch force-del');
    const r = executeCommand(engine, 'git branch -D force-del');
    expect(r.success).toBe(true);
    expect(r.state.branches.has('force-del')).toBe(false);
  });

  it('returns error when deleting non-existent branch', () => {
    const r = executeCommand(engine, 'git branch -d nope');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/not found/);
  });

  it('returns error when creating a branch that already exists', () => {
    run(engine, 'git branch dupe');
    const r = executeCommand(engine, 'git branch dupe');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/already exists/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git checkout
// ─────────────────────────────────────────────────────────────────────────────

describe('git checkout', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
    run(engine, 'git branch other');
  });

  it('switches to an existing branch', () => {
    const r = executeCommand(engine, 'git checkout other');
    expect(r.success).toBe(true);
    expect(r.state.HEAD).toMatchObject({ type: 'branch', name: 'other' });
  });

  it('creates and switches with -b', () => {
    const r = executeCommand(engine, 'git checkout -b newbranch');
    expect(r.success).toBe(true);
    expect(r.state.HEAD).toMatchObject({ type: 'branch', name: 'newbranch' });
  });

  it('restores a file with -- syntax', () => {
    // Modify README.md then restore it
    engine.editFile('README.md', 'dirty content');
    const r = executeCommand(engine, 'git checkout -- README.md');
    expect(r.success).toBe(true);
    // Content should be restored to committed version (empty, as touch created it)
    expect(r.state.workingDirectory.get('README.md')?.content).toBe('');
  });

  it('returns error when no branch is given', () => {
    const r = executeCommand(engine, 'git checkout');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/must specify/);
  });

  it('returns error for non-existent branch', () => {
    const r = executeCommand(engine, 'git checkout nowhere');
    expect(r.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git switch
// ─────────────────────────────────────────────────────────────────────────────

describe('git switch', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
    run(engine, 'git branch side');
  });

  it('switches to an existing branch', () => {
    const r = executeCommand(engine, 'git switch side');
    expect(r.success).toBe(true);
    expect(r.state.HEAD).toMatchObject({ type: 'branch', name: 'side' });
  });

  it('creates and switches with -c', () => {
    const r = executeCommand(engine, 'git switch -c brand-new');
    expect(r.success).toBe(true);
    expect(r.state.HEAD).toMatchObject({ type: 'branch', name: 'brand-new' });
  });

  it('returns error when no branch is given', () => {
    const r = executeCommand(engine, 'git switch');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/must specify/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git merge
// ─────────────────────────────────────────────────────────────────────────────

describe('git merge', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
  });

  it('fast-forwards when feature is ahead of main', () => {
    run(engine,
      'git checkout -b feature',
      'touch extra.txt',
      'git add extra.txt',
      'git commit -m "add extra"',
      'git checkout main',
    );
    const r = executeCommand(engine, 'git merge feature');
    expect(r.success).toBe(true);
    expect(r.output).toMatch(/Fast-forward/);
  });

  it('returns error when no branch is given', () => {
    const r = executeCommand(engine, 'git merge');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/specify a branch/);
  });

  it('returns error for non-existent branch', () => {
    const r = executeCommand(engine, 'git merge does-not-exist');
    expect(r.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git diff
// ─────────────────────────────────────────────────────────────────────────────

describe('git diff', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
  });

  it('returns empty output when working tree is clean', () => {
    const r = executeCommand(engine, 'git diff');
    expect(r.success).toBe(true);
    expect(r.output).toBe('');
  });

  it('shows unstaged changes', () => {
    engine.editFile('README.md', 'modified');
    const r = executeCommand(engine, 'git diff');
    expect(r.success).toBe(true);
    expect(r.output).toContain('README.md');
  });

  it('shows staged changes with --staged', () => {
    engine.editFile('README.md', 'staged change');
    run(engine, 'git add README.md');
    const r = executeCommand(engine, 'git diff --staged');
    expect(r.success).toBe(true);
    expect(r.output).toContain('README.md');
  });

  it('shows staged changes with --cached alias', () => {
    engine.editFile('README.md', 'cached change');
    run(engine, 'git add README.md');
    const r = executeCommand(engine, 'git diff --cached');
    expect(r.success).toBe(true);
    expect(r.output).toContain('README.md');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git remote
// ─────────────────────────────────────────────────────────────────────────────

describe('git remote', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
  });

  it('adds a remote', () => {
    const r = executeCommand(engine, 'git remote add origin https://github.com/user/repo.git');
    expect(r.success).toBe(true);
    expect(r.state.remotes.has('origin')).toBe(true);
    expect(r.state.remotes.get('origin')?.url).toBe('https://github.com/user/repo.git');
  });

  it('lists remotes with -v', () => {
    run(engine, 'git remote add origin https://example.com/repo.git');
    const r = executeCommand(engine, 'git remote -v');
    expect(r.success).toBe(true);
    expect(r.output).toContain('origin');
    expect(r.output).toContain('https://example.com/repo.git');
    expect(r.output).toContain('(fetch)');
    expect(r.output).toContain('(push)');
  });

  it('returns error when remote add is missing arguments', () => {
    const r = executeCommand(engine, 'git remote add');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/usage/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git push / pull / fetch
// ─────────────────────────────────────────────────────────────────────────────

describe('git push', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
    run(engine, 'git remote add origin https://example.com/repo.git');
  });

  it('pushes to the remote', () => {
    const r = executeCommand(engine, 'git push');
    expect(r.success).toBe(true);
    expect(r.transitions[0].type).toBe('push');
  });

  it('pushes with explicit remote and branch', () => {
    const r = executeCommand(engine, 'git push origin main');
    expect(r.success).toBe(true);
  });

  it('returns error when remote does not exist', () => {
    const r = executeCommand(engine, 'git push upstream main');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/does not appear to be a git repository/);
  });
});

describe('git pull', () => {
  it('returns error when remote does not exist', () => {
    engine = makeInitedEngine();
    const r = executeCommand(engine, 'git pull');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/does not appear to be a git repository/);
  });

  it('pulls from a seeded remote', () => {
    engine = makeInitedEngine();
    run(engine, 'git remote add origin https://example.com/repo.git', 'git push');
    const r = executeCommand(engine, 'git pull');
    expect(r.success).toBe(true);
    expect(r.transitions[0].type).toBe('pull');
  });
});

describe('git fetch', () => {
  it('returns error when remote does not exist', () => {
    engine = makeInitedEngine();
    const r = executeCommand(engine, 'git fetch');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/does not appear to be a git repository/);
  });

  it('fetches from an existing remote', () => {
    engine = makeInitedEngine();
    run(engine, 'git remote add origin https://example.com/repo.git', 'git push');
    const r = executeCommand(engine, 'git fetch');
    expect(r.success).toBe(true);
    expect(r.transitions[0].type).toBe('fetch');
  });

  it('fetches with explicit remote name', () => {
    engine = makeInitedEngine();
    run(engine, 'git remote add origin https://example.com/repo.git', 'git push');
    const r = executeCommand(engine, 'git fetch origin');
    expect(r.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git reset
// ─────────────────────────────────────────────────────────────────────────────

describe('git reset', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
    // Make a second commit to have something to reset to
    run(engine,
      'echo "v2" > README.md',
      'git add README.md',
      'git commit -m "second commit"',
    );
  });

  it('unstages a file with git reset HEAD <file>', () => {
    run(engine, 'echo "change" > README.md', 'git add README.md');
    const before = executeCommand(engine, 'git status');
    expect(before.output).toMatch(/Changes to be committed/);

    const r = executeCommand(engine, 'git reset HEAD README.md');
    expect(r.success).toBe(true);
    expect(r.state.stagingArea.has('README.md')).toBe(false);
  });

  it('--soft moves HEAD but keeps staging and working dir', () => {
    const r = executeCommand(engine, 'git reset --soft HEAD~1');
    expect(r.success).toBe(true);
    // staging should still have content from second commit prep
    // working directory file should still show v2
    expect(r.state.workingDirectory.get('README.md')?.content).toBe('v2');
  });

  it('--hard resets HEAD, staging, and working directory', () => {
    const r = executeCommand(engine, 'git reset --hard HEAD~1');
    expect(r.success).toBe(true);
    // Working directory should reflect the first commit (empty README.md)
    expect(r.state.workingDirectory.get('README.md')?.content).toBe('');
    expect(r.state.stagingArea.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git revert
// ─────────────────────────────────────────────────────────────────────────────

describe('git revert', () => {
  it('creates a new commit that reverts the target commit', () => {
    engine = makeInitedEngine();
    run(engine, 'echo "v2" > README.md', 'git add README.md', 'git commit -m "add v2"');
    const state = engine.getState();
    const currentBranch = state.HEAD.type === 'branch' ? state.HEAD.name : 'main';
    const commitHash = state.branches.get(currentBranch)!.commitHash;

    const r = executeCommand(engine, `git revert ${commitHash}`);
    expect(r.success).toBe(true);
    expect(r.output).toMatch(/Revert/);
    // Should now have 3 commits
    expect(r.state.commits.size).toBe(3);
  });

  it('returns error when no commit hash is given', () => {
    engine = makeInitedEngine();
    const r = executeCommand(engine, 'git revert');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/specify a commit/);
  });

  it('returns error for invalid commit hash', () => {
    engine = makeInitedEngine();
    const r = executeCommand(engine, 'git revert deadbeef');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/bad revision/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git stash
// ─────────────────────────────────────────────────────────────────────────────

describe('git stash', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
    // Dirty the working directory
    engine.editFile('README.md', 'uncommitted work');
  });

  it('stashes working directory changes', () => {
    const r = executeCommand(engine, 'git stash');
    expect(r.success).toBe(true);
    expect(r.state.stash).toHaveLength(1);
    // Working directory should be clean (reverted to HEAD)
    expect(r.state.workingDirectory.get('README.md')?.content).toBe('');
  });

  it('pops the stash', () => {
    run(engine, 'git stash');
    const r = executeCommand(engine, 'git stash pop');
    expect(r.success).toBe(true);
    expect(r.state.stash).toHaveLength(0);
    expect(r.state.workingDirectory.get('README.md')?.content).toBe('uncommitted work');
  });

  it('lists stash entries', () => {
    run(engine, 'git stash');
    const r = executeCommand(engine, 'git stash list');
    expect(r.success).toBe(true);
    expect(r.output).toContain('stash@{0}');
  });

  it('drops the stash', () => {
    run(engine, 'git stash');
    const r = executeCommand(engine, 'git stash drop');
    expect(r.success).toBe(true);
    expect(r.state.stash).toHaveLength(0);
  });

  it('returns error when popping an empty stash', () => {
    const r = executeCommand(engine, 'git stash pop');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/No stash entries/);
  });

  it('returns error when there is nothing to stash', () => {
    // Restore the file to clean state
    engine.editFile('README.md', '');
    const r = executeCommand(engine, 'git stash');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/No local changes/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git reflog
// ─────────────────────────────────────────────────────────────────────────────

describe('git reflog', () => {
  it('requires an initialised repo', () => {
    const r = executeCommand(engine, 'git reflog');
    expect(r.success).toBe(false);
  });

  it('shows reflog entries after commits and checkouts', () => {
    engine = makeInitedEngine();
    run(engine, 'git branch side', 'git checkout side', 'git checkout main');
    const r = executeCommand(engine, 'git reflog');
    expect(r.success).toBe(true);
    expect(r.output).toMatch(/HEAD@\{/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git restore
// ─────────────────────────────────────────────────────────────────────────────

describe('git restore', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
  });

  it('restores a modified file in the working directory', () => {
    engine.editFile('README.md', 'corrupted');
    const r = executeCommand(engine, 'git restore README.md');
    expect(r.success).toBe(true);
    expect(r.state.workingDirectory.get('README.md')?.content).toBe('');
  });

  it('unstages a file with --staged', () => {
    engine.editFile('README.md', 'some change');
    run(engine, 'git add README.md');
    const r = executeCommand(engine, 'git restore --staged README.md');
    expect(r.success).toBe(true);
    expect(r.state.stagingArea.has('README.md')).toBe(false);
  });

  it('returns error when no file is given', () => {
    const r = executeCommand(engine, 'git restore');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/usage/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git rm
// ─────────────────────────────────────────────────────────────────────────────

describe('git rm', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
  });

  it('removes a tracked file from working directory and staging', () => {
    const r = executeCommand(engine, 'git rm README.md');
    expect(r.success).toBe(true);
    expect(r.state.workingDirectory.has('README.md')).toBe(false);
  });

  it('returns error when no file is given', () => {
    const r = executeCommand(engine, 'git rm');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/usage/);
  });

  it('returns error for an untracked file', () => {
    const r = executeCommand(engine, 'git rm unknown.txt');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/did not match any files/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// git config
// ─────────────────────────────────────────────────────────────────────────────

describe('git config', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
  });

  it('silently succeeds when setting user.name', () => {
    const r = executeCommand(engine, 'git config user.name "Jane Doe"');
    expect(r.success).toBe(true);
    expect(r.output).toBe('');
  });

  it('returns the current user name when reading user.name', () => {
    const r = executeCommand(engine, 'git config user.name');
    expect(r.success).toBe(true);
    expect(r.output).toBe('You');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unknown git subcommand
// ─────────────────────────────────────────────────────────────────────────────

describe('unknown git subcommand', () => {
  it('returns an error message', () => {
    const r = executeCommand(engine, 'git frobnicate');
    expect(r.success).toBe(false);
    expect(r.output).toMatch(/is not a git command/);
    expect(r.output).toContain('frobnicate');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Parsing edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('parsing edge cases', () => {
  beforeEach(() => {
    engine = makeInitedEngine();
    run(engine, 'touch data.txt', 'git add data.txt');
  });

  it('extracts a multi-word commit message with double quotes', () => {
    const r = executeCommand(engine, 'git commit -m "add data file"');
    expect(r.success).toBe(true);
    expect(r.output).toContain('add data file');
  });

  it('extracts a multi-word commit message with single quotes', () => {
    run(engine, 'touch more.txt', 'git add more.txt');
    const r = executeCommand(engine, "git commit -m 'add more file'");
    expect(r.success).toBe(true);
    expect(r.output).toContain('add more file');
  });

  it('echo > correctly parses a filename after the redirect', () => {
    const r = executeCommand(engine, 'echo "content here" > output.txt');
    expect(r.state.workingDirectory.get('output.txt')?.content).toBe('content here');
  });

  it('echo >> correctly parses a filename after the append redirect', () => {
    const r = executeCommand(engine, 'echo "appended" >> output.txt');
    expect(r.state.workingDirectory.get('output.txt')?.content).toBe('appended');
  });

  it('git checkout -- <file> is detected before normal checkout logic', () => {
    engine.editFile('README.md', 'dirty');
    const r = executeCommand(engine, 'git checkout -- README.md');
    expect(r.success).toBe(true);
    expect(r.state.workingDirectory.get('README.md')?.content).toBe('');
  });

  it('git checkout -b creates a branch even when -b would be parsed as a flag with no value', () => {
    const r = executeCommand(engine, 'git checkout -b my-branch');
    expect(r.success).toBe(true);
    expect(r.state.HEAD).toMatchObject({ type: 'branch', name: 'my-branch' });
  });

  it('git switch -c creates a branch', () => {
    const r = executeCommand(engine, 'git switch -c another-branch');
    expect(r.success).toBe(true);
    expect(r.state.HEAD).toMatchObject({ type: 'branch', name: 'another-branch' });
  });

  it('git diff --staged triggers staged diff path', () => {
    engine.editFile('README.md', 'staged');
    run(engine, 'git add README.md');
    const staged = executeCommand(engine, 'git diff --staged');
    const unstaged = executeCommand(engine, 'git diff');
    // Staged diff should find a diff (README.md changed vs HEAD)
    expect(staged.output).toContain('README.md');
    // Unstaged diff should be empty (working dir == staging area)
    expect(unstaged.output).toBe('');
  });
});
