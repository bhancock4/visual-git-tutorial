import { useState, useEffect, useCallback } from 'react';
import type { TutorialStep } from '../../scenarios/types';
import './TutorialOverlay.css';

interface TutorialOverlayProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  completed: boolean;
  justAdvanced: boolean;
  terminalSide: 'left' | 'right';
}

export function TutorialOverlay({ step, stepIndex, totalSteps, completed, justAdvanced, terminalSide }: TutorialOverlayProps) {
  const [flash, setFlash] = useState(false);

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }, []);

  // Flash animation on step advance
  useEffect(() => {
    if (justAdvanced) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 800);
      return () => clearTimeout(timer);
    }
  }, [justAdvanced, stepIndex]);

  if (completed) {
    return (
      <div className="tutorial-overlay tutorial-complete">
        <div className="tutorial-badge">&#10003;</div>
        <h3>Scenario Complete!</h3>
        <p>Great work. Try another scenario from the dropdown, or turn off the tutorial and experiment freely.</p>
      </div>
    );
  }

  return (
    <div className={`tutorial-overlay ${flash ? 'tutorial-flash' : ''}`}>
      {/* Step advance banner */}
      {flash && (
        <div className="step-advance-banner">
          &#10003; Step complete!
        </div>
      )}

      <div className="tutorial-progress">
        <div className="tutorial-progress-bar">
          <div
            className="tutorial-progress-fill"
            style={{ width: `${((stepIndex) / totalSteps) * 100}%` }}
          />
        </div>
        <span className="tutorial-progress-text">Step {stepIndex + 1} of {totalSteps}</span>
      </div>

      <div className="tutorial-step-header">
        <h3 className="tutorial-title">{step.title}</h3>
        {step.isBashOnly && (
          <span className="bash-badge">SHELL</span>
        )}
      </div>

      <p className="tutorial-narrative">{step.narrative}</p>

      {step.expectedCommand && (() => {
        const cmdText = typeof step.expectedCommand === 'string'
          ? step.expectedCommand
          : step.hint?.replace('Try: ', '').replace('Type: ', '') || '';
        return (
          <div className="tutorial-expected">
            <span className="tutorial-expected-label">Run in the terminal to the {terminalSide}:</span>
            <code>{cmdText}</code>
            {cmdText && (
              <button
                className={`copy-btn ${copied ? 'copied' : ''}`}
                onClick={() => handleCopy(cmdText)}
                title="Copy to clipboard"
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            )}
          </div>
        );
      })()}

    </div>
  );
}
