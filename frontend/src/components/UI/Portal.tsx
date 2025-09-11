import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
  containerId?: string;
}

const Portal: React.FC<PortalProps> = ({ children, containerId = 'modal-root' }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Try to find existing container
    let modalRoot = document.getElementById(containerId);
    
    // Create container if it doesn't exist
    if (!modalRoot) {
      modalRoot = document.createElement('div');
      modalRoot.id = containerId;
      modalRoot.style.position = 'fixed';
      modalRoot.style.top = '0';
      modalRoot.style.left = '0';
      modalRoot.style.width = '100%';
      modalRoot.style.height = '100%';
      modalRoot.style.pointerEvents = 'none';
      modalRoot.style.zIndex = '1000';
      document.body.appendChild(modalRoot);
    }
    
    setContainer(modalRoot);
    
    // Cleanup function to remove container if it becomes empty
    return () => {
      if (modalRoot && modalRoot.children.length === 0 && modalRoot.parentNode) {
        modalRoot.parentNode.removeChild(modalRoot);
      }
    };
  }, [containerId]);

  // Enable pointer events when modal is rendered
  useEffect(() => {
    if (container) {
      container.style.pointerEvents = 'auto';
      return () => {
        // Re-check if container still exists and has no children
        if (container && container.children.length <= 1) {
          container.style.pointerEvents = 'none';
        }
      };
    }
  }, [container]);

  if (!container) {
    return null;
  }

  return createPortal(children, container);
};

export default Portal;