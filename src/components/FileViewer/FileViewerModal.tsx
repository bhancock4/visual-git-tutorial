import './FileViewerModal.css';

interface FileViewerModalProps {
  filePath: string;
  content: string;
  onClose: () => void;
}

export function FileViewerModal({ filePath, content, onClose }: FileViewerModalProps) {
  return (
    <div className="file-viewer-backdrop" onClick={onClose}>
      <div className="file-viewer-modal" onClick={e => e.stopPropagation()}>
        <div className="file-viewer-header">
          <span className="file-viewer-path">{filePath}</span>
          <button className="file-viewer-close" onClick={onClose}>
            &#10005;
          </button>
        </div>
        <div className="file-viewer-body">
          <pre className="file-viewer-content">
            {content.split('\n').map((line, i) => (
              <div key={i} className="file-viewer-line">
                <span className="file-viewer-line-num">{i + 1}</span>
                <span className="file-viewer-line-text">{line}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
