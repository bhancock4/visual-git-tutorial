import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../../state/AppContext';
import type { VirtualFile, Zone, StateTransition } from '../../../engine/types';
import './TransportDiagram.css';

const ZONE_CONFIG: Array<{ id: Zone; label: string; color: string; icon: string }> = [
  { id: 'working', label: 'Working Directory', color: '#60a5fa', icon: '📁' },
  { id: 'staging', label: 'Staging Area', color: '#4ade80', icon: '📋' },
  { id: 'local', label: 'Local Repository', color: '#a78bdb', icon: '💾' },
  { id: 'remote', label: 'Remote Repository', color: '#fbbf24', icon: '☁️' },
];

const ARROWS: Array<{ from: Zone; to: Zone; label: string; commands: string[] }> = [
  { from: 'working', to: 'staging', label: 'git add', commands: ['add'] },
  { from: 'staging', to: 'local', label: 'git commit', commands: ['commit'] },
  { from: 'local', to: 'remote', label: 'git push', commands: ['push'] },
  { from: 'remote', to: 'local', label: 'git fetch', commands: ['fetch'] },
  { from: 'remote', to: 'working', label: 'git pull', commands: ['pull'] },
  { from: 'local', to: 'working', label: 'git checkout', commands: ['checkout', 'reset'] },
  { from: 'staging', to: 'working', label: 'git reset HEAD', commands: ['reset'] },
];

function getFilesForZone(
  zone: Zone,
  workingDir: Map<string, VirtualFile>,
  staging: Map<string, VirtualFile>,
  headSnapshot: Map<string, VirtualFile> | null,
  remoteSnapshot: Map<string, VirtualFile> | null
): string[] {
  switch (zone) {
    case 'working':
      return Array.from(workingDir.keys());
    case 'staging':
      return Array.from(staging.keys());
    case 'local':
      return headSnapshot ? Array.from(headSnapshot.keys()) : [];
    case 'remote':
      return remoteSnapshot ? Array.from(remoteSnapshot.keys()) : [];
  }
}

function getHeadSnapshot(state: { HEAD: { type: string; name?: string; commitHash?: string }; branches: Map<string, { commitHash: string }>; commits: Map<string, { snapshot: Map<string, VirtualFile> }> }): Map<string, VirtualFile> | null {
  if (state.HEAD.type === 'branch') {
    const branch = state.branches.get(state.HEAD.name!);
    if (branch) {
      const commit = state.commits.get(branch.commitHash);
      return commit?.snapshot || null;
    }
  } else {
    const commit = state.commits.get(state.HEAD.commitHash!);
    return commit?.snapshot || null;
  }
  return null;
}

function getRemoteSnapshot(state: { remotes: Map<string, { branches: Map<string, string>; commits: Map<string, { snapshot: Map<string, VirtualFile> }> }> }): Map<string, VirtualFile> | null {
  for (const [, remote] of state.remotes) {
    for (const [, commitHash] of remote.branches) {
      const commit = remote.commits.get(commitHash);
      if (commit) return commit.snapshot;
    }
  }
  return null;
}

// ---- Flying file animation ----

interface FlyingFile {
  id: string;
  fileName: string;
  fromZone: Zone;
  toZone: Zone;
}

function useFlyingFiles(transitions: StateTransition[]) {
  const [flyingFiles, setFlyingFiles] = useState<FlyingFile[]>([]);
  const prevTransitions = useRef<StateTransition[]>([]);

  useEffect(() => {
    // Only trigger on new transitions
    if (transitions.length === 0 || transitions === prevTransitions.current) {
      prevTransitions.current = transitions;
      return;
    }
    prevTransitions.current = transitions;

    const newFlying: FlyingFile[] = [];
    for (const t of transitions) {
      for (const file of t.files) {
        newFlying.push({
          id: `${t.from}-${t.to}-${file}-${Date.now()}`,
          fileName: file.split('/').pop() || file,
          fromZone: t.from,
          toZone: t.to,
        });
      }
    }

    if (newFlying.length > 0) {
      setFlyingFiles(newFlying);
      // Clear after animation completes
      const timer = setTimeout(() => setFlyingFiles([]), 600);
      return () => clearTimeout(timer);
    }
  }, [transitions]);

  return flyingFiles;
}

