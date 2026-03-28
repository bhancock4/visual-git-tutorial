import type { Scenario } from './types';

export const whatIsGitScenario: Scenario = {
  id: 'what-is-git',
  title: '0. What is Git?',
  description: 'Understand why git exists by experiencing the problem it solves',
  narrative:
    "Imagine you're building a website. You've been working on it all day and it's looking great. Then you make a change... and everything breaks. You can't remember what it looked like before. Your work is gone.\n\nThat's the problem git solves. Git is like a save system for your project — it lets you take snapshots, go back in time, and even work with other people without anyone's changes getting lost.\n\nLet's experience the problem first, then see how git fixes it.",
  difficulty: 'beginner',
  order: 0,
  tags: ['concepts', 'why-git', 'intro'],
  setup: (_engine) => {
    // Clean slate — user builds everything from scratch
  },
  docLinks: [
    { label: 'What is Git?', url: 'https://git-scm.com/book/en/v2/Getting-Started-What-is-Git%3F' },
    { label: 'Git basics', url: 'https://git-scm.com/book/en/v2/Getting-Started-Git-Basics' },
  ],
  tutorialSteps: [
    // === ACT 1: Life without git — experience the pain ===
    {
      id: 'create-project',
      title: 'Start Your Project',
      narrative:
        "You're building a website. Let's create the first page. This is your Working Directory — it's just a folder on your computer where your files live.",
      expectedCommand: 'echo "Welcome to my awesome site!" > index.html',
      hint: 'Type: echo "Welcome to my awesome site!" > index.html',
      isBashOnly: true,
      autoCommand: 'echo "Welcome to my awesome site!" > index.html',
      validation: (state) => state.workingDirectory.has('index.html'),
      helpContent: {
        explanation:
          '`echo "text" > file` creates a file with that content. Right now this is just a regular folder — no git yet.',
        why: "We're starting without git on purpose. You need to feel the problem before the solution makes sense.",
      },
    },
    {
      id: 'add-style',
      title: 'Add Some Style',
      narrative:
        "Nice! Now let's add a stylesheet to make it look good.",
      expectedCommand: 'echo "body { color: darkblue; }" > style.css',
      hint: 'Type: echo "body { color: darkblue; }" > style.css',
      isBashOnly: true,
      autoCommand: 'echo "body { color: darkblue; }" > style.css',
      validation: (state) => state.workingDirectory.has('style.css'),
      helpContent: {
        explanation: "You're building up a project with multiple files — just like a real website.",
        why: 'The more files you have, the harder it is to keep track of changes without a tool like git.',
      },
    },
    {
      id: 'check-work',
      title: 'Check Your Work',
      narrative:
        "Looking good! Use `cat` to read your file and confirm it's right. In a real project, you'd open this in a browser.",
      expectedCommand: 'cat index.html',
      hint: 'Type: cat index.html',
      isBashOnly: true,
      autoCommand: 'cat index.html',
      validation: (_state, lastCommand) => lastCommand.trim() === 'cat index.html',
      helpContent: {
        explanation: '`cat` prints the contents of a file. Your site says "Welcome to my awesome site!" — perfect.',
        why: "Take a good look at this version. You're about to lose it.",
      },
    },
    {
      id: 'break-it',
      title: 'Make a Risky Change',
      narrative:
        "Your site is working great. But you want to try something different — a complete rewrite of the homepage. Overwrite the file with new content.",
      expectedCommand: 'echo "UNDER CONSTRUCTION" > index.html',
      hint: 'Type: echo "UNDER CONSTRUCTION" > index.html',
      isBashOnly: true,
      autoCommand: 'echo "UNDER CONSTRUCTION" > index.html',
      validation: (state) => {
        const file = state.workingDirectory.get('index.html');
        return file !== undefined && file.content !== 'Welcome to my awesome site!';
      },
      helpContent: {
        explanation: 'You just overwrote your file. The old content is gone — there\'s no Ctrl+Z for this.',
        why: 'This is the exact moment where git would have saved you. Without it, your original work is lost forever. In real life, this happens with code changes, deleted files, and bad refactors.',
      },
      milestone: { id: 'felt-the-pain', title: 'Felt the Pain' },
    },
    {
      id: 'verify-loss',
      title: 'Try to Get It Back',
      narrative:
        "Hmm, that new version isn't great. Let's check what happened to your original work. Use `cat` to see what's in the file now.",
      expectedCommand: 'cat index.html',
      hint: 'Type: cat index.html',
      isBashOnly: true,
      autoCommand: 'cat index.html',
      validation: (_state, lastCommand) => lastCommand.trim() === 'cat index.html',
      helpContent: {
        explanation:
          'Your original "Welcome to my awesome site!" is gone. Replaced. No undo. No history. No way back.\n\nThis is what working without version control feels like. Every save is destructive — the old version just vanishes.',
        why: "In a real project, this could mean hours or days of work lost. This is the problem that drove developers to create git.",
      },
    },

    // === ACT 2: Git to the rescue ===
    {
      id: 'init-git',
      title: 'Turn On the Save System',
      narrative:
        "Okay, let's fix this. From now on, we'll use git. `git init` turns on git's tracking for this folder — think of it as enabling the save system in a game.",
      expectedCommand: 'git init',
      hint: 'Type: git init',
      validation: (state) => state.initialized,
      helpContent: {
        explanation:
          '`git init` creates a hidden `.git` folder that stores all your project history. Your files look the same — but now git is watching.',
        why: "This is always the first step. Once you run this, git starts paying attention to your files. It doesn't automatically save anything yet — you're in control of when to take snapshots.",
        docsUrl: 'https://git-scm.com/docs/git-init',
      },
      milestone: { id: 'save-system-on', title: 'Save System Activated' },
    },
    {
      id: 'fix-file',
      title: 'Rewrite Your Homepage',
      narrative:
        "Let's start fresh with a good version of the homepage. This time, we'll save it properly.",
      expectedCommand: 'echo "Welcome to my awesome site!" > index.html',
      hint: 'Type: echo "Welcome to my awesome site!" > index.html',
      isBashOnly: true,
      autoCommand: 'echo "Welcome to my awesome site!" > index.html',
      validation: (state) => {
        const file = state.workingDirectory.get('index.html');
        return file !== undefined && file.content === 'Welcome to my awesome site!';
      },
      helpContent: {
        explanation: "You're recreating the good version. This time we won't lose it.",
        why: 'In the real world, you might not be able to recreate your work from memory. That\'s what makes losing it so painful.',
      },
    },
    {
      id: 'stage-files',
      title: 'Choose What to Save',
      narrative:
        "Before git can save a snapshot, you need to tell it which files to include. This is called \"staging.\" Use `git add .` to stage everything. Watch the diagram — you'll see files move from the Working Directory to the Staging Area.",
      expectedCommand: 'git add .',
      hint: 'Type: git add . (the dot means "everything")',
      validation: (state) => state.stagingArea.size > 0,
      helpContent: {
        explanation:
          "`git add` moves files to the Staging Area. Think of it like putting items in a box before sealing it. You pick what goes in the snapshot.",
        why: "Why not just save everything automatically? Because sometimes you're working on two things at once and only one is ready. Staging lets you save exactly what you want.",
        docsUrl: 'https://git-scm.com/docs/git-add',
        relatedCommands: ['git status', 'git add .'],
      },
    },
    {
      id: 'first-save',
      title: 'Take a Snapshot',
      narrative:
        "Now seal the box. `git commit` takes everything in the Staging Area and saves it permanently. This is your save point — you can always come back here. Add a message with `-m` to describe what you're saving.",
      expectedCommand: /^git commit/,
      hint: 'Try: git commit -m "My awesome homepage"',
      validation: (state) => state.commits.size > 0,
      helpContent: {
        explanation:
          '`git commit -m "message"` creates a permanent snapshot of your staged files. The message describes what this snapshot contains. Each commit gets a unique ID (that weird hex string).',
        why: "This is the heart of git. Each commit is a save point you can return to. Unlike just saving a file, commits stack up — you build a timeline of your entire project's history.",
        docsUrl: 'https://git-scm.com/docs/git-commit',
      },
      milestone: { id: 'first-save-point', title: 'First Save Point!' },
    },
    {
      id: 'risky-change-again',
      title: 'Make Another Risky Change',
      narrative:
        "Now try something risky again. Overwrite the homepage — just like before. But this time, don't worry. Git has your back.",
      expectedCommand: 'echo "UNDER CONSTRUCTION" > index.html',
      hint: 'Type: echo "UNDER CONSTRUCTION" > index.html',
      isBashOnly: true,
      autoCommand: 'echo "UNDER CONSTRUCTION" > index.html',
      validation: (state) => {
        const file = state.workingDirectory.get('index.html');
        return file !== undefined && file.content !== 'Welcome to my awesome site!';
      },
      helpContent: {
        explanation: "You just overwrote the file again. Same move as before. But this time there's a difference — git remembers the old version.",
        why: 'This is the exact same situation that burned you earlier. Let\'s see how it plays out differently with git.',
      },
    },
    {
      id: 'check-log',
      title: 'See Your Save History',
      narrative:
        "Don't panic — your old version is safe. Use `git log` to see the snapshots you've taken.",
      expectedCommand: 'git log',
      hint: 'Type: git log',
      validation: (_state, lastCommand) => lastCommand.trim().startsWith('git log'),
      helpContent: {
        explanation:
          '`git log` shows all your commits — every snapshot you\'ve ever taken. Your "My awesome homepage" commit is right there. The original content is preserved inside it.',
        why: "This is the timeline of your project. Even though you overwrote the file, git still has the old version stored in that commit. Nothing is lost.",
        docsUrl: 'https://git-scm.com/docs/git-log',
      },
    },
    {
      id: 'restore',
      title: 'Go Back in Time',
      narrative:
        "Let's restore your old version. `git checkout -- index.html` tells git: \"throw away my current changes and go back to the last saved version.\" Watch the file content revert!",
      expectedCommand: /^git checkout -- /,
      hint: 'Type: git checkout -- index.html',
      validation: (state) => {
        const file = state.workingDirectory.get('index.html');
        return file !== undefined && file.content === 'Welcome to my awesome site!';
      },
      helpContent: {
        explanation:
          '`git checkout -- <file>` restores a file to its last committed version. Your "UNDER CONSTRUCTION" change is gone, and "Welcome to my awesome site!" is back.',
        why: "This is the moment. The same change that destroyed your work before is now completely reversible. That's the power of git — every commit is a safety net you can fall back to.",
        docsUrl: 'https://git-scm.com/docs/git-checkout',
        relatedCommands: ['git restore', 'git reset'],
      },
      milestone: { id: 'time-travel', title: 'Time Traveler!' },
    },
    {
      id: 'verify-restored',
      title: 'Confirm the Rescue',
      narrative:
        "Check the file — your original work should be back. Use `cat` to see it.",
      expectedCommand: 'cat index.html',
      hint: 'Type: cat index.html',
      isBashOnly: true,
      autoCommand: 'cat index.html',
      validation: (_state, lastCommand) => lastCommand.trim() === 'cat index.html',
      helpContent: {
        explanation:
          '"Welcome to my awesome site!" — it\'s back. Git kept your save point, and you were able to restore from it. No work lost.',
        why: "You just experienced the core loop of git:\n\n1. Do work\n2. Save a snapshot (commit)\n3. Experiment freely\n4. Restore if things go wrong\n\nThat's it. That's why git exists. Everything else — branches, merges, remotes — builds on this foundation.\n\nReady to learn more? Head to Scenario 1 to go deeper.",
      },
      milestone: { id: 'git-believer', title: 'Git Believer' },
    },
  ],
};
