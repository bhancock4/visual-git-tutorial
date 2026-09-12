import { scenarios } from '../../scenarios/registry';
import './Landing.css';

const TUTORIAL_HREF = '#/tutorial';

// Checkout links are intentionally not hardcoded. Wire real ones later via env.
const INDIVIDUAL_CHECKOUT = import.meta.env.VITE_CHECKOUT_INDIVIDUAL_URL || '#';
const TEAM_CHECKOUT = import.meta.env.VITE_CHECKOUT_TEAM_URL || '#';

const zones = [
  { key: 'working', label: 'Working Directory', blurb: 'Where the AI edits your files.' },
  { key: 'staging', label: 'Staging Area', blurb: 'What you choose to keep.' },
  { key: 'local', label: 'Local Repository', blurb: 'Your saved history.' },
  { key: 'remote', label: 'Remote Repository', blurb: 'The shared source of truth.' },
];

const audiences = [
  {
    title: 'AI co-builders',
    body: 'You are shipping software with a generative AI partner. Git is how you review, keep, and safely undo what the AI writes — the difference between "the AI broke everything" and "I rolled back in one command".',
  },
  {
    title: 'Business & non-technical builders',
    body: 'You are not a career engineer, but you are building real things now. Learn the handful of git ideas — clone, branch, commit, pull request — that let you collaborate with a codebase without fear.',
  },
  {
    title: 'Teams onboarding fast',
    body: 'Give new builders a shared mental model before they touch a real repo. Everyone sees the same picture of where changes live and how they flow.',
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
            Built for the new wave of builders — people shipping software with AI who need
            git literacy, not a computer-science degree.
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
            {scenarios.map(s => (
              <a className="lp-scenario" href={TUTORIAL_HREF} key={s.id}>
                <span className={`lp-scenario-diff lp-diff-${s.difficulty}`}>{s.difficulty}</span>
                <h3 className="lp-scenario-title">{s.title}</h3>
                <p className="lp-scenario-desc">{s.description}</p>
              </a>
            ))}
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
            and teams will land here as they come in.
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
          <h2 className="lp-h2">Pricing</h2>
          <p className="lp-lead">
            Start free. Upgrade when you want to keep going. Prices below are early
            placeholders while we finalize plans.
          </p>
          <div className="lp-grid lp-grid-3 lp-pricing">
            <div className="lp-price-card">
              <h3 className="lp-price-name">Free</h3>
              <p className="lp-price-amount">$0</p>
              <p className="lp-price-per">to try, forever</p>
              <ul className="lp-price-feats">
                <li>Full interactive tutorial</li>
                <li>All guided scenarios</li>
                <li>Sandbox mode</li>
              </ul>
              <a className="lp-btn lp-btn-ghost lp-price-cta" href={TUTORIAL_HREF}>
                Start learning
              </a>
            </div>

            <div className="lp-price-card lp-price-featured">
              <span className="lp-price-badge">Most popular</span>
              <h3 className="lp-price-name">Individual</h3>
              <p className="lp-price-amount">$19</p>
              <p className="lp-price-per">one-time · placeholder</p>
              <ul className="lp-price-feats">
                <li>Everything in Free</li>
                <li>AI co-builder workflow track</li>
                <li>Progress saving &amp; certificate</li>
                <li>Priority updates</li>
              </ul>
              <a
                className="lp-btn lp-btn-primary lp-price-cta"
                href={INDIVIDUAL_CHECKOUT}
                {...(INDIVIDUAL_CHECKOUT === '#' ? { 'aria-disabled': true } : {})}
              >
                Buy Individual
              </a>
            </div>

            <div className="lp-price-card">
              <h3 className="lp-price-name">Team Pack</h3>
              <p className="lp-price-amount">$149</p>
              <p className="lp-price-per">per team · placeholder</p>
              <ul className="lp-price-feats">
                <li>Everything in Individual</li>
                <li>Shared onboarding path</li>
                <li>Team progress dashboard</li>
                <li>Invoicing &amp; support</li>
              </ul>
              <a
                className="lp-btn lp-btn-primary lp-price-cta"
                href={TEAM_CHECKOUT}
                {...(TEAM_CHECKOUT === '#' ? { 'aria-disabled': true } : {})}
              >
                Buy Team Pack
              </a>
            </div>
          </div>
          <p className="lp-fineprint">
            Placeholder pricing — no checkout is wired up yet. Nothing will be charged.
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
