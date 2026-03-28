import { describe, it, expect, beforeEach } from 'vitest';
import { GitEngine } from '../GitEngine';
import { executeCommand } from '../commands';
import { resetHashCounter } from '../hash';

beforeEach(() => {
  resetHashCounter();
});

function setupEngine(): GitEngine {
  const e = new GitEngine();
  executeCommand(e, 'git init');
  executeCommand(e, 'echo "hello" > file.txt');
  executeCommand(e, 'git add .');
  executeCommand(e, 'git commit -m "initial"');
  return e;
}

describe('preview (dry-run command execution)', () => {
  it('preview does not mutate engine state', () => {
    const e = setupEngine();
    const stateBefore = e.getState();

    // Preview a command that would change state
    const preview = new GitEngine();
    preview.loadState(e.getState());
    const result = executeCommand(preview, 'echo "changed" > file.txt');

    expect(result.success).toBe(true);

    // Original engine untouched
    const stateAfter = e.getState();
    expect(stateAfter.workingDirectory.get('file.txt')!.content).toBe('hello');
    expect(stateBefore.commits.size).toBe(stateAfter.commits.size);
  });

  it('preview shows what commit would produce', () => {
    const e = setupEngine();

    // Stage a change
    executeCommand(e, 'echo "v2" > file.txt');
    executeCommand(e, 'git add .');

    // Preview the commit
    const preview = new GitEngine();
    preview.loadState(e.getState());
    const result = executeCommand(preview, 'git commit -m "preview commit"');

    expect(result.success).toBe(true);
    expect(result.output).toContain('preview commit');
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].type).toBe('commit');

    // Original engine still has 1 commit
    expect(e.getState().commits.size).toBe(1);
  });

  it('preview of failing command shows error', () => {
    const e = setupEngine();

    const preview = new GitEngine();
    preview.loadState(e.getState());
    const result = executeCommand(preview, 'git commit -m "nothing staged"');

    expect(result.success).toBe(false);
    expect(result.output).toContain('nothing to commit');
  });

  it('preview of branch creation shows result', () => {
    const e = setupEngine();

    const preview = new GitEngine();
    preview.loadState(e.getState());
    const result = executeCommand(preview, 'git branch feature');

    expect(result.success).toBe(true);
    expect(result.output).toContain("Created branch 'feature'");

    // Original engine has no feature branch
    expect(e.getState().branches.has('feature')).toBe(false);
  });

  it('preview transitions indicate zone movement', () => {
    const e = setupEngine();
    executeCommand(e, 'echo "new" > new.txt');

    const preview = new GitEngine();
    preview.loadState(e.getState());
    const result = executeCommand(preview, 'git add new.txt');

    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].from).toBe('working');
    expect(result.transitions[0].to).toBe('staging');
    expect(result.transitions[0].files).toContain('new.txt');
  });
});
