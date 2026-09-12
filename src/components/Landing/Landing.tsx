import { scenarios } from '../../scenarios/registry';
import { isPaidScenario } from '../../state/access';
import './Landing.css';

const TUTORIAL_HREF = '#/tutorial';

// Payments are paused: the primary CTA points at a waitlist, not a live checkout.
// When VITE_WAITLIST_URL is unset the button is a disabled "Coming soon". The
// unlock-token mechanism (see src/state/access.ts) stays intact for later.
const WAITLIST_URL = import.meta.env.VITE_WAITLIST_URL || '#';
const WAITLIST_READY = WAITLIST_URL !== '#';

const zones = [
  { key: 'working', label: 'Working Directory', blurb: 'Where the AI edits your files.' },
  { key: 'staging', label: 'Staging Area', blurb: 'What you choose to keep.' },
  { key: 'local', label: 'Local Repository', blurb: 'Your saved history.' },
  { key: 'remote', label: 'Remote Repository', blurb: 'The shared source of truth.' },
];

const audiences = [
  {
    title: 'Building with AI',
    body: 'You are using generative AI to write code, and you need just enough git to review, keep, and safely undo what it produces — the difference between "the AI broke everything" and "I rolled back in one command".',
  },
  {
    title: 'Hobbyists & weekend builders',
    body: 'Side projects, personal apps, that thing you keep tinkering with. Learn the handful of git ideas that let you save your work, experiment freely, and never lose progress.',
  },
  {
    title: 'Returning to programming',
    body: 'Coming back after time away? Git quietly became how everyone works. Rebuild the mental model fast — clone, branch, commit, pull request — so you feel at home in any repo again.',
  },
];

const faqs = [
  {
    q: 'Do I need to install anything?',
    a: 'No. Everything runs in your browser — a simulated terminal, a virtual filesystem, and a real git engine. You type actual git commands and watch what they do, with zero risk to any real project.',
  },
  {
    q: 'I am not a developer. Is this for me?',
    a: 'Yes. This is built for people using AI to build software without a traditional engineering background. We focus on the mental model — where changes live and how they move — not on memorizing flags.',
  },
  {
    q: 'How does this help me work with AI?',
    a: 'AI writes code fast, but you still decide what to keep, what to throw away, and how to recover when something breaks. Those are all git skills. This teaches the review-and-undo loop that keeps you in control.',
  },
  {
    q: 'Is the terminal real?',
    a: 'It is a faithful simulation. Common shell commands (ls, cat, echo, touch, mkdir) and the core git commands all work against an in-browser repository, so the experience feels authentic.',
  },
  {
    q: 'What happens when I finish?',
    a: 'You will understand cloning, branching, commits, remotes, merge conflicts, and how to recover from mistakes — enough to collaborate confidently on real projects with an AI co-builder.',
  },
];

