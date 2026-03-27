import { GitEngine } from './GitEngine';
import type { CommandResult } from './types';

interface ParsedCommand {
  program: string;
  subcommand: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

function parseCommandString(input: string): ParsedCommand {
  const tokens = tokenize(input.trim());

  return {
    program: tokens[0] || '',
    subcommand: tokens[1] || '',
    args: tokens.slice(2).filter(t => !t.startsWith('-')),
    flags: parseFlags(tokens.slice(2)),
  };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = char;
    } else if (char === ' ') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}

function parseFlags(tokens: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      flags[key] = true;
    } else if (token.startsWith('-') && token.length === 2) {
      const key = token.slice(1);
      // Check if next token is a value
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        flags[key] = tokens[i + 1];
        i++;
      } else {
        flags[key] = true;
      }
    }
  }

  return flags;
}

// Extract -m "message" from raw input for commit
function extractMessage(input: string): string | null {
  // Match -m "message" or -m 'message' or -m message
  const match = input.match(/-m\s+(?:"([^"]+)"|'([^']+)'|(\S+))/);
  if (match) return match[1] || match[2] || match[3];
  return null;
}

export function executeCommand(engine: GitEngine, input: string): CommandResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { success: true, output: '', state: engine.getState(), transitions: [] };
  }

  const parsed = parseCommandString(trimmed);

  // Handle non-git commands
  if (parsed.program !== 'git') {
    // Some common shell commands for realism
    if (parsed.program === 'ls') {
      const state = engine.getState();
      const files = Array.from(state.workingDirectory.keys()).sort();
      return { success: true, output: files.join('  ') || '', state, transitions: [] };
    }

    if (parsed.program === 'cat') {
      const state = engine.getState();
      const filePath = parsed.subcommand;
      const file = state.workingDirectory.get(filePath);
      if (file) {
        return { success: true, output: file.content, state, transitions: [] };
      }
      return { success: false, output: `cat: ${filePath}: No such file or directory`, state, transitions: [] };
    }

    if (parsed.program === 'touch' || parsed.program === 'echo') {
      // touch creates empty file, echo with > creates file with content
      if (parsed.program === 'touch') {
        return engine.createFile(parsed.subcommand, '');
      }
      // Handle echo "content" > file
      const redirectMatch = trimmed.match(/echo\s+(?:"([^"]+)"|'([^']+)'|(.+?))\s*>\s*(\S+)/);
      if (redirectMatch) {
        const content = redirectMatch[1] || redirectMatch[2] || redirectMatch[3];
        const filePath = redirectMatch[4];
        return engine.createFile(filePath, content);
      }
      // echo with >> (append)
      const appendMatch = trimmed.match(/echo\s+(?:"([^"]+)"|'([^']+)'|(.+?))\s*>>\s*(\S+)/);
      if (appendMatch) {
        const content = appendMatch[1] || appendMatch[2] || appendMatch[3];
        const filePath = appendMatch[4];
        const state = engine.getState();
        const existing = state.workingDirectory.get(filePath);
        const newContent = existing ? existing.content + '\n' + content : content;
        if (existing) {
          return engine.editFile(filePath, newContent);
        }
        return engine.createFile(filePath, newContent);
      }
      return { success: true, output: parsed.args.join(' '), state: engine.getState(), transitions: [] };
    }

    if (parsed.program === 'mkdir') {
      // Silently succeed - we don't really model directories
      return { success: true, output: '', state: engine.getState(), transitions: [] };
    }

    if (parsed.program === 'pwd') {
      return { success: true, output: '/home/user/project', state: engine.getState(), transitions: [] };
    }

    if (parsed.program === 'clear') {
      return { success: true, output: '__CLEAR__', state: engine.getState(), transitions: [] };
    }

    if (parsed.program === 'help') {
      return {
        success: true,
        output: `Available commands:
  git init          Initialize a new repository
  git status        Show the working tree status
  git add <file>    Add file to staging area
  git commit -m     Record changes to the repository
  git log           Show commit logs
  git branch        List, create, or delete branches
  git checkout      Switch branches
  git merge         Join two branches together
  git diff          Show changes
  git push          Update remote refs
  git pull          Fetch from remote and merge
  git fetch         Download from remote
  git reset         Reset current HEAD
  git revert        Revert a commit
  git stash         Stash working directory changes
  git reflog        Show reference logs
  git remote add    Add a remote
  git rm            Remove files

Shell commands: ls, cat, touch, echo, mkdir, pwd, clear, help`,
        state: engine.getState(),
        transitions: [],
      };
    }

    return {
      success: false,
      output: `command not found: ${parsed.program}`,
      state: engine.getState(),
      transitions: [],
    };
  }

  // Git commands
  switch (parsed.subcommand) {
    case 'init':
      return engine.init();

    case 'status':
      return engine.status();

    case 'add':
      if (parsed.args.length === 0 && !parsed.flags['A'] && !parsed.flags['all']) {
        return { success: false, output: 'Nothing specified, nothing added.', state: engine.getState(), transitions: [] };
      }
      const addPaths = parsed.args.length > 0 ? parsed.args : [];
      if (parsed.flags['A'] || parsed.flags['all']) addPaths.push('-A');
      return engine.add(addPaths);

    case 'commit': {
      const message = extractMessage(trimmed);
      if (!message) {
        return { success: false, output: 'error: switch `m\' requires a value', state: engine.getState(), transitions: [] };
      }
      return engine.commit(message);
    }

    case 'log': {
      const oneline = !!parsed.flags['oneline'];
      const all = !!parsed.flags['all'];
      return engine.log({ oneline, all });
    }

    case 'branch': {
      const deleteFlag = !!parsed.flags['d'] || !!parsed.flags['D'] || !!parsed.flags['delete'];
      if (deleteFlag && parsed.args.length > 0) {
        return engine.branch(parsed.args[0], { delete: true });
      }
      if (parsed.args.length > 0) {
        return engine.branch(parsed.args[0]);
      }
      return engine.branch();
    }

    case 'checkout': {
      const createBranch = !!parsed.flags['b'];
      if (createBranch && parsed.args.length > 0) {
        return engine.checkout(parsed.args[0], { createBranch: true });
      }
      // Handle: git checkout -b <name> where -b consumes the flag value
      if (parsed.flags['b'] && typeof parsed.flags['b'] === 'string') {
        return engine.checkout(parsed.flags['b'] as string, { createBranch: true });
      }
      if (parsed.args.length > 0) {
        return engine.checkout(parsed.args[0]);
      }
      return { success: false, output: 'error: you must specify a branch or commit', state: engine.getState(), transitions: [] };
    }

    case 'switch': {
      // git switch is an alias for checkout in our simplified model
      const createFlag = !!parsed.flags['c'] || !!parsed.flags['create'];
      if (createFlag && parsed.args.length > 0) {
        return engine.checkout(parsed.args[0], { createBranch: true });
      }
      if (typeof parsed.flags['c'] === 'string') {
        return engine.checkout(parsed.flags['c'] as string, { createBranch: true });
      }
      if (parsed.args.length > 0) {
        return engine.checkout(parsed.args[0]);
      }
      return { success: false, output: 'error: you must specify a branch', state: engine.getState(), transitions: [] };
    }

    case 'merge':
      if (parsed.args.length === 0) {
        return { success: false, output: 'error: specify a branch to merge', state: engine.getState(), transitions: [] };
      }
      return engine.merge(parsed.args[0]);

    case 'diff':
      if (parsed.flags['staged'] || parsed.flags['cached']) {
        return engine.diff('--staged');
      }
      return engine.diff(parsed.args[0]);

    case 'push':
      return engine.push(parsed.args[0], parsed.args[1]);

    case 'pull':
      return engine.pull(parsed.args[0], parsed.args[1]);

    case 'fetch':
      return engine.fetch(parsed.args[0]);

    case 'reset': {
      // Handle: git reset HEAD <file>
      const allTokens = tokenize(trimmed);
      // git reset HEAD filename
      if (allTokens.length >= 4 && allTokens[2] === 'HEAD') {
        return engine.reset(allTokens[3], 'HEAD');
      }
      // git reset --soft HEAD~1, git reset --hard, etc.
      const mode = parsed.flags['soft'] ? '--soft' : parsed.flags['hard'] ? '--hard' : parsed.flags['mixed'] ? '--mixed' : undefined;
      const target = parsed.args[0];
      return engine.reset(target || mode, mode || target);
    }

    case 'revert':
      if (parsed.args.length === 0) {
        return { success: false, output: 'error: specify a commit to revert', state: engine.getState(), transitions: [] };
      }
      return engine.revert(parsed.args[0]);

    case 'stash':
      return engine.stash(parsed.args[0]);

    case 'reflog':
      return engine.reflog();

    case 'remote':
      if (parsed.args[0] === 'add' && parsed.args.length >= 3) {
        return engine.remoteAdd(parsed.args[1], parsed.args[2]);
      }
      if (parsed.args[0] === 'add') {
        return { success: false, output: 'usage: git remote add <name> <url>', state: engine.getState(), transitions: [] };
      }
      // git remote -v
      if (parsed.flags['v'] || parsed.flags['verbose']) {
        const state = engine.getState();
        const lines: string[] = [];
        for (const [name, remote] of state.remotes) {
          lines.push(`${name}\t${remote.url} (fetch)`);
          lines.push(`${name}\t${remote.url} (push)`);
        }
        return { success: true, output: lines.join('\n'), state, transitions: [] };
      }
      // Just list remote names
      const state = engine.getState();
      const names = Array.from(state.remotes.keys());
      return { success: true, output: names.join('\n'), state, transitions: [] };

    case 'rm':
      if (parsed.args.length === 0) {
        return { success: false, output: 'usage: git rm <file>', state: engine.getState(), transitions: [] };
      }
      return engine.rm(parsed.args[0]);

    case 'config':
      // Handle basic config
      if (parsed.args.includes('user.name')) {
        const nameIdx = parsed.args.indexOf('user.name');
        if (nameIdx + 1 < parsed.args.length) {
          return { success: true, output: '', state: engine.getState(), transitions: [] };
        }
        return { success: true, output: engine.getState().config.userName, state: engine.getState(), transitions: [] };
      }
      return { success: true, output: '', state: engine.getState(), transitions: [] };

    default:
      return {
        success: false,
        output: `git: '${parsed.subcommand}' is not a git command. See 'help' for available commands.`,
        state: engine.getState(),
        transitions: [],
      };
  }
}
