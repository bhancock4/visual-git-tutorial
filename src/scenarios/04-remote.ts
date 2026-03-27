import type { Scenario } from './types';
import type { GitEngine } from '../engine/GitEngine';

export const remoteScenario: Scenario = {
  id: 'remote',
  title: '4. Working with Remotes',
  description: 'Connect to a remote repository and push/pull changes',
  narrative: "So far everything has been local on your machine. But git's real power is collaboration. A remote repository (like GitHub) lets you share your code and work with others. Let's set one up and learn push and pull.",
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
        why: 'The remote is how you share code. "origin" is just a nickname - you could call it anything, but origin is the standard name for your primary remote.',
        docsUrl: 'https://git-scm.com/docs/git-remote',
      },
      milestone: { id: 'first-remote', title: 'Connected to Remote' },
    },
    {
      id: 'push',
      title: 'Push to Remote',
      narrative: "Now let's send your commits to the remote. `git push` copies your commits from Local Repository to the Remote Repository. Watch the visual diagram!",
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
        why: 'Pushing is how you back up your work and share it with others. Until you push, your commits only exist on your machine.',
        docsUrl: 'https://git-scm.com/docs/git-push',
        relatedCommands: ['git push -u origin main'],
      },
      milestone: { id: 'first-push', title: 'First Push!' },
    },
    {
      id: 'make-remote-change',
      title: 'Simulate a Remote Change',
      narrative: "In real life, someone else might push changes to the remote. Let's simulate that. Create a new file and commit it - pretend a teammate did this on the remote.",
      expectedCommand: /echo|touch/,
      hint: 'Try: echo "teammate work" > teammate.txt then git add . and git commit -m "Teammate update"',
      isBashOnly: true,
      autoCommand: 'echo "teammate work" > teammate.txt',
      validation: (state) => {
        // Check if there are commits beyond the initial one
        return state.commits.size >= 2;
      },
      helpContent: {
        explanation: "In this simulation, we're creating changes locally that represent what a teammate might push to the remote. In real git, their push would update the remote directly.",
        why: 'Understanding that remotes can change independently from your local repo is key to collaboration.',
      },
    },
    {
      id: 'push-again',
      title: 'Push Your Latest Work',
      narrative: "Now push your latest commit to keep the remote up to date.",
      expectedCommand: /git push/,
      hint: 'Type: git push origin main',
      validation: (_state, lastCommand) => lastCommand.includes('git push'),
      helpContent: {
        explanation: 'Each push sends any new commits to the remote. The remote updates to match your local branch.',
        why: 'Push frequently to keep your remote backup current and to share your work with teammates.',
      },
      milestone: { id: 'push-pro', title: 'Push Pro' },
    },
  ],
};
