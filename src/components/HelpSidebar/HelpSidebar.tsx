import { useState } from 'react';
import type { HelpContent } from '../../scenarios/types';
import './HelpSidebar.css';

interface HelpSidebarProps {
  helpContent: HelpContent | null;
  docLinks: Array<{ label: string; url: string }>;
  milestone: { title: string } | null;
}

export function HelpSidebar({ helpContent, docLinks, milestone }: HelpSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);

  return (
    <div className="help-sidebar">
      {milestone && (
        <div className="milestone-banner">
          <span className="milestone-check">&#10003;</span>
          <span>{milestone.title}</span>
        </div>
      )}

      <button
        className={`help-collapse-toggle ${expanded ? 'expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span>Context &amp; Docs</span>
        <span className="help-collapse-chevron">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {expanded && (
        <div className="help-collapsible-body">
          {helpContent ? (
            <div className="help-content">
              <div className="help-explanation">
                <p>{helpContent.explanation}</p>
              </div>

              <button
                className={`help-why-toggle ${whyExpanded ? 'expanded' : ''}`}
                onClick={() => setWhyExpanded(!whyExpanded)}
              >
                Why does this matter?
                <span className="help-chevron">{whyExpanded ? '\u25B2' : '\u25BC'}</span>
              </button>

              {whyExpanded && (
                <div className="help-why">
                  <p>{helpContent.why}</p>
                </div>
              )}

              {helpContent.relatedCommands && helpContent.relatedCommands.length > 0 && (
                <div className="help-related">
                  <h4>Related commands</h4>
                  <div className="help-related-list">
                    {helpContent.relatedCommands.map(cmd => (
                      <code key={cmd}>{cmd}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="help-empty">
              <p>Run a command to see contextual help here.</p>
            </div>
          )}

          {docLinks.length > 0 && (
            <div className="help-docs">
              <h4>Documentation</h4>
              <ul>
                {docLinks.map(link => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.label} &#8599;
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
