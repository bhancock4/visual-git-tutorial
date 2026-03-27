import { useState } from 'react';
import { TransportDiagram } from './TransportDiagram/TransportDiagram';
import { CommitGraph } from './CommitGraph/CommitGraph';
import './VisualizationPanel.css';

type ViewMode = 'transport' | 'graph' | 'split';

interface VisualizationPanelProps {
  onFileClick?: (filePath: string, content: string) => void;
}

export function VisualizationPanel({ onFileClick }: VisualizationPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('transport');

  return (
    <div className="viz-panel-container">
      <div className="viz-tabs">
        <button
          className={`viz-tab ${viewMode === 'transport' ? 'active' : ''}`}
          onClick={() => setViewMode('transport')}
        >
          Flow Diagram
        </button>
        <button
          className={`viz-tab ${viewMode === 'graph' ? 'active' : ''}`}
          onClick={() => setViewMode('graph')}
        >
          Commit Graph
        </button>
        <button
          className={`viz-tab ${viewMode === 'split' ? 'active' : ''}`}
          onClick={() => setViewMode('split')}
        >
          Both
        </button>
      </div>

      <div className={`viz-content ${viewMode}`}>
        {(viewMode === 'transport' || viewMode === 'split') && (
          <div className="viz-pane">
            <TransportDiagram onFileClick={onFileClick} />
          </div>
        )}
        {(viewMode === 'graph' || viewMode === 'split') && (
          <div className="viz-pane">
            <CommitGraph />
          </div>
        )}
      </div>
    </div>
  );
}
