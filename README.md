# gitvisual

An interactive tutorial that teaches git through a simulated terminal and real-time visualizations. Type real commands, watch files flow between working directory, staging, local repo, and remote.

**[Try it live](https://bhancock4.github.io/visual-git-tutorial/)**

## What is this?

Git's mental model is hard to build from docs alone. gitvisual makes the invisible visible — you type git commands into a browser-based terminal and watch artifacts physically move between the four zones of git.

Built for developers new to git and anyone who wants to *see* what commands actually do.

## Features

- **Simulated terminal** with real-ish shell commands (`touch`, `echo`, `cat`, `ls`) and full git command support
- **Flow diagram** showing files moving between Working Directory, Staging Area, Local Repository, and Remote Repository
- **Commit graph** with proper topological layout, lane assignment, and branch visualization
- **10 guided scenarios** from "What is Git?" through branching, merging, conflicts, stash, and recovery
- **Sandbox mode** for freeform experimentation
- **Command preview** (Shift+Enter) to see what a command would do before running it
- **Undo** to rewind any mistake instantly

## Scenarios

0. What is Git?
1. Init & First Commit
2. Branching
3. Merging
4. Working with Remotes
5. Resolving Merge Conflicts
6. Gitignore
7. Stash
8. I Messed Up, Now What?
9. Sandbox

## Pricing & unlock (freemium)

The tutorial is freemium, gated purely on the client (no backend):

- **Free** — scenarios `order` 0–4 (*What is Git, Init & First Commit, Branching, Merging, Remotes*) **and** `order` 9 (*Sandbox*). The Sandbox is free for everyone.
- **Paid ($19)** — scenarios `order` 5–8: *Merge Conflicts, Gitignore, Stash, Oh Shit*, plus a PDF checklist.

Free users see paid scenarios in the picker marked `🔒 … (Paid)`; opening one shows an upgrade CTA instead of switching.

**Payments are paused.** The primary "Buy" CTAs on the landing page and upgrade modal are a waitlist / "Coming soon — $19" — there is no live checkout and nothing is charged. Set `VITE_WAITLIST_URL` to turn the button into a real "Join the waitlist" link; otherwise it renders as a disabled "Coming soon" button.

**How unlock works** (see `src/state/access.ts`): the unlock-token mechanism is kept intact for when payments resume. Unlock state is stored in `localStorage` and flips on when the URL contains an unlock token, e.g. `https://<host>/#/tutorial?unlock=<TOKEN>`. The token defaults to `ai-cobuilder` and can be overridden at build time with `VITE_UNLOCK_TOKEN`. When checkout returns, point the post-purchase redirect at that link — the token is consumed on load, unlock is persisted, and the token is stripped from the address bar. Use `?unlock=reset` to re-lock for demos/testing.

## Development

```bash
npm install
npm run dev       # Start dev server
npm run build     # TypeScript check + production build
npm run test      # Run tests (Vitest)
npm run lint      # ESLint
```

## Tech

React 19, TypeScript, Vite, Vitest (283 tests), Motion (animations). No backend — everything runs in the browser.

## License

MIT
