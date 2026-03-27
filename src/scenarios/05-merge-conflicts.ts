import type { Scenario } from './types';
import type { GitEngine } from '../engine/GitEngine';

export const mergeConflictsScenario: Scenario = {
  id: 'merge-conflicts',
  title: '5. Resolving Merge Conflicts',
  description: 'Handle the scary-sounding but totally manageable merge conflict',
  narrative: "Two people edited the same line of the same file. Git doesn't know which version to keep, so it asks you to decide. This is a merge conflict. It sounds scary, but once you understand the format, it's straightforward.",
  difficulty: 'intermediate',
  order: 5,
  tags: ['merge', 'conflict', 'resolution'],
  setup: (engine: GitEngine) => {
    engine.init();
    engine.createFile('story.txt', 'Once upon a time, there was a developer.\nThey wrote code every day.\nThe end.');
    engine.add(['.']);
    engine.commit('Initial story');

    // Create a branch and modify the story
    engine.checkout('plot-twist', { createBranch: true });
    engine.editFile('story.txt', 'Once upon a time, there was a developer.\nThey wrote AMAZING code every day.\nThey saved the world with their code.\nThe end.');
    engine.add(['.']);
    engine.commit('Add plot twist');

    // Go back to main and make a DIFFERENT change to the same line
    engine.checkout('main');
    engine.editFile('story.txt', 'Once upon a time, there was a developer.\nThey wrote TERRIBLE code every day.\nBut they never gave up.\nThe end.');
    engine.add(['.']);
    engine.commit('Add character flaw');
  },
  docLinks: [
    { label: 'Resolving merge conflicts', url: 'https://git-scm.com/docs/git-merge#_how_conflicts_are_presented' },
    { label: 'git merge docs', url: 'https://git-scm.com/docs/git-merge' },
  ],
  tutorialSteps: [
    {
      id: 'see-branches',
      title: 'Understand the Setup',
      narrative: "You're on `main`. There's a branch called `plot-twist` that changed the same file differently. Let's see what we're working with.",
      expectedCommand: /(git log|git branch|cat)/,
      hint: 'Try: git branch to see branches, or cat story.txt to see the current file',
      validation: (_state, lastCommand) => /^(git log|git branch|cat|ls)/.test(lastCommand.trim()),
      helpContent: {
        explanation: 'Both branches modified story.txt differently. Main says "TERRIBLE code" while plot-twist says "AMAZING code". Git won\'t know which to keep.',
        why: 'Understanding what changed on each branch helps you resolve conflicts intelligently.',
      },
    },
    {
      id: 'attempt-merge',
      title: 'Attempt the Merge',
      narrative: "Now try to merge `plot-twist` into `main`. Git will detect the conflict and tell you about it.",
      expectedCommand: 'git merge plot-twist',
      hint: 'Type: git merge plot-twist',
      validation: (state) => state.conflicts.length > 0,
      helpContent: {
        explanation: 'Git found that both branches changed the same lines in story.txt. It can\'t automatically decide which version to keep, so it marks the file with conflict markers and asks you to resolve it.',
        why: 'Conflicts are normal and expected. They happen whenever two branches edit the same part of a file. The key is knowing how to read and fix the conflict markers.',
        docsUrl: 'https://git-scm.com/docs/git-merge#_how_conflicts_are_presented',
      },
      milestone: { id: 'first-conflict', title: 'First Conflict Encountered' },
    },
    {
      id: 'view-conflict',
      title: 'View the Conflict',
      narrative: "Look at the conflicted file. You'll see special markers: `<<<<<<<` (your version), `=======` (divider), and `>>>>>>>` (their version).",
      expectedCommand: /cat story\.txt/,
      hint: 'Type: cat story.txt to see the conflict markers',
      validation: (_state, lastCommand) => lastCommand.includes('cat'),
      helpContent: {
        explanation: 'Between <<<<<<< HEAD and ======= is YOUR version (main). Between ======= and >>>>>>> plot-twist is THEIR version. You need to pick one, combine them, or write something entirely new.',
        why: 'Learning to read conflict markers is a fundamental git skill. Every developer encounters these.',
      },
    },
    {
      id: 'resolve-conflict',
      title: 'Resolve the Conflict',
      narrative: "Edit the file to resolve the conflict. Remove the conflict markers and write the version you want to keep. Use `echo` to overwrite the file with your chosen content.",
      expectedCommand: /echo/,
      hint: 'Try: echo "Once upon a time, there was a developer.\nThey wrote AMAZING code every day.\nThey saved the world with their code.\nThe end." > story.txt',
      isBashOnly: true,
      autoCommand: 'echo "Once upon a time, there was a developer.\nThey wrote AMAZING code every day.\nThey saved the world with their code.\nThe end." > story.txt',
      validation: (state) => {
        const file = state.workingDirectory.get('story.txt');
        return file ? !file.content.includes('<<<<<<<') : false;
      },
      helpContent: {
        explanation: 'To resolve a conflict, you edit the file to contain exactly what you want. Remove ALL the conflict markers (<<<, ===, >>>) and leave only the final content.',
        why: 'You are the human making the decision. Git showed you both versions - now it\'s your job to decide what the final result should be.',
      },
    },
    {
      id: 'stage-resolution',
      title: 'Stage the Resolution',
      narrative: "Tell git you've resolved the conflict by staging the file with `git add`.",
      expectedCommand: /git add/,
      hint: 'Type: git add story.txt',
      validation: (state) => state.conflicts.length === 0 && state.stagingArea.size > 0,
      helpContent: {
        explanation: '`git add` on a conflicted file tells git "I\'ve fixed this conflict, it\'s ready to go." This removes the file from the conflicted state.',
        why: 'Adding the resolved file signals to git that you\'ve handled the conflict. Until you do this, git won\'t let you commit.',
      },
    },
    {
      id: 'complete-merge',
      title: 'Complete the Merge Commit',
      narrative: "Now commit to finalize the merge. This creates a special merge commit that has two parents.",
      expectedCommand: /git commit/,
      hint: 'Type: git commit -m "Merge plot-twist: resolved story conflict"',
      validation: (state) => {
        for (const [, commit] of state.commits) {
          if (commit.parentHashes.length === 2) return true;
        }
        return false;
      },
      helpContent: {
        explanation: 'The merge commit ties both branches\' histories together. In the commit graph, you\'ll see it has two parent arrows - one from each branch.',
        why: 'Merge commits are special. They record that two different lines of development were combined, and they preserve the complete history of both branches.',
      },
      milestone: { id: 'conflict-resolved', title: 'Conflict Resolver' },
    },
  ],
};