interface TransportDiagramProps {
  onFileClick?: (filePath: string, content: string) => void;
}

export function TransportDiagram({ onFileClick }: TransportDiagramProps = {}) {
  const { state } = useApp();
  const { repoState, transitions } = state;

  const headSnapshot = useMemo(() => getHeadSnapshot(repoState), [repoState]);
  const remoteSnapshot = useMemo(() => getRemoteSnapshot(repoState), [repoState]);

  const transitionFiles = transitions.length > 0 ? new Set(transitions[0].files) : new Set<string>();
  const flyingFiles = useFlyingFiles(transitions);

  // Track zone element positions for flying animation
  const zoneRefs = useRef<Map<Zone, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const setZoneRef = useCallback((zone: Zone) => (el: HTMLDivElement | null) => {
    if (el) {
      zoneRefs.current.set(zone, el);
    }
  }, []);

  // Calculate flying file positions relative to container
  const getFlyPosition = useCallback((zone: Zone): { x: number; y: number } => {
    const container = containerRef.current;
    const zoneEl = zoneRefs.current.get(zone);
    if (!container || !zoneEl) return { x: 0, y: 0 };

    const containerRect = container.getBoundingClientRect();
    const zoneRect = zoneEl.getBoundingClientRect();

    return {
      x: zoneRect.left - containerRect.left + zoneRect.width / 2,
      y: zoneRect.top - containerRect.top + zoneRect.height / 2,
    };
  }, []);

  if (!repoState.initialized) {
    return (
      <div className="transport-diagram">
        <div className="transport-empty">
          <p>Initialize a repository to see the git workflow</p>
          <code>git init</code>
        </div>
      </div>
    );
  }

  return (
    <div className="transport-diagram" ref={containerRef}>
      <div className="zones-container">
        {ZONE_CONFIG.map((zone) => {
          const files = getFilesForZone(
            zone.id,
            repoState.workingDirectory,
            repoState.stagingArea,
            headSnapshot,
            remoteSnapshot
          );

          const isTarget = transitions.some(t => t.to === zone.id);

          return (
            <div
              key={zone.id}
              ref={setZoneRef(zone.id)}
              className={`zone ${isTarget ? 'zone-highlight' : ''}`}
              style={{ '--zone-color': zone.color } as React.CSSProperties}
            >
              <div className="zone-header">
                <span className="zone-icon">{zone.icon}</span>
                <span className="zone-label">{zone.label}</span>
              </div>
              <div className="zone-files">
                <AnimatePresence mode="popLayout">
                  {files.map((filePath) => {
                    const isMoving = transitionFiles.has(filePath);
                    return (
                      <motion.div
                        key={`${zone.id}-${filePath}`}
                        className={`file-blob ${isMoving ? 'file-moving' : ''}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        onClick={() => {
                          if (!onFileClick) return;
                          const file = zone.id === 'working'
                            ? repoState.workingDirectory.get(filePath)
                            : zone.id === 'staging'
                              ? repoState.stagingArea.get(filePath)
                              : zone.id === 'local'
                                ? headSnapshot?.get(filePath)
                                : remoteSnapshot?.get(filePath);
                          if (file) onFileClick(filePath, file.content);
                        }}
                      >
                        <span className="file-icon">📄</span>
                        <span className="file-name">{filePath.split('/').pop()}</span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {files.length === 0 && (
                  <div className="zone-empty">empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Flying file animations */}
      <AnimatePresence>
        {flyingFiles.map((ff) => {
          const from = getFlyPosition(ff.fromZone);
          const to = getFlyPosition(ff.toZone);

          return (
            <motion.div
              key={ff.id}
              className="file-flying"
              initial={{ x: from.x - 30, y: from.y - 12, opacity: 1, scale: 1 }}
              animate={{ x: to.x - 30, y: to.y - 12, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.8 }}
            >
              <span className="file-icon">📄</span>
              <span className="file-name">{ff.fileName}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <div className="arrows-container">
        {ARROWS.map((arrow, i) => {
          const isActive = transitions.some(
            t => t.from === arrow.from && t.to === arrow.to
          );
          return (
            <div
              key={i}
              className={`arrow arrow-${arrow.from}-to-${arrow.to} ${isActive ? 'arrow-active' : ''}`}
            >
              <span className="arrow-label">{arrow.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
