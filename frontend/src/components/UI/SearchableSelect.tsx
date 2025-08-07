import React, { useState, useRef, useEffect, forwardRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
}

const SearchableSelect = forwardRef<HTMLInputElement, SearchableSelectProps>(
  ({ label, options, error, placeholder, value = '', onChange, name, className = '', ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [displayValue, setDisplayValue] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Filter options based on search term
    const filteredOptions = options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Update display value when value prop changes
    useEffect(() => {
      if (value) {
        const selectedOption = options.find(option => option.value === value);
        setDisplayValue(selectedOption?.label || value);
        setSearchTerm('');
      } else {
        setDisplayValue('');
        setSearchTerm('');
      }
    }, [value, options]);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          // Reset search term if no selection was made
          if (!value && searchTerm) {
            setSearchTerm('');
            setDisplayValue('');
          }
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [value, searchTerm]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setSearchTerm(inputValue);
      setDisplayValue(inputValue);
      setIsOpen(true);

      // If input is empty, clear the selection
      if (!inputValue && onChange) {
        onChange('');
      }
    };

    const handleOptionSelect = (option: SelectOption) => {
      setDisplayValue(option.label);
      setSearchTerm('');
      setIsOpen(false);
      
      if (onChange) {
        onChange(option.value);
      }
    };

    const handleInputFocus = () => {
      setIsOpen(true);
      // Show current value as search term when focused
      if (value && !searchTerm) {
        const selectedOption = options.find(opt => opt.value === value);
        if (selectedOption) {
          setSearchTerm(selectedOption.label);
          setDisplayValue(selectedOption.label);
        }
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
      } else if (e.key === 'Enter' && filteredOptions.length === 1) {
        e.preventDefault();
        handleOptionSelect(filteredOptions[0]);
      }
    };

    return (
      <div className="space-y-1" ref={containerRef}>
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            type="text"
            name={name}
            value={isOpen ? searchTerm : displayValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`
              w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              ${error ? 'border-red-500' : 'border-gray-300'}
              ${className}
            `}
            autoComplete="off"
            {...props}
          />
          
          {/* Dropdown arrow */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Dropdown menu */}
          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              {filteredOptions.length > 0 ? (
                <>
                  {filteredOptions.map((option, index) => (
                    <div
                      key={`${option.value}-${index}`}
                      onClick={() => handleOptionSelect(option)}
                      className="px-3 py-2 cursor-pointer hover:bg-blue-50 hover:text-blue-700 text-sm border-b border-gray-100 last:border-b-0"
                    >
                      {option.label}
                    </div>
                  ))}
                  
                  {/* Show total count when filtering */}
                  {searchTerm && (
                    <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t">
                      {filteredOptions.length} risultat{filteredOptions.length !== 1 ? 'i' : 'o'} trovato{filteredOptions.length !== 1 ? '' : 'o'}
                    </div>
                  )}
                </>
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">
                  {searchTerm ? `Nessun risultato per "${searchTerm}"` : 'Nessuna opzione disponibile'}
                </div>
              )}
            </div>
          )}
        </div>
        
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

SearchableSelect.displayName = 'SearchableSelect';

export default SearchableSelect;