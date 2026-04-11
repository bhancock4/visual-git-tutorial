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
