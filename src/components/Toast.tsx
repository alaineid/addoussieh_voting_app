import React, { useEffect } from 'react';

// Define interface for Toast component props
export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  // Set up auto-hide timer as soon as toast is rendered
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 2000);
    
    // Clean up timer if component unmounts before timeout completes
    return () => clearTimeout(timer);
  }, [message, onClose]); // Re-run if message or onClose changes

  const getBgColor = () => {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <i className="fas fa-check-circle w-5 h-5"></i>;
      case 'error':
        return <i className="fas fa-times-circle w-5 h-5"></i>;
      case 'warning':
        return <i className="fas fa-exclamation-triangle w-5 h-5"></i>;
      case 'info':
      default:
        return <i className="fas fa-info-circle w-5 h-5"></i>;
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center p-4 text-white rounded-md shadow-lg transform transition-all duration-300 ${getBgColor()}`}>
      <div className="mr-3">
        {getIcon()}
      </div>
      <div>{message}</div>
      <button 
        onClick={onClose} 
        className="ml-6 text-white hover:text-gray-200"
        aria-label="Close"
      >
        <i className="fas fa-times w-4 h-4"></i>
      </button>
    </div>
  );
};

export default Toast;