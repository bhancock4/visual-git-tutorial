import { useState, useCallback, useEffect, useRef } from 'react';
import type { Scenario, HelpContent, MilestoneDef } from '../scenarios/types';
import type { RepoState } from '../engine/types';

interface TutorialInput {
  /** Current repo state from AppContext */
  repoState: RepoState;
  /** Last command run */
  lastCommand: string;
  /** Length of command history (used to detect undo) */
  commandHistoryLength: number;
  /** Run a command through the engine */
  runCommand: (cmd: string) => void;
}

interface TutorialState {
  tutorialEnabled: boolean;
  setTutorialEnabled: (enabled: boolean) => void;
  autoSkipBash: boolean;
  setAutoSkipBash: (enabled: boolean) => void;
  tutorialStep: number;
  helpContent: HelpContent | null;
  activeMilestone: MilestoneDef | null;
  dismissMilestone: () => void;
  completedMilestones: Set<string>;
  lastMilestone: MilestoneDef | null;
  justAdvanced: boolean;
  isComplete: boolean;
  currentStepData: Scenario['tutorialSteps'][number] | null;
  /** Increment to reset the terminal */
  terminalResetKey: number;
  /** Call when user picks a new scenario */
  changeScenario: () => void;
  /** Call to reset current scenario */
  resetScenario: () => void;
}

export function useTutorial(
  currentScenario: Scenario,
  input: TutorialInput,
): TutorialState {
  const { repoState, lastCommand, commandHistoryLength, runCommand } = input;

  const [tutorialEnabled, setTutorialEnabled] = useState(true);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [helpContent, setHelpContent] = useState<HelpContent | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<MilestoneDef | null>(null);
  const [milestoneQueue, setMilestoneQueue] = useState<MilestoneDef[]>([]);
  const [completedMilestones, setCompletedMilestones] = useState<Set<string>>(new Set());
  const [autoSkipBash, setAutoSkipBash] = useState(false);
  const [justAdvanced, setJustAdvanced] = useState(false);
  const [terminalResetKey, setTerminalResetKey] = useState(0);

  const prevCommandRef = useRef('');
  const stepBeforeCommand = useRef<number[]>([]);
  const prevHistoryLength = useRef(0);

  // Track tutorial step for undo — must be defined BEFORE the validation effect
  // so it captures the pre-advance step value when a new command arrives
  useEffect(() => {
    const len = commandHistoryLength;
    if (len > prevHistoryLength.current) {
      // New command — save current tutorial step before validation might advance it
      stepBeforeCommand.current.push(tutorialStep);
    } else if (len < prevHistoryLength.current) {
      // Undo — restore the tutorial step from before that command
      const prevStep = stepBeforeCommand.current.pop();
      if (prevStep !== undefined) {
        setTutorialStep(prevStep);
        const steps = currentScenario.tutorialSteps;
        if (prevStep < steps.length) {
          setHelpContent(steps[prevStep].helpContent);
        }
      }
    }
    prevHistoryLength.current = len;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandHistoryLength]);

  // Validate tutorial progress after each command
  useEffect(() => {
    if (!tutorialEnabled) return;
    if (lastCommand === prevCommandRef.current) return;
    prevCommandRef.current = lastCommand;

    if (!lastCommand) return;

    const steps = currentScenario.tutorialSteps;
    if (tutorialStep >= steps.length) return;

    const currentStepDef = steps[tutorialStep];

    // Update help content
    setHelpContent(currentStepDef.helpContent);

    // Check validation
    if (currentStepDef.validation(repoState, lastCommand)) {
      // Step completed!
      if (currentStepDef.milestone && !completedMilestones.has(currentStepDef.milestone.id)) {
        setMilestoneQueue(prev => [...prev, currentStepDef.milestone!]);
        setCompletedMilestones(prev => new Set(prev).add(currentStepDef.milestone!.id));
      }

      const nextStep = tutorialStep + 1;
      setTutorialStep(nextStep);
      setJustAdvanced(true);
      setTimeout(() => setJustAdvanced(false), 1000);

      if (nextStep < steps.length) {
        setHelpContent(steps[nextStep].helpContent);
      }
    }
  }, [lastCommand, repoState, tutorialStep, currentScenario, tutorialEnabled, completedMilestones]);

  // Auto-skip bash-only steps when toggle is on
  useEffect(() => {
    if (!autoSkipBash || !tutorialEnabled) return;

    const steps = currentScenario.tutorialSteps;
    if (tutorialStep >= steps.length) return;

    const currentStepDef = steps[tutorialStep];
    if (currentStepDef.isBashOnly && currentStepDef.autoCommand) {
      const timer = setTimeout(() => {
        runCommand(currentStepDef.autoCommand!);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [tutorialStep, autoSkipBash, tutorialEnabled, currentScenario, runCommand]);

  // Process milestone queue
  useEffect(() => {
    if (milestoneQueue.length > 0 && !activeMilestone) {
      setActiveMilestone(milestoneQueue[0]);
      setMilestoneQueue(prev => prev.slice(1));
    }
  }, [milestoneQueue, activeMilestone]);

  const resetState = useCallback(() => {
    setTutorialStep(0);
    setHelpContent(null);
    setJustAdvanced(false);
    setTerminalResetKey(k => k + 1);
    stepBeforeCommand.current = [];
    prevHistoryLength.current = 0;
  }, []);

  const changeScenario = useCallback(() => {
    setTutorialEnabled(true);
    setCompletedMilestones(new Set());
    resetState();
  }, [resetState]);

  const resetScenario = useCallback(() => {
    resetState();
  }, [resetState]);

  const isComplete = tutorialStep >= currentScenario.tutorialSteps.length;
  const currentStepData = !isComplete ? currentScenario.tutorialSteps[tutorialStep] : null;
  const lastMilestone = completedMilestones.size > 0
    ? currentScenario.tutorialSteps
        .filter(s => s.milestone && completedMilestones.has(s.milestone.id))
        .pop()?.milestone || null
    : null;

  return {
    tutorialEnabled,
    setTutorialEnabled,
    autoSkipBash,
    setAutoSkipBash,
    tutorialStep,
    helpContent,
    activeMilestone,
    dismissMilestone: () => setActiveMilestone(null),
    completedMilestones,
    lastMilestone,
    justAdvanced,
    isComplete,
    currentStepData,
    terminalResetKey,
    changeScenario,
    resetScenario,
  };
}
