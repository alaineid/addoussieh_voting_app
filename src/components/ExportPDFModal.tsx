import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Select from 'react-select';

interface ExportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  registerOptions: string[];
  familyOptions: string[]; // Keep only family options
  onExport: (selectedFamilies: string[], selectedColumns: string[], fileName: string) => void; // Remove registerSects from signature
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
  familyOptions = [], // Default to empty array
  onExport,
}) => {
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(['full_name', 'situation', 'family', 'register', 'register_sect']);

  // Format family options for react-select
  const familySelectOptions = familyOptions.map(family => ({
    value: family,
    label: family
  }));

  // Format column options for react-select
  const columnSelectOptions = availableColumns.map(column => ({
    value: column.id,
    label: column.label
  }));

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFamilies([]);
      setSelectedColumns(['full_name', 'situation', 'family', 'register', 'register_sect']);
    }
  }, [isOpen]);

  // Handle family selection change
  const handleFamilyChange = (selected: any) => {
    const selectedValues = selected ? selected.map((item: any) => item.value) : [];
    setSelectedFamilies(selectedValues);
  };

  // Select all families
  const handleSelectAllFamilies = () => {
    setSelectedFamilies(familyOptions);
  };

  // Handle column selection change
  const handleColumnChange = (selected: any) => {
    const selectedValues = selected ? selected.map((item: any) => item.value) : [];
    setSelectedColumns(selectedValues);
  };

  // Get currently selected family options for the Select component
  const getSelectedFamilyOptions = () => {
    return familySelectOptions.filter(option => 
      selectedFamilies.includes(option.value)
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
    const familyNames = selectedFamilies.length > 5 ? 'AllFamilies' : selectedFamilies.join('-');
    const fileName = `Families_${familyNames}_${formattedTimestamp}.pdf`;

    onExport(selectedFamilies, selectedColumns, fileName); // Only pass selectedFamilies and selectedColumns
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
      minHeight: '38px',
      width: '100%',
    }),
    valueContainer: (provided: any) => ({
      ...provided,
      padding: '2px 8px',
      overflow: 'auto',
      maxHeight: '100px', // Limit height and enable scrolling
    }),
    multiValue: (provided: any) => ({
      ...provided,
      backgroundColor: 'var(--bg-tag, #e5e7eb)',
      margin: '2px',
    }),
    multiValueLabel: (provided: any) => ({
      ...provided,
      color: 'var(--text-tag, #374151)',
      fontSize: '0.875rem',
      padding: '2px 6px',
      whiteSpace: 'normal', // Allow text wrapping
    }),
    multiValueRemove: (provided: any) => ({
      ...provided,
      color: 'var(--text-tag, #374151)',
      padding: '0 4px',
      '&:hover': {
        backgroundColor: 'var(--bg-tag-remove-hover, #d1d5db)',
        color: 'var(--text-tag-remove-hover, #1f2937)',
      },
    }),
    menu: (provided: any) => ({
      ...provided,
      backgroundColor: 'var(--bg-dropdown, #ffffff)',
      zIndex: 9999,
      width: 'auto',
      minWidth: '100%', // Ensure the menu is at least as wide as the control
    }),
    menuPortal: (provided: any) => ({
      ...provided,
      zIndex: 9999
    }),
    menuList: (provided: any) => ({
      ...provided,
      maxHeight: '300px', // Increase scrollable area
      padding: '4px',
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
      padding: '8px 12px',
      fontSize: '0.875rem',
      whiteSpace: 'normal', // Allow text wrapping in options
      wordBreak: 'break-word',
      '&:active': {
        backgroundColor: 'var(--bg-active, #dbeafe)',
      },
    }),
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export PDF">
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Families</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">The dropdown menu is scrollable - use search to find specific families</p>
          <div className="flex items-center mb-2">
            <Select
              isMulti
              isClearable
              isSearchable
              placeholder="Select families..."
              options={familySelectOptions}
              value={getSelectedFamilyOptions()}
              onChange={handleFamilyChange}
              className="react-select-container flex-grow"
              classNamePrefix="react-select"
              styles={customStyles}
              aria-label="Select families"
              menuPortalTarget={document.body} 
              menuPosition="fixed"
              maxMenuHeight={300}
              closeMenuOnScroll={false}
              controlShouldRenderValue={true}
              formatOptionLabel={(option: any) => (
                <div className="py-1">{option.label}</div>
              )}
            />
            <button
              onClick={handleSelectAllFamilies}
              className="ml-2 px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
            >
              Select All
            </button>
          </div>
          {selectedFamilies.length === 0 && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">Please select at least one family.</p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Columns</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">The dropdown menu is scrollable - use search to find specific columns</p>
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
            menuPortalTarget={document.body}
            menuPosition="fixed"
            maxMenuHeight={300}
            closeMenuOnScroll={false}
            controlShouldRenderValue={true}
            formatOptionLabel={(option: any) => (
              <div className="py-1">{option.label}</div>
            )}
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
            disabled={selectedFamilies.length === 0 || selectedColumns.length === 0}
            className={`px-5 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 flex items-center justify-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 ${
              selectedFamilies.length === 0 || selectedColumns.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                : 'bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white dark:from-red-600 dark:to-red-800 dark:hover:from-red-700 dark:hover:to-red-900'
            }`}
          >
            <i className="fas fa-file-pdf text-red-100 mr-2 text-lg"></i>
            <span className="font-medium">Export PDF</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExportPDFModal;