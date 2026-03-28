import type { Scenario } from './types';
import { whatIsGitScenario } from './00-what-is-git';
import { initRepoScenario } from './01-init-repo';
import { branchingScenario } from './02-branching';
import { mergingScenario } from './03-merging';
import { remoteScenario } from './04-remote';
import { mergeConflictsScenario } from './05-merge-conflicts';
import { gitignoreScenario } from './06-gitignore';
import { stashScenario } from './07-stash';
import { ohShitScenario } from './08-oh-shit';
import { sandboxScenario } from './09-sandbox';

export const scenarios: Scenario[] = [
  whatIsGitScenario,
  initRepoScenario,
  branchingScenario,
  mergingScenario,
  remoteScenario,
  mergeConflictsScenario,
  gitignoreScenario,
  stashScenario,
  ohShitScenario,
  sandboxScenario,
].sort((a, b) => a.order - b.order);

export function getScenarioById(id: string): Scenario | undefined {
  return scenarios.find(s => s.id === id);
}
