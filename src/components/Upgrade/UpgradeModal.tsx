import './UpgradeModal.css';

// Payments are paused: the primary CTA points at a waitlist, not a live checkout.
// When VITE_WAITLIST_URL is unset the button is just a disabled "Coming soon".
// The unlock-token mechanism (see src/state/access.ts) stays intact for later.
const WAITLIST_URL = import.meta.env.VITE_WAITLIST_URL || '#';

interface UpgradeModalProps {
  /** Title of the scenario the learner tried to open. */
  scenarioTitle: string;
  onClose: () => void;
}

/**
 * Shown when a free learner tries to open a locked (paid) scenario. Explains the
 * $19 unlock honestly. Payments are currently paused, so the CTA is a waitlist
 * ("Coming soon — $19") rather than a checkout. When checkout returns, buyers
 * will be sent to a `?unlock=<token>` URL to unlock in-app (see access.ts).
 */
export function UpgradeModal({ scenarioTitle, onClose }: UpgradeModalProps) {
  const waitlistReady = WAITLIST_URL !== '#';

  return (
    <div className="upgrade-backdrop" onClick={onClose}>
      <div
        className="upgrade-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="upgrade-lock" aria-hidden="true">🔒</div>
        <h2 className="upgrade-title" id="upgrade-title">
          Unlock the advanced scenarios
        </h2>
        <p className="upgrade-sub">
          <strong>{scenarioTitle}</strong> is part of the paid track — the git skills you reach
          for when an AI build gets messy.
        </p>

        <ul className="upgrade-feats">
          <li>Resolving merge conflicts</li>
          <li>.gitignore — keep secrets and junk out of history</li>
          <li>Stash — park half-finished work safely</li>
          <li>"Oh shit" recovery — reset, revert, reflog</li>
          <li>PDF quick-reference checklist</li>
        </ul>

        <div className="upgrade-actions">
          <a
            className="upgrade-btn upgrade-btn-primary"
            href={WAITLIST_URL}
            {...(!waitlistReady ? { 'aria-disabled': true } : {})}
          >
            {waitlistReady ? 'Join the waitlist — $19' : 'Coming soon — $19'}
          </a>
          <button className="upgrade-btn upgrade-btn-ghost" onClick={onClose}>
            Keep exploring free scenarios
          </button>
        </div>

        <p className="upgrade-fineprint">
          Payments are paused right now — nothing will be charged. The free path
          (through Remotes, plus the Sandbox) stays free forever.
        </p>
      </div>
    </div>
  );
}
