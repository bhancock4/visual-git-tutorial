# Visual Git Tutorial

## Quick Reference

```bash
npm run dev       # Start dev server (Vite + HMR)
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint on all TS/TSX files
npm run preview   # Preview production build
```

No test framework is configured yet. Verify changes with `npx tsc --noEmit` and manual testing in browser.

## Project Vision & Intent

**What this is:** An interactive web app that teaches git through a simulated terminal and real-time visual diagrams. Users type real git commands into a browser-based terminal and watch artifacts flow between Working Directory, Staging/Index, Local Repo, and Remote Repo in animated visualizations.

**Who it's for:** Originally built for Ben's kids (target: 13-year-old comprehension) and enterprise developers new to git. Designed to be potentially deployable as a public learning tool.

**Design philosophy:** Professional and clean, never childish. Dark terminal with Courier-style font, light UI for everything else. Minimal visual noise — collapse by default, let users expand for detail. The terminal emulation is a core strength; it should feel authentic. Language should be clear but not condescending.

**Why it exists:** Git's mental model is hard to build from docs alone. Seeing artifacts physically move between zones (working dir → staging → local → remote) makes the invisible visible. The scenario-based approach lets learners build confidence incrementally before going freeform.

## Architecture

```
src/
├── engine/          # Git simulation (no real git, all in-browser)
│   ├── GitEngine.ts # Core simulator — branches, commits, merges, remotes, stash, reflog
│   ├── commands.ts  # Command parser + dispatcher (git commands + shell: ls, cat, echo, touch, mkdir)
│   ├── types.ts     # RepoState, CommitObject, StateTransition, etc.
│   └── hash.ts      # DJB2 hash generation for commit hashes
├── state/
│   └── AppContext.tsx  # React Context — single AppState, runCommand/undo/reset
├── scenarios/       # Tutorial content — each file is a self-contained lesson
│   ├── 01-init-repo.ts through 08-oh-shit.ts
│   ├── registry.ts  # Scenario index
│   └── types.ts     # Scenario/TutorialStep type definitions
├── components/
│   ├── Terminal/           # Command input, output display, history navigation
│   ├── Visualizations/    # Transport diagram (4-zone flow) + commit DAG graph
│   ├── Tutorial/          # Step-by-step guided overlay with progress tracking
│   ├── HelpSidebar/       # Contextual help, "why" explanations, doc links
│   ├── Achievements/      # Milestone toast notifications
│   └── FileViewer/        # Modal for inspecting file contents from the diagram
├── App.tsx          # Main orchestrator — scenario management, tutorial state, undo tracking
└── App.css          # Layout (reversible left/right panels)
```

### Data Flow

```
User types in Terminal → executeCommand() parses & dispatches → GitEngine method runs
→ Returns CommandResult { state, transitions, output } → AppContext updates
→ All components re-render: visualizations animate, tutorial validates, help updates
```

### Key Design Decisions

- **Engine is pure logic:** GitEngine has no React dependencies. It takes commands, returns new state. This makes it testable and portable.
- **Transitions drive animations:** Each command returns `StateTransition[]` describing what moved where (e.g., `{ type: 'add', from: 'working', to: 'staging', files: [...] }`). The visualization layer consumes these to animate.
- **Scenarios are self-contained:** Each scenario defines its setup function, tutorial steps with validation functions, help content, and milestones. Adding a scenario means adding one file and registering it.
- **Undo is state-level, not git-level:** The UI undo button restores the previous engine state snapshot (up to 50 deep), rolls back the tutorial step, and removes the command from the terminal. This is intentional — it's a learning tool, not a git undo simulator.
- **Tutorial guide re-enables on scenario change:** When a user switches scenarios, the guide checkbox turns back on so they see the objective before dismissing hints.
- **Shell emulation is real-ish:** `ls`, `cat`, `echo >`, `touch`, `mkdir`, `pwd` all work against the virtual filesystem. This was a deliberate investment — it makes the experience feel authentic and lets scenarios use file creation as setup steps.

### Scenario Structure

Each scenario provides:
- `setup(engine)` — pre-populates repo state (files, commits, branches) for the lesson
- `tutorialSteps[]` — ordered steps, each with:
  - `validation(repoState, lastCommand)` — function to check completion
  - `expectedCommand` — hint for what to type
  - `helpContent` — explanation, "why it matters", related commands
  - `milestone?` — optional achievement toast
  - `isBashOnly` + `autoCommand` — for non-git steps that can be auto-skipped

### Current Scenarios (in order)

1. **Init & First Commit** — `git init`, `add`, `commit`, `status`, `log`
2. **Branching** — `git branch`, `checkout -b`, branch as "save slots"
3. **Merging** — fast-forward and merge commits
4. **Remotes** — `remote add`, `push`, `pull`, `fetch`
5. **Merge Conflicts** — conflict detection, markers, resolution
6. **Gitignore** — protecting secrets, pattern matching
7. **Stash** — saving incomplete work, `stash pop`
8. **Oh Shit Moments** — `reset --soft/--hard`, `revert`, `reflog`

## Conventions

- **React 19** with hooks only (no class components)
- **TypeScript strict mode** — `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- **State management:** React Context via `useApp()` hook. No Redux/Zustand.
- **Animation:** Motion library (Framer Motion successor) for transport diagram, CSS transitions elsewhere
- **CSS:** Component-scoped `.css` files with BEM-ish naming. No CSS-in-JS, no Tailwind.
- **No test framework yet** — verify with type-checking and manual browser testing
- **Layout:** Flexbox-based, user-toggleable left/right panel swap (default: steps left, console right)

## Feature Rationale (from initial design sessions)

These capture *why* features exist, so future work preserves the intent:

- **Dual visualization (transport + DAG):** Transport diagram teaches the "where do files go" mental model. DAG teaches "how do commits relate." Both are needed — they answer different questions.
- **Toggle-able guide:** Power users and repeat visitors shouldn't be forced through tutorials. But new scenario = re-enable guide so they see the objective.
- **UI undo (not git undo):** Learners make typos and wrong turns. A forgiving undo that just rolls everything back (state + tutorial step + terminal output) keeps them in flow instead of stuck.
- **Auto-skip bash steps:** Some tutorial steps are just `touch file.txt` setup. The "Auto Shell" toggle lets users skip these to focus on git concepts.
- **Milestone toasts:** Subtle positive reinforcement. Not gamified — just a brief "nice, you did a thing" moment.
- **File viewer modal:** Clicking a file in the diagram shows its content. Makes the virtual filesystem tangible.
- **Contextual help sidebar:** Each tutorial step has a "why this matters" explanation and related commands. Collapsible to reduce noise.
- **Scenario narrative banner:** Each scenario has a story ("You just started a new project...") to give context for *why* you'd use these commands.

## Adding a New Scenario

1. Create `src/scenarios/NN-name.ts`
2. Export a `Scenario` object with `id`, `title`, `narrative`, `order`, `tags`, `docLinks`
3. Implement `setup(engine)` to pre-populate the repo
4. Define `tutorialSteps[]` with validation functions
5. Register in `src/scenarios/registry.ts`

## Things to Watch Out For

- `GitEngine.getState()` returns a deep clone. `loadState()` restores from a clone. This is how undo works — don't break the cloning.
- The tutorial validation effect in `App.tsx` must fire *after* the undo-tracking effect (defined earlier in the file). Effect ordering matters.
- `commandHistory` in AppContext and `commandHistory` in Terminal are separate arrays. AppContext tracks for undo; Terminal tracks for arrow-key history. Both get trimmed on undo.
- Hash generation uses a counter for uniqueness. `resetCounter()` exists for test isolation.
