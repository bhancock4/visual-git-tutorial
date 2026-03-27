import type { Scenario } from './types';
import { initRepoScenario } from './01-init-repo';
import { branchingScenario } from './02-branching';
import { mergingScenario } from './03-merging';
import { remoteScenario } from './04-remote';
import { mergeConflictsScenario } from './05-merge-conflicts';
import { gitignoreScenario } from './06-gitignore';
import { stashScenario } from './07-stash';
import { ohShitScenario } from './08-oh-shit';

export const scenarios: Scenario[] = [
  initRepoScenario,
  branchingScenario,
  mergingScenario,
  remoteScenario,
  mergeConflictsScenario,
  gitignoreScenario,
  stashScenario,
  ohShitScenario,
].sort((a, b) => a.order - b.order);

export function getScenarioById(id: string): Scenario | undefined {
  return scenarios.find(s => s.id === id);
}
