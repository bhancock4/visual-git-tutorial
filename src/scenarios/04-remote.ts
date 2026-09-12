import type { Scenario } from './types';
import type { GitEngine } from '../engine/GitEngine';

export const remoteScenario: Scenario = {
  id: 'remote',
  title: '4. Working with Remotes',
  description: 'Sync your work with a remote so it lives somewhere beyond your machine',
  narrative:
    "Everything you and your AI co-builder have made so far lives on one machine. If that machine dies, or you switch to another one, or an automated job needs your code, it's all stuck.\n\nA remote fixes that. A remote repository (like GitHub) is a shared copy of your project that lives elsewhere. You `push` to send your history up and `pull` to bring new work down. It's your backup and your sync point — the place your commits go to be safe, and where changes from your other devices or agents show up. Let's set one up.",
  difficulty: 'beginner',
  order: 4,
  tags: ['remote', 'push', 'pull', 'fetch'],
  setup: (engine: GitEngine) => {
    engine.init();
    engine.createFile('README.md', '# My Project\n\nA cool project.');
    engine.add(['.']);
    engine.commit('Initial commit');
  },
  docLinks: [
    { label: 'GitHub: Create a repo', url: 'https://docs.github.com/en/get-started/quickstart/create-a-repo' },
    { label: 'GitHub: Set up SSH keys', url: 'https://docs.github.com/en/authentication/connecting-to-github-with-ssh' },
    { label: 'git remote docs', url: 'https://git-scm.com/docs/git-remote' },
    { label: 'git push docs', url: 'https://git-scm.com/docs/git-push' },
    { label: 'git pull docs', url: 'https://git-scm.com/docs/git-pull' },
  ],
  tutorialSteps: [
    {
      id: 'add-remote',
      title: 'Add a Remote',
      narrative: "A remote is a copy of your repo that lives somewhere else (usually a server like GitHub). Let's connect to one by giving it a name and URL. By convention, the main remote is called `origin`.",
      expectedCommand: /git remote add/,
      hint: 'Try: git remote add origin https://github.com/you/project.git',
      validation: (state) => state.remotes.size > 0,
      helpContent: {
        explanation: '`git remote add origin <url>` tells git "there\'s another copy of this repo at this URL, and I want to call it origin."',
        why: "The remote is your history's home away from your laptop — a backup and a sync point. \"origin\" is just a nickname; you could call it anything, but origin is the standard name for your primary remote. Even building solo with AI, this is what keeps your work from being trapped on one machine.",
        docsUrl: 'https://git-scm.com/docs/git-remote',
      },
      milestone: { id: 'first-remote', title: 'Connected to Remote' },
    },
    {
      id: 'push',
      title: 'Push to Remote',
      narrative: "Now send your commits to the remote. `git push` copies your commits — everything you and the AI have built — from your Local Repository up to the Remote Repository. Watch the visual diagram!",
      expectedCommand: /git push/,
      hint: 'Type: git push origin main',
      validation: (state) => {
        for (const [, remote] of state.remotes) {
          if (remote.branches.size > 0) return true;
        }
        return false;
      },
      helpContent: {
        explanation: '`git push origin main` sends your main branch\'s commits to the remote called origin. The remote now has a copy of your work.',
        why: 'Pushing is how you back up your work and make it available beyond this machine. Until you push, your commits — and every AI-assisted change in them — only exist locally.',
        docsUrl: 'https://git-scm.com/docs/git-push',
        relatedCommands: ['git push -u origin main'],
      },
      milestone: { id: 'first-push', title: 'First Push!' },
    },
    {
      id: 'make-remote-change',
      title: 'A New Change Shows Up',
      narrative: "The remote doesn't only receive your pushes — it can move ahead of you. Maybe you committed a fix on another machine, or an automated agent pushed one. Let's simulate a new change landing that needs to reach the remote: create a file and commit it.",
      expectedCommand: /echo|touch/,
      hint: 'Try: echo "quick fix" > hotfix.txt then git add . and git commit -m "Quick fix from another session"',
      isBashOnly: true,
      autoCommand: 'echo "quick fix" > hotfix.txt',
      validation: (state) => {
        // Check if there are commits beyond the initial one
        return state.commits.size >= 2;
      },
      helpContent: {
        explanation: "In this simulation we're making a new commit locally to stand in for work that arrived from elsewhere — another device or an automated agent. In real git, that change would already be on the remote, and you'd bring it down with `git pull`.",
        why: 'The key idea: your local repo and the remote can drift apart. Work can land in either place, so syncing in both directions — push and pull — is what keeps them together.',
      },
    },
    {
      id: 'push-again',
      title: 'Push to Sync Again',
      narrative: "Push your latest commit to bring the remote back in sync with your local work.",
      expectedCommand: /git push/,
      hint: 'Type: git push origin main',
      validation: (_state, lastCommand) => lastCommand.includes('git push'),
      helpContent: {
        explanation: 'Each push sends any new commits to the remote. The remote updates to match your local branch.',
        why: 'Push often to keep your remote backup current and your machines in sync. The more you build with AI, the more small changes pile up — frequent pushes make sure none of them are stranded on one device.',
      },
      milestone: { id: 'push-pro', title: 'Push Pro' },
    },
  ],
};
