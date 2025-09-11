import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface DropdownOption {
  label: string;
  value: string;
  icon?: ReactNode;
  color?: 'default' | 'danger' | 'warning' | 'success';
  disabled?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  placement?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  className?: string;
  disabled?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  options,
  onSelect,
  placement = 'bottom-right',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleTriggerClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleOptionClick = (value: string, optionDisabled?: boolean) => {
    if (optionDisabled) return;
    
    onSelect(value);
    setIsOpen(false);
  };

  const getPlacementClasses = () => {
    switch (placement) {
      case 'bottom-left':
        return 'top-full left-0 mt-1';
      case 'bottom-right':
        return 'top-full right-0 mt-1';
      case 'top-left':
        return 'bottom-full left-0 mb-1';
      case 'top-right':
        return 'bottom-full right-0 mb-1';
      default:
        return 'top-full right-0 mt-1';
    }
  };

  const getColorClasses = (color?: string) => {
    switch (color) {
      case 'danger':
        return 'text-red-600 hover:bg-red-50';
      case 'warning':
        return 'text-yellow-600 hover:bg-yellow-50';
      case 'success':
        return 'text-green-600 hover:bg-green-50';
      default:
        return 'text-slate-700 hover:bg-slate-50';
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger */}
      <div
        ref={triggerRef}
        onClick={handleTriggerClick}
        className={`cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {trigger}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={`
            absolute z-[10000] w-48 bg-white rounded-lg shadow-lg border border-slate-200
            ${getPlacementClasses()}
            animate-in fade-in-0 zoom-in-95 duration-200
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            {options.map((option, index) => (
              <button
                key={option.value || index}
                onClick={() => handleOptionClick(option.value, option.disabled)}
                disabled={option.disabled}
                className={`
                  w-full text-left px-4 py-2 text-sm flex items-center transition-colors
                  ${getColorClasses(option.color)}
                  ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {option.icon && (
                  <span className="mr-3 flex-shrink-0">
                    {option.icon}
                  </span>
                )}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;