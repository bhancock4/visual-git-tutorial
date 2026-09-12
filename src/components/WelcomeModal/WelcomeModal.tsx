import { useState, useEffect } from 'react';
import './WelcomeModal.css';

const STORAGE_KEY = 'gitvisual-welcome-dismissed';

interface WelcomeModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function WelcomeModal({ forceOpen, onClose }: WelcomeModalProps = {}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setVisible(true);
    } else if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, [forceOpen]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    onClose?.();
  };

  return (
    <div className="welcome-backdrop" onClick={dismiss}>
      <div className="welcome-modal" onClick={e => e.stopPropagation()}>
        <div className="welcome-header">
          <h1 className="welcome-title">
            <span className="welcome-git">git</span>
            <span className="welcome-viz">visual</span>
          </h1>
          <p className="welcome-subtitle">An interactive tutorial that makes git click.</p>
        </div>

        <div className="welcome-body">
          <section className="welcome-section">
            <h2>What is this?</h2>
            <p>
              A hands-on way to learn <strong>git</strong> — the version control system used by
              most software teams to track changes, protect their work, and collaborate across
              distances. You'll type real commands into a simulated terminal and watch files move
              between the four zones of git: your <strong>Working Directory</strong>,
              the <strong>Staging Area</strong>, your <strong>Local Repository</strong>,
              and the <strong>Remote Repository</strong>.
            </p>
          </section>

          <section className="welcome-section">
            <h2>How it works</h2>
            <ul className="welcome-list">
              <li>
                <strong>Follow the guided scenarios</strong> in order. Each one teaches a concept,
                starting with "What is Git?" and building up to branches, merges, and recovery.
              </li>
              <li>
                <strong>Type commands</strong> in the terminal on the right. You'll use a mix of
                shell commands (<code>touch</code>, <code>echo</code>, <code>cat</code>) and
                git commands (<code>git add</code>, <code>git commit</code>, etc.).
              </li>
              <li>
                <strong>Watch the visualizations</strong> update in real time. The flow diagram
                shows where your files are. The commit graph shows your project's history.
              </li>
              <li>
                <strong>Undo freely.</strong> Made a mistake? Hit Undo. Want to see what a command
                would do first? Press <kbd>Shift+Enter</kbd> to preview it.
              </li>
            </ul>
          </section>

          <section className="welcome-section">
            <h2>By the end</h2>
            <p>
              You'll understand how git tracks your work, how branching and merging work, how
              to collaborate with remotes, and how to recover from mistakes. These are skills
              every developer uses daily.
            </p>
          </section>
        </div>

        <div className="welcome-footer">
          <button className="welcome-start" onClick={dismiss}>
            Let's get started
          </button>
        </div>
      </div>
    </div>
  );
}
