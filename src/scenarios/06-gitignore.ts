import type { Scenario } from './types';
import type { GitEngine } from '../engine/GitEngine';

export const gitignoreScenario: Scenario = {
  id: 'gitignore',
  title: '6. Using .gitignore',
  description: 'Keep files out of your repository with .gitignore',
  narrative: "Not everything belongs in git. API keys, build artifacts, node_modules, personal config files - some things should stay local. A `.gitignore` file tells git to pretend certain files don't exist.",
  difficulty: 'beginner',
  order: 6,
  tags: ['gitignore', 'tracking'],
  setup: (engine: GitEngine) => {
    engine.init();
    engine.createFile('app.js', 'const API_KEY = process.env.API_KEY;\nconsole.log("Running...");');
    engine.createFile('.env', 'API_KEY=super-secret-key-12345\nDB_PASSWORD=password123');
    engine.createFile('notes.txt', 'TODO: fix the bug on line 42');
    engine.add(['app.js']);
    engine.commit('Initial commit');
  },
  docLinks: [
    { label: '.gitignore docs', url: 'https://git-scm.com/docs/gitignore' },
    { label: 'gitignore patterns', url: 'https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository#_ignoring' },
  ],
  tutorialSteps: [
    {
      id: 'see-problem',
      title: 'See the Problem',
      narrative: "Run `git status`. You'll see `.env` and `notes.txt` as untracked files. The `.env` file contains secrets - we NEVER want that in git.",
      expectedCommand: 'git status',
      hint: 'Type: git status',
      validation: (_state, lastCommand) => lastCommand.trim() === 'git status',
      helpContent: {
        explanation: 'Git sees all files in your working directory. Without a .gitignore, you might accidentally commit sensitive files like .env (which contains passwords and API keys).',
        why: 'Accidentally committing secrets to git is one of the most common and dangerous mistakes. Once a secret is in git history, it\'s very hard to remove completely.',
      },
    },
    {
      id: 'create-gitignore',
      title: 'Create a .gitignore File',
      narrative: "Create a `.gitignore` file that tells git to ignore `.env` files and `notes.txt`. Each line is a pattern.",
      expectedCommand: /echo.*\.gitignore/,
      hint: 'Try: echo ".env\nnotes.txt" > .gitignore',
      isBashOnly: true,
      autoCommand: 'echo ".env\nnotes.txt" > .gitignore',
      validation: (state) => state.workingDirectory.has('.gitignore'),
      helpContent: {
        explanation: 'A .gitignore file contains patterns, one per line. Any file matching a pattern will be invisible to git. Common patterns: `.env`, `node_modules/`, `*.log`, `dist/`.',
        why: 'Every project should have a .gitignore from day one. It protects you from accidentally committing things that shouldn\'t be tracked.',
        docsUrl: 'https://git-scm.com/docs/gitignore',
      },
      milestone: { id: 'first-gitignore', title: 'Ignore List Created' },
    },
    {
      id: 'verify-ignored',
      title: 'Verify Files Are Ignored',
      narrative: "Run `git status` again. The `.env` and `notes.txt` files should no longer appear as untracked.",
      expectedCommand: 'git status',
      hint: 'Type: git status',
      validation: (_state, lastCommand) => lastCommand.trim() === 'git status',
      helpContent: {
        explanation: 'Now git status only shows .gitignore as untracked. The .env and notes.txt files are invisible to git - exactly what we want.',
        why: 'Always verify your .gitignore is working. A misconfigured pattern means files might still leak through.',
      },
    },
    {
      id: 'commit-gitignore',
      title: 'Commit Your .gitignore',
      narrative: "The .gitignore file itself SHOULD be committed - it protects everyone who works on the project, not just you.",
      expectedCommand: /git commit/,
      hint: 'git add .gitignore then git commit -m "Add .gitignore"',
      validation: (state) => {
        for (const [, commit] of state.commits) {
          if (commit.snapshot.has('.gitignore')) return true;
        }
        return false;
      },
      helpContent: {
        explanation: 'Unlike the files it ignores, .gitignore itself should absolutely be committed. This way, everyone cloning your repo gets the same ignore rules.',
        why: 'Sharing .gitignore through the repo ensures consistent behavior across all developers working on the project.',
      },
      milestone: { id: 'gitignore-committed', title: 'Secrets Protected' },
    },
  ],
};
