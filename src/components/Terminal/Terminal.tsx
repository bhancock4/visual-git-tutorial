import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../state/AppContext';
import './Terminal.css';

interface TerminalLine {
  type: 'input' | 'output' | 'error';
  content: string;
}

interface TerminalProps {
  resetKey?: number;
}

export function Terminal({ resetKey }: TerminalProps) {
  const { runCommand, state } = useApp();
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'output', content: 'Welcome to Git Tutorial! Type "help" for available commands.' },
  ]);
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevUndoCount = useRef(0);

  // Reset terminal when resetKey changes
  useEffect(() => {
    setLines([
      { type: 'output', content: 'Welcome to Git Tutorial! Type "help" for available commands.' },
    ]);
    setInput('');
    setCommandHistory([]);
    setHistoryIndex(-1);
  }, [resetKey]);

  // Remove last command + output from terminal on undo
  useEffect(() => {
    if (state.undoCount > prevUndoCount.current) {
      setLines(prev => {
        // Find the last input line
        let lastInputIdx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].type === 'input') {
            lastInputIdx = i;
            break;
          }
        }
        if (lastInputIdx === -1) return prev;
        // Remove from that input line to the end
        return prev.slice(0, lastInputIdx);
      });
      setCommandHistory(prev => prev.slice(0, -1));
      setHistoryIndex(-1);
    }
    prevUndoCount.current = state.undoCount;
  }, [state.undoCount]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const newLines: TerminalLine[] = [
      { type: 'input', content: `$ ${trimmed}` },
    ];

    const result = runCommand(trimmed);

    if (result.output === '__CLEAR__') {
      setLines([]);
      setInput('');
      setCommandHistory(prev => [...prev, trimmed]);
      setHistoryIndex(-1);
      return;
    }

    if (result.output) {
      newLines.push({
        type: result.success ? 'output' : 'error',
        content: result.output,
      });
    }

    setLines(prev => [...prev, ...newLines]);
    setCommandHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInput('');
  }, [input, runCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const newIndex = historyIndex === -1
        ? commandHistory.length - 1
        : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(commandHistory[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const commands = ['git init', 'git status', 'git add', 'git commit', 'git log',
        'git branch', 'git checkout', 'git merge', 'git diff', 'git push', 'git pull',
        'git fetch', 'git reset', 'git revert', 'git stash', 'git reflog', 'git remote',
        'git rm', 'git switch', 'git config'];
      const match = commands.find(c => c.startsWith(input));
      if (match) setInput(match);
    }
  }, [historyIndex, commandHistory, input]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="terminal" onClick={focusInput}>
      <div className="terminal-header">
        <div className="terminal-dots">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
        </div>
        <span className="terminal-title">Terminal</span>
      </div>
      <div className="terminal-body" ref={scrollRef}>
        {lines.map((line, i) => (
          <div key={i} className={`terminal-line ${line.type}`}>
            <pre>{line.content}</pre>
          </div>
        ))}
        <form onSubmit={handleSubmit} className="terminal-input-line">
          <span className="prompt">$&nbsp;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="terminal-input"
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
        </form>
      </div>
    </div>
  );
}
