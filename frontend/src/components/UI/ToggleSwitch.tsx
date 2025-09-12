import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  description?: string;
  loading?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  label,
  description,
  loading = false
}) => {
  const sizeClasses = {
    sm: {
      switch: 'w-8 h-4',
      thumb: 'w-3 h-3',
      translate: 'translate-x-4'
    },
    md: {
      switch: 'w-11 h-6',
      thumb: 'w-5 h-5',
      translate: 'translate-x-5'
    },
    lg: {
      switch: 'w-14 h-8',
      thumb: 'w-6 h-6',
      translate: 'translate-x-6'
    }
  };

  const currentSize = sizeClasses[size];

  const handleToggle = () => {
    if (!disabled && !loading) {
      onChange(!checked);
    }
  };

  return (
    <div className="flex items-center">
      <div className="flex flex-col">
        {label && (
          <label className="text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled || loading}
          className={`
            relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out
            ${currentSize.switch}
            ${disabled || loading
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }
            ${checked
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-200 hover:bg-gray-300'
            }
          `}
          role="switch"
          aria-checked={checked}
          aria-describedby={description ? `${label}-description` : undefined}
        >
          <span
            className={`
              inline-block transform transition-transform duration-200 ease-in-out bg-white rounded-full shadow-lg ring-0
              ${currentSize.thumb}
              ${checked ? currentSize.translate : 'translate-x-0'}
            `}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg 
                  className={`animate-spin text-gray-400 ${size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'}`} 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}
          </span>
        </button>
        {description && (
          <p className="text-xs text-gray-500 mt-1" id={`${label}-description`}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default ToggleSwitch;