export function Landing() {
  return (
    <div className="lp">
      {/* Nav */}
      <header className="lp-nav">
        <a className="lp-brand" href="#/" aria-label="Git for AI Co-Builders home">
          <span className="lp-brand-git">git</span>
          <span className="lp-brand-viz">visual</span>
          <span className="lp-brand-tag">for AI Co-Builders</span>
        </a>
        <nav className="lp-nav-links">
          <a href="#how">How it works</a>
          <a href="#inside">What's inside</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="lp-btn lp-btn-primary lp-nav-cta" href={TUTORIAL_HREF}>
          Launch tutorial
        </a>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">Git for AI Co-Builders</p>
          <h1 className="lp-hero-title">
            You brought the AI. <br />
            <span className="lp-accent">Git keeps you in control.</span>
          </h1>
          <p className="lp-hero-sub">
            Generative AI can write the code. Git is how you review it, keep the good parts,
            and undo the rest. Learn the essentials — hands-on, in your browser — without
            being a professional developer.
          </p>
          <div className="lp-hero-actions">
            <a className="lp-btn lp-btn-primary lp-btn-lg" href={TUTORIAL_HREF}>
              Start the visual tutorial
            </a>
            <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#how">
              See how it works
            </a>
          </div>
          <p className="lp-hero-note">Free to try · No signup · Nothing to install</p>
        </div>

        {/* Terminal mock keeps the authentic dark aesthetic */}
        <div className="lp-hero-visual" aria-hidden="true">
          <div className="lp-term">
            <div className="lp-term-bar">
              <span className="lp-term-dot" />
              <span className="lp-term-dot" />
              <span className="lp-term-dot" />
              <span className="lp-term-title">bash — your-project</span>
            </div>
            <div className="lp-term-body">
              <p><span className="lp-term-prompt">$</span> git status</p>
              <p className="lp-term-dim">Changes not staged for commit:</p>
              <p className="lp-term-red">  modified: app.py <span className="lp-term-dim">(AI edit)</span></p>
              <p><span className="lp-term-prompt">$</span> git add app.py</p>
              <p><span className="lp-term-prompt">$</span> git commit -m "Keep AI refactor"</p>
              <p className="lp-term-green">[main 4f1a9c2] Keep AI refactor</p>
              <p><span className="lp-term-prompt">$</span> <span className="lp-term-cursor">▋</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="lp-section lp-light" id="who">
        <div className="lp-container">
          <h2 className="lp-h2">Who it's for</h2>
          <p className="lp-lead">
            Made for individuals — hobbyists, people returning to programming, and anyone
            building with AI who needs real git literacy, not a computer-science degree.
          </p>
          <div className="lp-grid lp-grid-3">
            {audiences.map(a => (
              <div className="lp-card" key={a.title}>
                <h3 className="lp-card-title">{a.title}</h3>
                <p className="lp-card-body">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="lp-section" id="how">
        <div className="lp-container">
          <h2 className="lp-h2">See the flow</h2>
          <p className="lp-lead">
            Git's hardest part is invisible: where your changes actually live. We make it
            visible. Type a command, watch your files move between the four zones of git in
            real time.
          </p>

          <div className="lp-flow">
            {zones.map((z, i) => (
              <div className="lp-flow-item" key={z.key}>
                <div className={`lp-flow-zone lp-zone-${z.key}`}>
                  <span className="lp-flow-label">{z.label}</span>
                  <span className="lp-flow-blurb">{z.blurb}</span>
                </div>
                {i < zones.length - 1 && <span className="lp-flow-arrow" aria-hidden="true">→</span>}
              </div>
            ))}
          </div>

          <div className="lp-grid lp-grid-2 lp-how-detail">
            <div className="lp-card lp-card-dark">
              <h3 className="lp-card-title">The transport diagram</h3>
              <p className="lp-card-body">
                Answers "where did my changes go?" Every command animates files flowing
                between working directory, staging, your local repo, and the remote.
              </p>
            </div>
            <div className="lp-card lp-card-dark">
              <h3 className="lp-card-title">The commit graph</h3>
              <p className="lp-card-body">
                Answers "how do these commits relate?" Watch branches split and merge so
                the history stops feeling like a mystery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What's inside */}
      <section className="lp-section lp-light" id="inside">
        <div className="lp-container">
          <h2 className="lp-h2">What's inside</h2>
          <p className="lp-lead">
            A guided path of hands-on scenarios. Start with the mental model, build up to the
            skills you'll actually use with an AI co-builder.
          </p>
          <div className="lp-grid lp-grid-3 lp-scenarios">
            {scenarios.map(s => {
              const paid = isPaidScenario(s.order);
              return (
                <a className="lp-scenario" href={TUTORIAL_HREF} key={s.id}>
                  <span className="lp-scenario-tags">
                    <span className={`lp-scenario-diff lp-diff-${s.difficulty}`}>{s.difficulty}</span>
                    <span className={`lp-scenario-tier lp-tier-${paid ? 'paid' : 'free'}`}>
                      {paid ? 'Paid' : 'Free'}
                    </span>
                  </span>
                  <h3 className="lp-scenario-title">{s.title}</h3>
                  <p className="lp-scenario-desc">{s.description}</p>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* Social proof — honest placeholder, no fake logos or metrics */}
      <section className="lp-section" id="proof">
        <div className="lp-container lp-proof">
          <h2 className="lp-h2">Early days, honest about it</h2>
          <p className="lp-lead">
            This project is young. Rather than invent testimonials or logos, we'll let the
            product speak — try the tutorial and see for yourself. Real stories from learners
            will land here as they come in.
          </p>
          <div className="lp-proof-slots">
            <div className="lp-proof-slot">
              <p className="lp-proof-quote">"Your story could go here."</p>
              <p className="lp-proof-attr">— A future learner</p>
            </div>
            <div className="lp-proof-slot">
              <p className="lp-proof-quote">"Placeholder — we don't fake these."</p>
              <p className="lp-proof-attr">— The team</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="lp-section lp-light" id="pricing">
        <div className="lp-container">
          <h2 className="lp-h2">Simple pricing for individuals</h2>
          <p className="lp-lead">
            Learn the fundamentals free. Pay once to unlock the skills you need when an AI
            build gets messy. Built for one person learning at their own pace.
          </p>
          <div className="lp-grid lp-pricing lp-pricing-2">
            <div className="lp-price-card">
              <h3 className="lp-price-name">Free</h3>
              <p className="lp-price-amount">$0</p>
              <p className="lp-price-per">forever, no signup</p>
              <ul className="lp-price-feats">
                <li>The full browser tutorial — nothing to install</li>
                <li>Scenarios through Remotes: What is Git, Init &amp; First Commit, Branching, Merging, Remotes</li>
                <li>The freeform Sandbox to experiment with any command</li>
                <li>The transport diagram and commit graph visualizations</li>
              </ul>
              <a className="lp-btn lp-btn-ghost lp-price-cta" href={TUTORIAL_HREF}>
                Start the tutorial
              </a>
            </div>

            <div className="lp-price-card lp-price-featured">
              <span className="lp-price-badge">Best for individuals</span>
              <h3 className="lp-price-name">Individual</h3>
              <p className="lp-price-amount">$19</p>
              <p className="lp-price-per">one-time</p>
              <ul className="lp-price-feats">
                <li>Everything in Free</li>
                <li>Advanced scenarios — the git you need when AI builds go sideways:</li>
                <li className="lp-price-sub">Resolving merge conflicts</li>
                <li className="lp-price-sub">.gitignore — keep secrets &amp; junk out of history</li>
                <li className="lp-price-sub">Stash — park half-finished work safely</li>
                <li className="lp-price-sub">"Oh shit" recovery — reset, revert, reflog</li>
                <li>Printable PDF quick-reference checklist</li>
              </ul>
              <a
                className="lp-btn lp-btn-primary lp-price-cta"
                href={WAITLIST_URL}
                {...(!WAITLIST_READY ? { 'aria-disabled': true } : {})}
              >
                {WAITLIST_READY ? 'Join the waitlist — $19' : 'Coming soon — $19'}
              </a>
            </div>
          </div>
          <p className="lp-fineprint">
            Payments are paused right now — nothing will be charged.{' '}
            {WAITLIST_READY
              ? 'Join the waitlist and we\u2019ll let you know when the $19 unlock goes live.'
              : 'The $19 unlock is coming soon.'}{' '}
            The free path — through Remotes, plus the Sandbox — stays free forever.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section" id="faq">
        <div className="lp-container lp-faq-container">
          <h2 className="lp-h2">Frequently asked</h2>
          <div className="lp-faq">
            {faqs.map(f => (
              <details className="lp-faq-item" key={f.q}>
                <summary className="lp-faq-q">{f.q}</summary>
                <p className="lp-faq-a">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-cta-band">
        <div className="lp-container lp-cta-inner">
          <h2 className="lp-cta-title">Ready to stay in control of your AI builds?</h2>
          <a className="lp-btn lp-btn-primary lp-btn-lg" href={TUTORIAL_HREF}>
            Open the interactive tutorial
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div>
            <span className="lp-brand-git">git</span>
            <span className="lp-brand-viz">visual</span>
            <p className="lp-footer-note">Learn git by seeing it. Built for AI co-builders.</p>
          </div>
          <div className="lp-footer-links">
            <a href={TUTORIAL_HREF}>Launch tutorial</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
