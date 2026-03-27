import type { Scenario } from './types';
import type { GitEngine } from '../engine/GitEngine';

export const branchingScenario: Scenario = {
  id: 'branching',
  title: '2. Branching Out',
  description: 'Create branches, switch between them, and understand how branches work',
  narrative: "You're working on a project and want to try something new without messing up your working code. Branches let you create a parallel version of your project to experiment with. Think of them like save slots in a game.",
  difficulty: 'beginner',
  order: 2,
  tags: ['branching', 'checkout', 'branch'],
  setup: (engine: GitEngine) => {
    engine.init();
    engine.createFile('index.html', '<!DOCTYPE html>\n<html>\n<head><title>My Site</title></head>\n<body>\n  <h1>Welcome</h1>\n</body>\n</html>');
    engine.createFile('style.css', 'body {\n  font-family: sans-serif;\n  margin: 20px;\n}');
    engine.add(['.']);
    engine.commit('Initial commit: basic website');
  },
  docLinks: [
    { label: 'git branch docs', url: 'https://git-scm.com/docs/git-branch' },
    { label: 'git checkout docs', url: 'https://git-scm.com/docs/git-checkout' },
    { label: 'git switch docs', url: 'https://git-scm.com/docs/git-switch' },
  ],
  tutorialSteps: [
    {
      id: 'check-branch',
      title: 'See Your Current Branch',
      narrative: "You start on the `main` branch. Let's verify that by listing all branches.",
      expectedCommand: 'git branch',
      hint: 'Type: git branch',
      validation: (_state, lastCommand) => lastCommand.trim() === 'git branch',
      helpContent: {
        explanation: '`git branch` lists all branches. The one with a `*` next to it is your current branch.',
        why: "Knowing which branch you're on is crucial. Making changes on the wrong branch is one of the most common git mistakes.",
        docsUrl: 'https://git-scm.com/docs/git-branch',
      },
    },
    {
      id: 'create-branch',
      title: 'Create a New Branch',
      narrative: "Let's create a new branch called `feature` for our experimental work. This branch starts as an exact copy of wherever you are now.",
      expectedCommand: /git (branch feature|checkout -b feature)/,
      hint: 'Try: git checkout -b feature (creates AND switches in one command)',
      validation: (state) => state.branches.has('feature'),
      helpContent: {
        explanation: '`git checkout -b feature` creates a new branch called "feature" and switches to it immediately. `git branch feature` just creates it without switching.',
        why: 'Branches are cheap in git. Create one for every feature, bug fix, or experiment. This keeps your main branch stable.',
        docsUrl: 'https://git-scm.com/docs/git-checkout',
      },
      milestone: { id: 'first-branch', title: 'First Branch Created' },
    },
    {
      id: 'switch-to-feature',
      title: 'Switch to the Feature Branch',
      narrative: "If you used `git checkout -b`, you're already there! Otherwise, switch to the feature branch now.",
      expectedCommand: /git (checkout|switch) feature/,
      hint: 'Type: git checkout feature',
      validation: (state) => state.HEAD.type === 'branch' && state.HEAD.name === 'feature',
      helpContent: {
        explanation: '`git checkout feature` switches your Working Directory to match the feature branch. All your files update to reflect that branch\'s latest commit.',
        why: 'Switching branches changes your working files. Git replaces them with the version from the branch you\'re switching to.',
      },
    },
    {
      id: 'make-change',
      title: 'Make a Change on the Feature Branch',
      narrative: "Now add something new. Create a file or modify one. This change will only exist on the `feature` branch.",
      expectedCommand: /echo|touch/,
      hint: 'Try: echo "New feature!" > feature.txt',
      isBashOnly: true,
      autoCommand: 'echo "New feature!" > feature.txt',
      validation: (state) => {
        const headCommit = state.HEAD.type === 'branch'
          ? state.branches.get(state.HEAD.name)
          : null;
        return state.workingDirectory.size > (headCommit ? state.commits.get(headCommit.commitHash)?.snapshot.size || 0 : 0)
          || Array.from(state.workingDirectory.values()).some(f => {
            const committed = headCommit ? state.commits.get(headCommit.commitHash)?.snapshot.get(f.path) : null;
            return committed ? committed.content !== f.content : false;
          });
      },
      helpContent: {
        explanation: 'Any files you create or modify on this branch are independent of the main branch. This is the power of branching.',
        why: 'Working on a branch means you can experiment freely. If things go wrong, main is untouched.',
      },
    },
    {
      id: 'commit-feature',
      title: 'Commit Your Feature',
      narrative: "Stage and commit your changes. Remember: `git add` first, then `git commit -m`.",
      expectedCommand: /git commit/,
      hint: 'First: git add . then: git commit -m "Add new feature"',
      validation: (state) => {
        const featureBranch = state.branches.get('feature');
        const mainBranch = state.branches.get('main');
        return featureBranch && mainBranch ? featureBranch.commitHash !== mainBranch.commitHash : false;
      },
      helpContent: {
        explanation: 'This commit only exists on the feature branch. The main branch still points to the old commit.',
        why: "This is how git enables parallel development. Each branch has its own independent history from the point it diverged.",
        relatedCommands: ['git log --oneline', 'git log --all --oneline'],
      },
      milestone: { id: 'branch-commit', title: 'Committed on a Branch' },
    },
    {
      id: 'switch-back',
      title: 'Switch Back to Main',
      narrative: "Now switch back to `main` and notice that your feature changes disappear from the Working Directory. Don't worry - they're safe on the feature branch!",
      expectedCommand: /git (checkout|switch) main/,
      hint: 'Type: git checkout main',
      validation: (state) => state.HEAD.type === 'branch' && state.HEAD.name === 'main',
      helpContent: {
        explanation: 'Switching back to main restores your files to how they were before the feature branch changes. Your feature work is safely stored on its branch.',
        why: 'This demonstrates the core concept: branches are independent timelines. You can jump between them instantly.',
      },
      milestone: { id: 'branch-switch', title: 'Branch Navigator' },
    },
  ],
};
