import type { Scenario } from './types';

export const sandboxScenario: Scenario = {
  id: 'sandbox',
  title: '9. Sandbox',
  description: 'Experiment freely with git — no tutorial, no rules',
  narrative:
    "You've learned the fundamentals. Now it's your playground. Type any git command and watch what happens in the visualizations. Create branches, merge them, break things, fix them. There are no steps here — just you and git. Use the Undo button if you want to rewind. Use Shift+Enter to preview what a command would do before running it.",
  difficulty: 'beginner',
  order: 9,
  tags: ['freeform', 'sandbox', 'practice'],
  setup: (engine) => {
    // Start with an initialized repo and one commit so there's something to work with
    engine.init();
    engine.createFile('readme.txt', 'My Project');
    engine.add(['.']);
    engine.commit('Initial commit');
    engine.remoteAdd('origin', 'https://github.com/you/project.git');
  },
  docLinks: [
    { label: 'Git reference', url: 'https://git-scm.com/docs' },
    { label: 'Git cheat sheet', url: 'https://education.github.com/git-cheat-sheet-education.pdf' },
  ],
  tutorialSteps: [],
};
