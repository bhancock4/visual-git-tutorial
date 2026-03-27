import type { Scenario } from './types';
import type { GitEngine } from '../engine/GitEngine';

export const stashScenario: Scenario = {
  id: 'stash',
  title: '7. Git Stash',
  description: 'Temporarily shelve changes to work on something else',
  narrative: "You're in the middle of working on something when your teammate asks you to review their urgent fix on a different branch. You're not ready to commit your half-done work. What do you do? `git stash` to the rescue!",
  difficulty: 'intermediate',
  order: 7,
  tags: ['stash', 'workflow'],
  setup: (engine: GitEngine) => {
    engine.init();
    engine.createFile('main.js', 'function app() {\n  console.log("Running");\n}\napp();');
    engine.add(['.']);
    engine.commit('Initial app');

    // Create the urgent branch that teammate needs reviewed
    engine.checkout('urgent-fix', { createBranch: true });
    engine.editFile('main.js', 'function app() {\n  console.log("Running v2");\n}\napp();');
    engine.add(['.']);
    engine.commit('Urgent fix applied');

    // Go back to main and start working on something
    engine.checkout('main');
    engine.createFile('new-feature.js', '// Work in progress\nfunction halfDone() {\n  // TODO: finish this\n}');
    engine.editFile('main.js', 'function app() {\n  console.log("Running");\n  halfDone(); // calling new feature\n}\napp();');
  },
  docLinks: [
    { label: 'git stash docs', url: 'https://git-scm.com/docs/git-stash' },
  ],
  tutorialSteps: [
    {
      id: 'see-wip',
      title: 'See Your Work in Progress',
      narrative: "You've been working on a new feature and have uncommitted changes. Check the status to see them.",
      expectedCommand: 'git status',
      hint: 'Type: git status',
      validation: (_state, lastCommand) => lastCommand.trim() === 'git status',
      helpContent: {
        explanation: 'You have modified main.js and created new-feature.js. These changes aren\'t committed yet - they\'re just sitting in your Working Directory.',
        why: 'Knowing what you have in progress is important before stashing, so you know what will be shelved.',
      },
    },
    {
      id: 'stash-changes',
      title: 'Stash Your Changes',
      narrative: "Your work isn't ready to commit, but you need a clean Working Directory to switch branches. Use `git stash` to temporarily shelve your changes.",
      expectedCommand: /git stash/,
      hint: 'Type: git stash',
      validation: (state) => state.stash.length > 0,
      helpContent: {
        explanation: '`git stash` takes all your uncommitted changes (both staged and unstaged) and saves them on a stack. Your Working Directory is reset to the last commit.',
        why: 'Stash is like a clipboard for git changes. It lets you save work without committing, switch contexts, and come back to it later.',
        docsUrl: 'https://git-scm.com/docs/git-stash',
      },
      milestone: { id: 'first-stash', title: 'First Stash' },
    },
    {
      id: 'verify-clean',
      title: 'Verify Clean State',
      narrative: "Check status again. Your Working Directory should be clean - all your changes are safely stashed.",
      expectedCommand: 'git status',
      hint: 'Type: git status',
      validation: (_state, lastCommand) => lastCommand.trim() === 'git status',
      helpContent: {
        explanation: 'Working tree is clean! Your half-done feature is safely stored in the stash. You can now freely switch branches.',
        why: 'A clean working directory is required to switch branches safely (unless the changes apply cleanly to the target branch).',
      },
    },
    {
      id: 'review-branch',
      title: 'Switch to Review the Urgent Fix',
      narrative: "Now you can switch to your teammate's branch to review their fix.",
      expectedCommand: /git checkout urgent-fix/,
      hint: 'Type: git checkout urgent-fix',
      validation: (state) => state.HEAD.type === 'branch' && state.HEAD.name === 'urgent-fix',
      helpContent: {
        explanation: 'With a clean working directory, you can switch branches freely. You\'re now looking at your teammate\'s urgent fix.',
        why: 'This is the real-world workflow: stash your WIP, review someone else\'s code, then come back to your work.',
      },
    },
    {
      id: 'go-back',
      title: 'Switch Back to Main',
      narrative: "Review done! Switch back to main to continue your feature work.",
      expectedCommand: /git checkout main/,
      hint: 'Type: git checkout main',
      validation: (state) => state.HEAD.type === 'branch' && state.HEAD.name === 'main',
      helpContent: {
        explanation: 'Back on main. But where are your changes? They\'re still in the stash, waiting to be popped.',
        why: 'Your stash persists across branch switches. It\'s not tied to any particular branch.',
      },
    },
    {
      id: 'pop-stash',
      title: 'Restore Your Stashed Changes',
      narrative: "Now bring your work back with `git stash pop`. Your half-done feature will reappear!",
      expectedCommand: /git stash pop/,
      hint: 'Type: git stash pop',
      validation: (state) => state.stash.length === 0 && state.workingDirectory.has('new-feature.js'),
      helpContent: {
        explanation: '`git stash pop` restores your stashed changes and removes them from the stash. `git stash apply` would restore them but keep them in the stash.',
        why: 'Pop is the most common way to restore. Use apply if you want to apply the same stash to multiple branches.',
      },
      milestone: { id: 'stash-master', title: 'Stash Master' },
    },
  ],
};
