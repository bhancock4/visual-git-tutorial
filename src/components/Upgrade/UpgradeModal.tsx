import './UpgradeModal.css';

const INDIVIDUAL_CHECKOUT = import.meta.env.VITE_CHECKOUT_INDIVIDUAL_URL || '#';

interface UpgradeModalProps {
  /** Title of the scenario the learner tried to open. */
  scenarioTitle: string;
  onClose: () => void;
}

/**
 * Shown when a free learner tries to open a locked (paid) scenario. Explains the
 * $19 unlock honestly and points at checkout. Purchase delivery is handled by
 * Gumroad off-site; the in-app unlock happens via the `?unlock=<token>` URL the
 * buyer is sent to afterward (see src/state/access.ts).
 */
export function UpgradeModal({ scenarioTitle, onClose }: UpgradeModalProps) {
  const checkoutReady = INDIVIDUAL_CHECKOUT !== '#';

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
          <li>Freeform sandbox to practice it all</li>
          <li>PDF quick-reference checklist</li>
        </ul>

        <div className="upgrade-actions">
          <a
            className="upgrade-btn upgrade-btn-primary"
            href={INDIVIDUAL_CHECKOUT}
            {...(!checkoutReady ? { 'aria-disabled': true } : {})}
          >
            Unlock everything — $19
          </a>
          <button className="upgrade-btn upgrade-btn-ghost" onClick={onClose}>
            Keep exploring free scenarios
          </button>
        </div>

        <p className="upgrade-fineprint">
          One-time purchase. The free path (through Remotes) stays free forever.
          {!checkoutReady && ' Checkout is not wired up yet — nothing will be charged.'}
        </p>
      </div>
    </div>
  );
}
