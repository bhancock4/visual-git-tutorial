import type { Scenario } from './types';
import type { GitEngine } from '../engine/GitEngine';

export const branchingScenario: Scenario = {
  id: 'branching',
  title: '2. Branching Out',
  description: 'Create a branch so you can try an AI experiment without risking your working code',
  narrative:
    "You and your AI co-builder have a working site. It runs, it looks fine, and you don't want to break it. Then the AI pitches a bold idea: a big redesign that might be great — or might make a mess.\n\nHere's the trap: if you let the AI change your main line of work directly, a bad experiment buries good code. Branches are how you stay in control. A branch is a parallel copy of your project where you (and the AI) can experiment freely. If the idea works, you keep it. If it doesn't, you throw the branch away and your main work never even saw it.",
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
      title: 'See Which Branch You\'re On',
      narrative: "Your known-good site lives on the `main` branch. Before you let the AI experiment, confirm where you are by listing all branches.",
      expectedCommand: 'git branch',
      hint: 'Type: git branch',
      validation: (_state, lastCommand) => lastCommand.trim() === 'git branch',
      helpContent: {
        explanation: '`git branch` lists all branches. The one with a `*` next to it is your current branch.',
        why: "Knowing which branch you're on is what keeps you in control. Letting an AI make a risky change directly on `main` is how good work gets buried under a bad experiment — so always check before you build.",
        docsUrl: 'https://git-scm.com/docs/git-branch',
      },
    },
    {
      id: 'create-branch',
      title: 'Create a Branch for the Experiment',
      narrative: "The AI wants to try its redesign. Instead of touching `main`, give the experiment its own space. Create a branch called `feature`. It starts as an exact copy of where you are now, so the AI has your working site to build on.",
      expectedCommand: /git (branch feature|checkout -b feature)/,
      hint: 'Try: git checkout -b feature (creates AND switches in one command)',
      validation: (state) => state.branches.has('feature'),
      helpContent: {
        explanation: '`git checkout -b feature` creates a new branch called "feature" and switches to it immediately. `git branch feature` just creates it without switching.',
        why: 'Branches are cheap in git. Spin one up for every AI experiment, feature, or bug fix. Whatever happens on the branch stays off `main` until you decide it\'s worth keeping — so you can let the AI take real risks without endangering your working code.',
        docsUrl: 'https://git-scm.com/docs/git-checkout',
      },
      milestone: { id: 'first-branch', title: 'First Branch Created' },
    },
    {
      id: 'switch-to-feature',
      title: 'Switch to the Experiment Branch',
      narrative: "If you used `git checkout -b`, you're already there! Otherwise, switch to the feature branch now — this is the safe workspace where the AI's experiment will happen.",
      expectedCommand: /git (checkout|switch) feature/,
      hint: 'Type: git checkout feature',
      validation: (state) => state.HEAD.type === 'branch' && state.HEAD.name === 'feature',
      helpContent: {
        explanation: '`git checkout feature` switches your Working Directory to match the feature branch. All your files update to reflect that branch\'s latest commit.',
        why: 'Now anything you or the AI does lands on `feature`, not `main`. Switching branches swaps your working files to that branch\'s version, so `main` stays exactly as you left it.',
      },
    },
    {
      id: 'make-change',
      title: 'Let the AI Build the Experiment',
      narrative: "You're on the experiment branch, so let the AI go for it. Have it draft the redesign here. This change will only exist on the `feature` branch — `main` won't see it.",
      expectedCommand: /echo|touch/,
      hint: 'Try: echo "/* AI redesign experiment */" > redesign.css',
      isBashOnly: true,
      autoCommand: 'echo "/* AI redesign experiment */" > redesign.css',
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
        explanation: 'Any files you or the AI create or modify on this branch are independent of the main branch. This is the power of branching.',
        why: 'On a branch, the AI can experiment freely — rewrite files, try a new approach, make a mess. If it goes wrong, `main` is untouched and you just walk away from the branch.',
      },
    },
    {
      id: 'commit-feature',
      title: 'Save the Experiment on the Branch',
      narrative: "The AI's redesign is drafted. Save it to the branch so the experiment is recorded. Remember: `git add` first, then `git commit -m`.",
      expectedCommand: /git commit/,
      hint: 'First: git add . then: git commit -m "Add new feature"',
      validation: (state) => {
        const featureBranch = state.branches.get('feature');
        const mainBranch = state.branches.get('main');
        return featureBranch && mainBranch ? featureBranch.commitHash !== mainBranch.commitHash : false;
      },
      helpContent: {
        explanation: 'This commit only exists on the feature branch. The main branch still points to the old commit — your known-good site.',
        why: "This is how git lets you and the AI build in parallel. The experiment now has its own history, separate from `main`, from the point it branched off. Nothing you commit here can touch your working code.",
        relatedCommands: ['git log --oneline', 'git log --all --oneline'],
      },
      milestone: { id: 'branch-commit', title: 'Committed on a Branch' },
    },
    {
      id: 'switch-back',
      title: 'Return to Your Safe Main',
      narrative: "Now switch back to `main` and watch the AI's redesign disappear from your Working Directory. Don't worry — it's safe on the feature branch. This is the payoff: `main` never saw the experiment.",
      expectedCommand: /git (checkout|switch) main/,
      hint: 'Type: git checkout main',
      validation: (state) => state.HEAD.type === 'branch' && state.HEAD.name === 'main',
      helpContent: {
        explanation: 'Switching back to main restores your files to how they were before the experiment. The AI\'s work is safely stored on its branch.',
        why: 'This is the whole point of branching with AI: `main` stayed stable the entire time. If the experiment is bad, you drop the branch and lose nothing. If it\'s good, you can bring it into `main` — that\'s merging, and it\'s the next scenario.',
      },
      milestone: { id: 'branch-switch', title: 'Branch Navigator' },
    },
  ],
};
