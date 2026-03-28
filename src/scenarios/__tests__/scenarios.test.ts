/**
 * Smoke tests: for each scenario, execute the expected commands in sequence
 * and verify each step's validation function passes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { scenarios } from '../registry';
import { GitEngine } from '../../engine/GitEngine';
import { executeCommand } from '../../engine/commands';
import { resetHashCounter } from '../../engine/hash';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip the "Type: " or "Try: " prefix from a hint string to get the raw command.
 * Returns null if neither prefix is present.
 */
function commandFromHint(hint: string | undefined): string | null {
  if (!hint) return null;
  const match = hint.match(/^(?:Type|Try):\s+(.+)/);
  if (!match) return null;
  // Take only the first line (some hints are multi-sentence)
  return match[1].split(/\s+then\s+/i)[0].trim();
}

/**
 * Determine the single "primary" command to run for a tutorial step.
 *
 * Returns an array of commands because some steps need multiple commands
 * executed in sequence to satisfy their validation (e.g. git add + git commit).
 */
function commandsForStep(
  stepId: string,
  autoCommand: string | undefined,
  expectedCommand: string | RegExp | undefined,
  hint: string | undefined,
  scenarioId: string,
): string[] | null {
  // Steps with special multi-command sequences --------------------------------

  // branching: commit-feature — needs git add then git commit
  if (scenarioId === 'branching' && stepId === 'commit-feature') {
    return ['git add .', 'git commit -m "Add new feature"'];
  }

  // remote: make-remote-change — autoCommand only creates the file; we also
  // need to stage + commit for validation (state.commits.size >= 2)
  if (scenarioId === 'remote' && stepId === 'make-remote-change') {
    return [
      'echo "teammate work" > teammate.txt',
      'git add .',
      'git commit -m "Teammate update"',
    ];
  }

  // gitignore: commit-gitignore — needs git add then git commit
  if (scenarioId === 'gitignore' && stepId === 'commit-gitignore') {
    return ['git add .gitignore', 'git commit -m "Add .gitignore"'];
  }

  // oh-shit: recommit — needs echo + git add + git commit
  if (scenarioId === 'oh-shit' && stepId === 'recommit') {
    return [
      'echo "function app() { return \\"v3 - fixed\\"; }" > app.js',
      'git add .',
      'git commit -m "Version 3 - fixed"',
    ];
  }

  // Default resolution -------------------------------------------------------

  if (autoCommand) return [autoCommand];

  if (typeof expectedCommand === 'string') return [expectedCommand];

  if (expectedCommand instanceof RegExp) {
    const fromHint = commandFromHint(hint);
    if (fromHint) return [fromHint];
    return null;
  }

  // No expectedCommand — try falling back to hint directly
  if (hint) {
    const fromHint = commandFromHint(hint);
    if (fromHint) return [fromHint];
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scenario smoke tests', () => {
  for (const scenario of scenarios) {
    describe(scenario.title, () => {
      let engine: GitEngine;

      beforeEach(() => {
        resetHashCounter();
        engine = new GitEngine();
        scenario.setup(engine);
      });

      it('completes all tutorial steps in sequence', () => {
        let currentState = engine.getState();

        for (const step of scenario.tutorialSteps) {
          const commands = commandsForStep(
            step.id,
            step.autoCommand,
            step.expectedCommand,
            step.hint,
            scenario.id,
          );

          if (commands === null) {
            // Nothing to run — skip validation for this step
            continue;
          }

          // Execute all commands for this step; keep the last command string
          // for validation (mirrors how App.tsx passes lastCommand to validate)
          let lastCommand = commands[commands.length - 1];
          let result = executeCommand(engine, commands[0]);

          for (let i = 1; i < commands.length; i++) {
            lastCommand = commands[i];
            result = executeCommand(engine, commands[i]);
          }

          currentState = result.state;

          const passed = step.validation(currentState, lastCommand);

          expect(
            passed,
            `[${scenario.id}] step "${step.id}" ("${step.title}") failed validation.\n` +
              `  commands run: ${JSON.stringify(commands)}\n` +
              `  lastCommand: ${JSON.stringify(lastCommand)}`,
          ).toBe(true);
        }
      });
    });
  }
});
