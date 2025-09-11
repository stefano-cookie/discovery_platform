import React, { useRef, useEffect } from 'react';

interface LogoutDropdownProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

const LogoutDropdown: React.FC<LogoutDropdownProps> = ({ 
  isOpen, 
  onConfirm, 
  onCancel,
  position = 'bottom',
  align = 'end'
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getPositionClasses = () => {
    const baseClasses = 'absolute z-50 mt-1 w-40';
    
    switch (position) {
      case 'top':
        return `${baseClasses} bottom-full mb-2 mt-0`;
      case 'left':
        return `${baseClasses} right-full mr-2 mt-0 top-0`;
      case 'right':
        return `${baseClasses} left-full ml-2 mt-0 top-0`;
      default: // bottom
        return baseClasses;
    }
  };

  const getAlignClasses = () => {
    switch (align) {
      case 'start':
        return 'left-0';
      case 'center':
        return 'left-1/2 transform -translate-x-1/2';
      default: // end
        return 'right-0';
    }
  };

  return (
    <div 
      ref={dropdownRef}
      className={`${getPositionClasses()} ${getAlignClasses()}`}
    >
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden animate-in slide-in-from-top-2 duration-200">
        {/* Content */}
        <div className="p-2">
          <p className="text-xs text-gray-600 mb-2 text-center">
            Esci?
          </p>
          
          {/* Buttons */}
          <div className="flex space-x-1">
            <button
              onClick={onConfirm}
              className="flex-1 inline-flex justify-center items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500 transition-colors duration-150"
            >
              Esci
            </button>
            <button
              onClick={onCancel}
              className="flex-1 inline-flex justify-center items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-500 transition-colors duration-150"
            >
              No
            </button>
          </div>
        </div>

        {/* Arrow pointer */}
        <div className={`absolute w-2 h-2 bg-white border-l border-t border-gray-200 transform rotate-45 ${
          position === 'top' 
            ? 'top-full -mt-1' 
            : position === 'left'
            ? 'left-full -ml-1 top-3'
            : position === 'right'
            ? 'right-full -mr-1 top-3'
            : '-top-1'
        } ${
          align === 'start' 
            ? 'left-4' 
            : align === 'center'
            ? 'left-1/2 -translate-x-1/2'
            : 'right-4'
        }`}></div>
      </div>
    </div>
  );
};

export default LogoutDropdown;