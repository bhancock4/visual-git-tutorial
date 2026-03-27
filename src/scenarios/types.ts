import type { GitEngine } from '../engine/GitEngine';
import type { RepoState } from '../engine/types';

export interface HelpContent {
  explanation: string;
  why: string;
  docsUrl?: string;
  relatedCommands?: string[];
}

export interface MilestoneDef {
  id: string;
  title: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  narrative: string;
  expectedCommand?: string | RegExp;
  hint?: string;
  /** If true, this step is a shell command (not git). Can be auto-skipped. */
  isBashOnly?: boolean;
  /** Command to auto-execute when bash auto-skip is enabled */
  autoCommand?: string;
  validation: (state: RepoState, lastCommand: string) => boolean;
  helpContent: HelpContent;
  milestone?: MilestoneDef;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  narrative: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  order: number;
  tags: string[];
  setup: (engine: GitEngine) => void;
  tutorialSteps: TutorialStep[];
  docLinks: Array<{ label: string; url: string }>;
}
