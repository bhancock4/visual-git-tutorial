import { useState, useCallback, useEffect, useRef } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import { Terminal } from './components/Terminal/Terminal';
import { VisualizationPanel } from './components/Visualizations/VisualizationPanel';
import { TutorialOverlay } from './components/Tutorial/TutorialOverlay';
import { HelpSidebar } from './components/HelpSidebar/HelpSidebar';
import { MilestoneToast } from './components/Achievements/MilestoneToast';
import { FileViewerModal } from './components/FileViewer/FileViewerModal';
import { scenarios } from './scenarios/registry';
import type { Scenario, HelpContent, MilestoneDef } from './scenarios/types';
import type { GitEngine } from './engine/GitEngine';
import './App.css';

function AppContent() {
  const { state, runCommand, undo, canUndo, reset } = useApp();
  const [currentScenario, setCurrentScenario] = useState<Scenario>(scenarios[0]);
  const [tutorialEnabled, setTutorialEnabled] = useState(true);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [helpContent, setHelpContent] = useState<HelpContent | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<MilestoneDef | null>(null);
  const [milestoneQueue, setMilestoneQueue] = useState<MilestoneDef[]>([]);
  const [completedMilestones, setCompletedMilestones] = useState<Set<string>>(new Set());
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null);
  const [layoutReversed, setLayoutReversed] = useState(true);
  const [autoSkipBash, setAutoSkipBash] = useState(false);
  const [justAdvanced, setJustAdvanced] = useState(false);
  const [terminalResetKey, setTerminalResetKey] = useState(0);
  const prevCommandRef = useRef('');
  const stepBeforeCommand = useRef<number[]>([]);
  const prevHistoryLength = useRef(0);

  // Handle scenario change
  const handleScenarioChange = useCallback((scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    setCurrentScenario(scenario);
    setTutorialEnabled(true);
    setTutorialStep(0);
    setHelpContent(null);
    setCompletedMilestones(new Set());
    setJustAdvanced(false);
    setTerminalResetKey(k => k + 1);
    stepBeforeCommand.current = [];
    prevHistoryLength.current = 0;
    reset((engine: GitEngine) => scenario.setup(engine));
  }, [reset]);

  // Initialize first scenario
  useEffect(() => {
    reset((engine: GitEngine) => currentScenario.setup(engine));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track tutorial step for undo — must be defined BEFORE the validation effect
  // so it captures the pre-advance step value when a new command arrives
  useEffect(() => {
    const len = state.commandHistory.length;
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
  }, [state.commandHistory.length]);

  // Validate tutorial progress after each command
  useEffect(() => {
    if (!tutorialEnabled) return;
    if (state.lastCommand === prevCommandRef.current) return;
    prevCommandRef.current = state.lastCommand;

    if (!state.lastCommand) return;

    const steps = currentScenario.tutorialSteps;
    if (tutorialStep >= steps.length) return;

    const currentStepDef = steps[tutorialStep];

    // Update help content
    setHelpContent(currentStepDef.helpContent);

    // Check validation
    if (currentStepDef.validation(state.repoState, state.lastCommand)) {
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
  }, [state.lastCommand, state.repoState, tutorialStep, currentScenario, tutorialEnabled, completedMilestones]);

  // Auto-skip bash-only steps when toggle is on
  useEffect(() => {
    if (!autoSkipBash || !tutorialEnabled) return;

    const steps = currentScenario.tutorialSteps;
    if (tutorialStep >= steps.length) return;

    const currentStepDef = steps[tutorialStep];
    if (currentStepDef.isBashOnly && currentStepDef.autoCommand) {
      // Small delay so the UI shows what's happening
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

  const handleReset = useCallback(() => {
    setTutorialStep(0);
    setHelpContent(null);
    setJustAdvanced(false);
    setTerminalResetKey(k => k + 1);
    stepBeforeCommand.current = [];
    prevHistoryLength.current = 0;
    reset((engine: GitEngine) => currentScenario.setup(engine));
  }, [currentScenario, reset]);

  const isComplete = tutorialStep >= currentScenario.tutorialSteps.length;
  const currentStepData = !isComplete ? currentScenario.tutorialSteps[tutorialStep] : null;
  const lastMilestone = completedMilestones.size > 0
    ? currentScenario.tutorialSteps
        .filter(s => s.milestone && completedMilestones.has(s.milestone.id))
        .pop()?.milestone || null
    : null;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">
            <span className="title-git">git</span>
            <span className="title-viz">visual</span>
          </h1>
        </div>

        <div className="header-center">
          <select
            className="scenario-select"
            value={currentScenario.id}
            onChange={e => handleScenarioChange(e.target.value)}
          >
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="header-right">
          <label className="header-toggle" title="Auto-run shell commands (file creation, etc.)">
            <input
              type="checkbox"
              checked={autoSkipBash}
              onChange={e => setAutoSkipBash(e.target.checked)}
            />
            <span>Auto Shell</span>
          </label>
          <label className="header-toggle">
            <input
              type="checkbox"
              checked={tutorialEnabled}
              onChange={e => setTutorialEnabled(e.target.checked)}
            />
            <span>Guide</span>
          </label>
          <button
            className="header-btn header-btn-layout"
            onClick={() => setLayoutReversed(r => !r)}
            title="Swap sides"
          >
            &#8644;
          </button>
          <button className="header-btn" onClick={undo} disabled={!canUndo} title="Undo last command">
            &#8630; Undo
          </button>
          <button className="header-btn header-btn-reset" onClick={handleReset} title="Reset scenario">
            &#8635; Reset
          </button>
        </div>
      </header>

      {/* Scenario narrative banner */}
      <div className="scenario-banner">
        <div className="scenario-banner-label">Scenario</div>
        <div className="scenario-banner-body">
          <span className="scenario-banner-title">{currentScenario.title}</span>
          <span className="scenario-banner-sep">&mdash;</span>
          <span className="scenario-banner-narrative">{currentScenario.narrative}</span>
        </div>
      </div>

      {/* Main content */}
      <div className={`app-body ${layoutReversed ? 'layout-reversed' : ''}`}>
        <div className="main-area">
          <div className="viz-panel">
            <VisualizationPanel onFileClick={(path, content) => setViewingFile({ path, content })} />
          </div>
          <div className="terminal-panel">
            <Terminal resetKey={terminalResetKey} />
          </div>
        </div>

        <div className="sidebar-area">
          {tutorialEnabled && (
            <TutorialOverlay
              step={currentStepData || currentScenario.tutorialSteps[currentScenario.tutorialSteps.length - 1]}
              stepIndex={tutorialStep}
              totalSteps={currentScenario.tutorialSteps.length}
              completed={isComplete}
              justAdvanced={justAdvanced}
            />
          )}
          <HelpSidebar
            helpContent={helpContent}
            docLinks={currentScenario.docLinks}
            milestone={lastMilestone ? { title: lastMilestone.title } : null}
          />
        </div>
      </div>

      {/* File viewer modal */}
      {viewingFile && (
        <FileViewerModal
          filePath={viewingFile.path}
          content={viewingFile.content}
          onClose={() => setViewingFile(null)}
        />
      )}

      {/* Milestone toast */}
      {activeMilestone && (
        <MilestoneToast
          title={activeMilestone.title}
          onDismiss={() => setActiveMilestone(null)}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
