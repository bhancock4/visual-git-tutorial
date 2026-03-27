import type { Scenario } from './types';
import type { GitEngine } from '../engine/GitEngine';

export const mergingScenario: Scenario = {
  id: 'merging',
  title: '3. Merging Branches',
  description: 'Bring branch work back together with git merge',
  narrative: "You've been working on a feature branch and it's ready. Now you need to bring that work back into the main branch. This is called merging. Let's learn how it works.",
  difficulty: 'beginner',
  order: 3,
  tags: ['merge', 'branch', 'fast-forward'],
  setup: (engine: GitEngine) => {
    engine.init();
    engine.createFile('app.js', 'console.log("Hello!");');
    engine.add(['.']);
    engine.commit('Initial commit');

    // Create feature branch with work
    engine.checkout('feature', { createBranch: true });
    engine.createFile('feature.js', 'function newFeature() {\n  return "awesome";\n}');
    engine.add(['.']);
    engine.commit('Add new feature');

    // Switch back to main
    engine.checkout('main');
  },
  docLinks: [
    { label: 'git merge docs', url: 'https://git-scm.com/docs/git-merge' },
    { label: 'Merge strategies', url: 'https://git-scm.com/docs/merge-strategies' },
  ],
  tutorialSteps: [
    {
      id: 'inspect',
      title: 'See What Exists',
      narrative: "You're on `main`. A `feature` branch has been created with some new work. Let's see what's on each branch.",
      expectedCommand: 'git log --oneline',
      hint: 'Try: git log --oneline to see main\'s history',
      validation: (_state, lastCommand) => lastCommand.includes('git log'),
      helpContent: {
        explanation: 'Look at the log for main - it only has the initial commit. The feature branch has an additional commit that main doesn\'t have yet.',
        why: 'Before merging, always check what you\'re about to merge. Surprises during merge are not fun.',
      },
    },
    {
      id: 'merge',
      title: 'Merge the Feature Branch',
      narrative: "You're on `main` (the branch you want to merge INTO). Now run `git merge feature` to bring the feature work into main.",
      expectedCommand: 'git merge feature',
      hint: 'Type: git merge feature',
      validation: (state) => {
        const mainBranch = state.branches.get('main');
        if (!mainBranch) return false;
        const commit = state.commits.get(mainBranch.commitHash);
        return commit ? commit.snapshot.has('feature.js') : false;
      },
      helpContent: {
        explanation: 'This was a "fast-forward" merge. Since main had no new commits since feature branched off, git just moved the main pointer forward to match feature. No merge commit needed.',
        why: 'Fast-forward merges are the simplest kind. They happen when there\'s a clear, linear path from the current branch to the target.',
        docsUrl: 'https://git-scm.com/docs/git-merge',
      },
      milestone: { id: 'first-merge', title: 'First Merge!' },
    },
    {
      id: 'verify',
      title: 'Verify the Merge',
      narrative: "Check that the feature file now exists on main. Use `ls` to see files or `git log` to see the history.",
      expectedCommand: /(ls|git log|git status)/,
      hint: 'Try: ls or git log --oneline',
      validation: (_state, lastCommand) => /^(ls|git log|git status)/.test(lastCommand.trim()),
      helpContent: {
        explanation: 'After merging, main now has all the commits and files from the feature branch. The branches have been unified.',
        why: 'Always verify after a merge. Check that the files you expected are there and the log shows the right history.',
      },
      milestone: { id: 'merge-verified', title: 'Merge Verified' },
    },
  ],
};
