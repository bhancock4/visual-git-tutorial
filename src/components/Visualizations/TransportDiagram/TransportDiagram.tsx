import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../../state/AppContext';
import type { VirtualFile, Zone } from '../../../engine/types';
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

function getHeadSnapshot(state: ReturnType<typeof useApp>['state']['repoState']): Map<string, VirtualFile> | null {
  if (state.HEAD.type === 'branch') {
    const branch = state.branches.get(state.HEAD.name);
    if (branch) {
      const commit = state.commits.get(branch.commitHash);
      return commit?.snapshot || null;
    }
  } else {
    const commit = state.commits.get(state.HEAD.commitHash);
    return commit?.snapshot || null;
  }
  return null;
}

function getRemoteSnapshot(state: ReturnType<typeof useApp>['state']['repoState']): Map<string, VirtualFile> | null {
  for (const [, remote] of state.remotes) {
    for (const [, commitHash] of remote.branches) {
      const commit = remote.commits.get(commitHash);
      if (commit) return commit.snapshot;
    }
  }
  return null;
}

interface TransportDiagramProps {
  onFileClick?: (filePath: string, content: string) => void;
}

export function TransportDiagram({ onFileClick }: TransportDiagramProps = {}) {
  const { state } = useApp();
  const { repoState, transitions } = state;

  const headSnapshot = useMemo(() => getHeadSnapshot(repoState), [repoState]);
  const remoteSnapshot = useMemo(() => getRemoteSnapshot(repoState), [repoState]);

  const activeTransitionType = transitions.length > 0 ? transitions[0].type : null;
  const transitionFiles = transitions.length > 0 ? new Set(transitions[0].files) : new Set<string>();

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
    <div className="transport-diagram">
      <div className="zones-container">
        {ZONE_CONFIG.map((zone) => {
          const files = getFilesForZone(
            zone.id,
            repoState.workingDirectory,
            repoState.stagingArea,
            headSnapshot,
            remoteSnapshot
          );

          const isSource = transitions.some(t => t.from === zone.id);
          const isTarget = transitions.some(t => t.to === zone.id);

          return (
            <div
              key={zone.id}
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
                        layoutId={`file-${filePath}-${zone.id}`}
                        className={`file-blob ${isMoving ? 'file-moving' : ''}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        onClick={() => {
                          if (!onFileClick) return;
                          // Find file content from the appropriate zone
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
