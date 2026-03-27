import { useEffect, useState } from 'react';
import './MilestoneToast.css';

interface MilestoneToastProps {
  title: string;
  onDismiss: () => void;
}

export function MilestoneToast({ title, onDismiss }: MilestoneToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`milestone-toast ${visible ? 'visible' : ''}`}>
      <span className="milestone-toast-icon">&#9733;</span>
      <span className="milestone-toast-text">{title}</span>
    </div>
  );
}
