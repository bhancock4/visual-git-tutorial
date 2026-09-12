import type { Scenario } from './types';
import type { GitEngine } from '../engine/GitEngine';

export const mergingScenario: Scenario = {
  id: 'merging',
  title: '3. Merging Branches',
  description: 'Accept your AI experiment by merging its branch back into main',
  narrative:
    "The experiment paid off. Your AI co-builder's work on the `feature` branch looks good, you've reviewed it, and you want it in your main line of work.\n\nBringing an accepted branch back into `main` is called merging. Merging is the moment you say \"yes, I accept this\" — it's how the good work you decided to keep becomes part of your project. Let's take the AI's feature and merge it in.",
  difficulty: 'beginner',
  order: 3,
  tags: ['merge', 'branch', 'fast-forward'],
  setup: (engine: GitEngine) => {
    engine.init();
    engine.createFile('app.js', 'console.log("Hello!");');
    engine.add(['.']);
    engine.commit('Initial commit');

    // Feature branch: the AI's experiment, already drafted and committed
    engine.checkout('feature', { createBranch: true });
    engine.createFile('feature.js', 'function newFeature() {\n  return "awesome";\n}');
    engine.add(['.']);
    engine.commit('Add AI-drafted feature');

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
      title: 'Review Before You Accept',
      narrative: "You're on `main`. The AI's `feature` branch has a commit that `main` doesn't. Before you accept anything, look at the history so you know what you're about to bring in.",
      expectedCommand: 'git log --oneline',
      hint: 'Try: git log --oneline to see main\'s history',
      validation: (_state, lastCommand) => lastCommand.includes('git log'),
      helpContent: {
        explanation: 'Look at the log for main — it only has the initial commit. The feature branch has an additional commit (the AI\'s feature) that main doesn\'t have yet.',
        why: 'Merging accepts work into your main line, so check what\'s coming first. When the AI generated the branch, you\'re the one signing off on it — a quick look at the log is how you stay in control of what enters `main`.',
      },
    },
    {
      id: 'merge',
      title: 'Merge to Accept the Work',
      narrative: "You've reviewed it and you're on `main` (the branch you want to merge INTO). Run `git merge feature` to accept the AI's work and pull it into main.",
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
        why: 'Merging is how you say "I accept this." Fast-forward merges are the simplest kind — they happen when there\'s a clear, linear path from your branch to the target. The AI did the drafting; the decision to integrate it was yours.',
        docsUrl: 'https://git-scm.com/docs/git-merge',
      },
      milestone: { id: 'first-merge', title: 'First Merge!' },
    },
    {
      id: 'verify',
      title: 'Confirm What You Accepted',
      narrative: "Check that the AI's feature file now lives on main. Use `ls` to see files or `git log` to see the history.",
      expectedCommand: /(ls|git log|git status)/,
      hint: 'Try: ls or git log --oneline',
      validation: (_state, lastCommand) => /^(ls|git log|git status)/.test(lastCommand.trim()),
      helpContent: {
        explanation: 'After merging, main now has all the commits and files from the feature branch. The AI\'s work is part of your main line, and its history came along with it.',
        why: 'Always verify after a merge. Confirm the files you accepted are there and the log shows the right history — that\'s how you know exactly what made it into your project.',
      },
      milestone: { id: 'merge-verified', title: 'Merge Verified' },
    },
  ],
};
