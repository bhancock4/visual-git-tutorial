import type { Scenario } from './types';
import type { GitEngine } from '../engine/GitEngine';

export const ohShitScenario: Scenario = {
  id: 'oh-shit',
  title: '8. I Messed Up, Now What?',
  description: 'Undo mistakes with reset, revert, and reflog',
  narrative: "Everyone makes mistakes. You committed something wrong, pushed something you shouldn't have, or deleted something important. Git has your back. Let's learn the escape hatches.",
  difficulty: 'advanced',
  order: 8,
  tags: ['reset', 'revert', 'reflog', 'recovery'],
  setup: (engine: GitEngine) => {
    engine.init();
    engine.createFile('app.js', 'function app() {\n  return "v1";\n}');
    engine.add(['.']);
    engine.commit('Version 1 - works great');

    engine.editFile('app.js', 'function app() {\n  return "v2 - new feature";\n}');
    engine.add(['.']);
    engine.commit('Version 2 - added feature');

    engine.editFile('app.js', 'function app() {\n  return "v3 - BROKEN";\n}');
    engine.add(['.']);
    engine.commit('Version 3 - oops, broke everything');
  },
  docLinks: [
    { label: 'git reset docs', url: 'https://git-scm.com/docs/git-reset' },
    { label: 'git revert docs', url: 'https://git-scm.com/docs/git-revert' },
    { label: 'git reflog docs', url: 'https://git-scm.com/docs/git-reflog' },
  ],
  tutorialSteps: [
    {
      id: 'see-mistake',
      title: 'See the Damage',
      narrative: "You've made 3 commits. The latest one (v3) broke everything. Let's look at the log to understand the situation.",
      expectedCommand: 'git log --oneline',
      hint: 'Type: git log --oneline',
      validation: (_state, lastCommand) => lastCommand.includes('git log'),
      helpContent: {
        explanation: 'You can see 3 commits. The latest one introduced a bug. You need to fix this. There are multiple ways depending on whether you\'ve already pushed.',
        why: 'Before fixing anything, always understand the current state. Know which commit is the problem and which one was the last good state.',
      },
    },
    {
      id: 'soft-reset',
      title: 'Undo a Commit (Keep Changes)',
      narrative: "First, let's learn `git reset --soft`. This moves HEAD back one commit but keeps your changes staged. It's like un-committing.",
      expectedCommand: /git reset --soft HEAD~1/,
      hint: 'Type: git reset --soft HEAD~1',
      validation: (state) => state.stagingArea.size > 0 && state.commits.size < 4,
      helpContent: {
        explanation: '`git reset --soft HEAD~1` moves HEAD back one commit. Your changes are still staged (ready to re-commit). Nothing is lost - you just "un-committed."',
        why: 'Soft reset is perfect for "I committed but my message was wrong" or "I need to add one more file to this commit." Your work is completely preserved.',
        docsUrl: 'https://git-scm.com/docs/git-reset',
      },
      milestone: { id: 'first-reset', title: 'First Reset' },
    },
    {
      id: 'recommit',
      title: 'Fix and Re-commit',
      narrative: "Now fix the file and commit again with a better version.",
      expectedCommand: /git commit/,
      hint: 'Edit the file first: echo "function app() { return \\"v3 - fixed\\"; }" > app.js then git add . and git commit -m "Version 3 - fixed"',
      validation: (state) => state.commits.size >= 3,
      helpContent: {
        explanation: 'You\'ve effectively rewritten that commit. The old broken version is gone from the branch history (but git still remembers it in the reflog).',
        why: 'Soft reset + recommit is the cleanest way to fix a commit you haven\'t pushed yet.',
      },
    },
    {
      id: 'view-reflog',
      title: 'Discover the Reflog',
      narrative: "Even after resetting, git remembers everything. The reflog is a log of everywhere HEAD has pointed. It's your ultimate safety net.",
      expectedCommand: 'git reflog',
      hint: 'Type: git reflog',
      validation: (_state, lastCommand) => lastCommand.trim() === 'git reflog',
      helpContent: {
        explanation: 'The reflog shows every position HEAD has been in. Even commits that are no longer reachable from any branch are listed here. They survive for at least 30 days.',
        why: 'The reflog is the "undo history" for git itself. If you can see a commit hash in the reflog, you can get back to it. Almost nothing in git is truly lost.',
        docsUrl: 'https://git-scm.com/docs/git-reflog',
      },
      milestone: { id: 'reflog-discovered', title: 'Reflog Discoverer' },
    },
  ],
};
