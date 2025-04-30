import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Select from 'react-select';

interface ExportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  registerOptions: string[];
  registerSectOptions: string[]; // Add prop for register sect options
  onExport: (selectedRegisters: string[], selectedRegisterSects: string[], selectedColumns: string[], fileName: string) => void; // Update onExport signature
}

// Define available columns for export
const availableColumns = [
  { id: 'full_name', label: 'Full Name' },
  { id: 'first_name', label: 'First Name' },
  { id: 'father_name', label: 'Father Name' },
  { id: 'last_name', label: 'Last Name' },
  { id: 'mother_name', label: 'Mother Name' },
  { id: 'register', label: 'Register' },
  { id: 'register_sect', label: 'Register Sect' },
  { id: 'gender', label: 'Gender' },
  { id: 'alliance', label: 'Alliance' },
  { id: 'family', label: 'Family' },
  { id: 'situation', label: 'Situation' },
  { id: 'sect', label: 'Sect' },
  { id: 'comments', label: 'Comments' },
  { id: 'has_voted', label: 'Has Voted' },
  { id: 'voting_time', label: 'Voting Time' },
];

const ExportPDFModal: React.FC<ExportPDFModalProps> = ({
  isOpen,
  onClose,
  registerOptions = [], // Default to empty array
  registerSectOptions = [], // Default to empty array
  onExport,
}) => {
  const [selectedRegisters, setSelectedRegisters] = useState<string[]>([]);
  const [selectedRegisterSects, setSelectedRegisterSects] = useState<string[]>([]); // Add state for selected register sects
  const [selectedColumns, setSelectedColumns] = useState<string[]>(['full_name', 'situation', 'register', 'register_sect']);

  // Format register options for react-select
  const registerSelectOptions = registerOptions.map(register => ({
    value: register,
    label: register
  }));

  // Format register sect options for react-select
  const registerSectSelectOptions = registerSectOptions.map(sect => ({
    value: sect,
    label: sect
  }));

  // Format column options for react-select
  const columnSelectOptions = availableColumns.map(column => ({
    value: column.id,
    label: column.label
  }));

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedRegisters([]);
      setSelectedRegisterSects([]); // Reset selected register sects
      setSelectedColumns(['full_name', 'situation', 'register', 'register_sect']);
    }
  }, [isOpen]);

  // Handle register selection change
  const handleRegisterChange = (selected: any) => {
    const selectedValues = selected ? selected.map((item: any) => item.value) : [];
    setSelectedRegisters(selectedValues);
  };

  // Handle register sect selection change
  const handleRegisterSectChange = (selected: any) => {
    const selectedValues = selected ? selected.map((item: any) => item.value) : [];
    setSelectedRegisterSects(selectedValues);
  };

  // Handle column selection change
  const handleColumnChange = (selected: any) => {
    const selectedValues = selected ? selected.map((item: any) => item.value) : [];
    setSelectedColumns(selectedValues);
  };

  // Get currently selected register options for the Select component
  const getSelectedRegisterOptions = () => {
    return registerSelectOptions.filter(option => 
      selectedRegisters.includes(option.value)
    );
  };

  // Get currently selected register sect options for the Select component
  const getSelectedRegisterSectOptions = () => {
    return registerSectSelectOptions.filter(option =>
      selectedRegisterSects.includes(option.value)
    );
  };

  // Get currently selected column options for the Select component
  const getSelectedColumnOptions = () => {
    return columnSelectOptions.filter(option => 
      selectedColumns.includes(option.value)
    );
  };

  // Handle export button click
  const handleExport = () => {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14); // Format timestamp as ddMMyyyyhhmmss
    const formattedTimestamp = `${timestamp.slice(6, 8)}${timestamp.slice(4, 6)}${timestamp.slice(0, 4)}_${timestamp.slice(8, 10)}${timestamp.slice(10, 12)}${timestamp.slice(12, 14)}`;
    const registerNames = selectedRegisters.join('-');
    const fileName = `Register_${registerNames}_${formattedTimestamp}.pdf`;

    onExport(selectedRegisters, selectedRegisterSects, selectedColumns, fileName); // Pass selectedRegisterSects
    onClose();
  };

  // Custom styles for react-select
  const customStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: 'var(--bg-input, #ffffff)',
      borderColor: state.isFocused 
        ? 'var(--color-primary, #3b82f6)' 
        : 'var(--border-color, #d1d5db)',
      boxShadow: state.isFocused 
        ? '0 0 0 1px var(--color-primary, #3b82f6)' 
        : 'none',
      '&:hover': {
        borderColor: state.isFocused 
          ? 'var(--color-primary, #3b82f6)' 
          : 'var(--border-hover, #9ca3af)',
      },
    }),
    multiValue: (provided: any) => ({
      ...provided,
      backgroundColor: 'var(--bg-tag, #e5e7eb)',
    }),
    multiValueLabel: (provided: any) => ({
      ...provided,
      color: 'var(--text-tag, #374151)',
      fontSize: '0.875rem',
    }),
    multiValueRemove: (provided: any) => ({
      ...provided,
      color: 'var(--text-tag, #374151)',
      '&:hover': {
        backgroundColor: 'var(--bg-tag-remove-hover, #d1d5db)',
        color: 'var(--text-tag-remove-hover, #1f2937)',
      },
    }),
    menu: (provided: any) => ({
      ...provided,
      backgroundColor: 'var(--bg-dropdown, #ffffff)',
      zIndex: 9999,
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? 'var(--bg-selected, #3b82f6)' 
        : state.isFocused 
          ? 'var(--bg-hover, #f3f4f6)' 
          : 'transparent',
      color: state.isSelected 
        ? 'var(--text-selected, #ffffff)' 
        : 'var(--text-normal, #1f2937)',
      '&:active': {
        backgroundColor: 'var(--bg-active, #dbeafe)',
      },
    }),
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export PDF">
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Registers</h4>
          <Select
            isMulti
            isClearable
            isSearchable
            placeholder="Select registers..."
            options={registerSelectOptions}
            value={getSelectedRegisterOptions()}
            onChange={handleRegisterChange}
            className="react-select-container"
            classNamePrefix="react-select"
            styles={customStyles}
            aria-label="Select registers"
          />
          {selectedRegisters.length === 0 && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">Please select at least one register.</p>
          )}
        </div>

        {/* Add Register Sect Selector */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Register Sects</h4>
          <Select
            isMulti
            isClearable
            isSearchable
            placeholder="Select register sects..."
            options={registerSectSelectOptions}
            value={getSelectedRegisterSectOptions()}
            onChange={handleRegisterSectChange}
            className="react-select-container"
            classNamePrefix="react-select"
            styles={customStyles}
            aria-label="Select register sects"
          />
          {/* Optional: Add validation message if needed */}
          {/* {selectedRegisterSects.length === 0 && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">Please select at least one register sect.</p>
          )} */}
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Columns</h4>
          <Select
            isMulti
            isClearable
            isSearchable
            placeholder="Select columns..."
            options={columnSelectOptions}
            value={getSelectedColumnOptions()}
            onChange={handleColumnChange}
            className="react-select-container"
            classNamePrefix="react-select"
            styles={customStyles}
            aria-label="Select columns"
          />
          {selectedColumns.length === 0 && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">Please select at least one column.</p>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={selectedRegisters.length === 0 || selectedColumns.length === 0}
            className={`px-5 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 flex items-center justify-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 ${
              selectedRegisters.length === 0 || selectedColumns.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                : 'bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white dark:from-red-600 dark:to-red-800 dark:hover:from-red-700 dark:hover:to-red-900'
            }`}
          >
            <i className="fas fa-file-pdf text-red-100 mr-2 text-lg"></i>
            <span className="font-medium">Export PDF</span>
          </button>
        </div> {/* Correctly closed div */}
      </div> {/* Correctly closed div */}
    </Modal> /* Correctly closed Modal */
  );
};

export default ExportPDFModal;