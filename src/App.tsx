import { useState, useCallback, useEffect, useRef } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import { useTutorial } from './state/useTutorial';
import { Terminal } from './components/Terminal/Terminal';
import { VisualizationPanel } from './components/Visualizations/VisualizationPanel';
import { TutorialOverlay } from './components/Tutorial/TutorialOverlay';
import { HelpSidebar } from './components/HelpSidebar/HelpSidebar';
import { MilestoneToast } from './components/Achievements/MilestoneToast';
import { FileViewerModal } from './components/FileViewer/FileViewerModal';
import { WelcomeModal } from './components/WelcomeModal/WelcomeModal';
import { scenarios } from './scenarios/registry';
import type { Scenario } from './scenarios/types';
import type { GitEngine } from './engine/GitEngine';
import './App.css';

function AppContent() {
  const { state, runCommand, undo, canUndo, reset } = useApp();
  const [currentScenario, setCurrentScenario] = useState<Scenario>(scenarios[0]);
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null);
  const [layoutReversed, setLayoutReversed] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const tutorial = useTutorial(currentScenario, {
    repoState: state.repoState,
    lastCommand: state.lastCommand,
    commandHistoryLength: state.commandHistory.length,
    runCommand,
  });

  // Handle scenario change
  const handleScenarioChange = useCallback((scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    setCurrentScenario(scenario);
    tutorial.changeScenario();
    reset((engine: GitEngine) => scenario.setup(engine));
  }, [reset, tutorial.changeScenario]);

  // Initialize first scenario
  useEffect(() => {
    reset((engine: GitEngine) => currentScenario.setup(engine));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close settings dropdown on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [settingsOpen]);

  const handleReset = useCallback(() => {
    tutorial.resetScenario();
    reset((engine: GitEngine) => currentScenario.setup(engine));
  }, [currentScenario, reset, tutorial.resetScenario]);

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
          <button className="header-btn" onClick={undo} disabled={!canUndo} title="Undo last command">
            &#8630; Undo
          </button>
          <button className="header-btn header-btn-reset" onClick={handleReset} title="Reset scenario">
            &#8635; Reset
          </button>
          <div className="settings-menu-container" ref={settingsRef}>
            <button
              className="header-btn header-btn-settings"
              onClick={() => setSettingsOpen(o => !o)}
              title="Settings"
            >
              &#9881;
            </button>
            {settingsOpen && (
              <div className="settings-dropdown">
                <label className="settings-item">
                  <input
                    type="checkbox"
                    checked={tutorial.autoSkipBash}
                    onChange={e => tutorial.setAutoSkipBash(e.target.checked)}
                  />
                  <span>Auto Shell</span>
                </label>
                <label className="settings-item">
                  <input
                    type="checkbox"
                    checked={tutorial.tutorialEnabled}
                    onChange={e => tutorial.setTutorialEnabled(e.target.checked)}
                  />
                  <span>Guide</span>
                </label>
                <button
                  className="settings-item settings-item-btn"
                  onClick={() => { setLayoutReversed(r => !r); setSettingsOpen(false); }}
                >
                  &#8644; Swap Sides
                </button>
                <button
                  className="settings-item settings-item-btn"
                  onClick={() => { setShowWelcome(true); setSettingsOpen(false); }}
                >
                  ? About
                </button>
              </div>
            )}
          </div>
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
            <Terminal resetKey={tutorial.terminalResetKey} />
          </div>
        </div>

        <div className="sidebar-area">
          {tutorial.tutorialEnabled && currentScenario.tutorialSteps.length > 0 && (
            <TutorialOverlay
              step={tutorial.currentStepData || currentScenario.tutorialSteps[currentScenario.tutorialSteps.length - 1]}
              stepIndex={tutorial.tutorialStep}
              totalSteps={currentScenario.tutorialSteps.length}
              completed={tutorial.isComplete}
              justAdvanced={tutorial.justAdvanced}
              terminalSide={layoutReversed ? 'right' : 'left'}
            />
          )}
          <HelpSidebar
            helpContent={tutorial.helpContent}
            docLinks={currentScenario.docLinks}
            milestone={tutorial.lastMilestone ? { title: tutorial.lastMilestone.title } : null}
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
      {tutorial.activeMilestone && (
        <MilestoneToast
          title={tutorial.activeMilestone.title}
          onDismiss={tutorial.dismissMilestone}
        />
      )}

      {/* One-time welcome splash */}
      <WelcomeModal forceOpen={showWelcome} onClose={() => setShowWelcome(false)} />
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
