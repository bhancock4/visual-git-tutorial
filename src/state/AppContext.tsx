import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { GitEngine } from '../engine/GitEngine';
import { executeCommand } from '../engine/commands';
import type { RepoState, CommandResult, StateTransition } from '../engine/types';

interface AppState {
  repoState: RepoState;
  transitions: StateTransition[];
  lastCommand: string;
  lastOutput: string;
  lastSuccess: boolean;
  commandHistory: string[];
  undoCount: number;
}

interface AppContextType {
  state: AppState;
  runCommand: (input: string) => CommandResult;
  undo: () => void;
  canUndo: boolean;
  reset: (setupFn?: (engine: GitEngine) => void) => void;
  engine: GitEngine;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const engineRef = useRef(new GitEngine());
  const historyRef = useRef<RepoState[]>([]);
  const [state, setState] = useState<AppState>({
    repoState: engineRef.current.getState(),
    transitions: [],
    lastCommand: '',
    lastOutput: '',
    lastSuccess: true,
    commandHistory: [],
    undoCount: 0,
  });

  const runCommand = useCallback((input: string) => {
    // Save current state for undo before executing
    historyRef.current.push(engineRef.current.getState());
    // Cap history at 50
    if (historyRef.current.length > 50) historyRef.current.shift();

    const result = executeCommand(engineRef.current, input);

    // Load the new state into the engine (since executeCommand returns a clone)
    engineRef.current.loadState(result.state);

    setState(prev => ({
      repoState: result.state,
      transitions: result.transitions,
      lastCommand: input,
      lastOutput: result.output,
      lastSuccess: result.success,
      commandHistory: [...prev.commandHistory, input],
      undoCount: prev.undoCount,
    }));

    return result;
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prevState = historyRef.current.pop()!;
    engineRef.current.loadState(prevState);

    setState(prev => ({
      repoState: prevState,
      transitions: [],
      lastCommand: '',
      lastOutput: 'Undid last command',
      lastSuccess: true,
      commandHistory: prev.commandHistory.slice(0, -1),
      undoCount: prev.undoCount + 1,
    }));
  }, []);

  const reset = useCallback((setupFn?: (engine: GitEngine) => void) => {
    engineRef.current = new GitEngine();
    historyRef.current = [];
    if (setupFn) setupFn(engineRef.current);

    setState({
      repoState: engineRef.current.getState(),
      transitions: [],
      lastCommand: '',
      lastOutput: '',
      lastSuccess: true,
      commandHistory: [],
      undoCount: 0,
    });
  }, []);

  return (
    <AppContext.Provider value={{
      state,
      runCommand,
      undo,
      canUndo: historyRef.current.length > 0,
      reset,
      engine: engineRef.current,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
