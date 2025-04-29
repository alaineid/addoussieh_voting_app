import React, { useState, useEffect } from 'react';
import Modal from './Modal';

interface ExportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  registerOptions: string[];
  onExport: (selectedRegisters: string[], selectedColumns: string[]) => void;
}

// Define available columns for export
const availableColumns = [
  { id: 'full_name', label: 'Full Name' },
  { id: 'register', label: 'Register' },
  { id: 'register_sect', label: 'Register Sect' },
  { id: 'gender', label: 'Gender' },
  { id: 'comments', label: 'Comments' },
  { id: 'has_voted', label: 'Has Voted' },
  { id: 'voting_time', label: 'Voting Time' },
];

const ExportPDFModal: React.FC<ExportPDFModalProps> = ({
  isOpen,
  onClose,
  registerOptions,
  onExport,
}) => {
  const [selectedRegisters, setSelectedRegisters] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(['full_name', 'register', 'register_sect', 'has_voted']);

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedRegisters([]);
      setSelectAll(false);
      setSelectedColumns(['full_name', 'register', 'register_sect', 'has_voted']);
    }
  }, [isOpen]);

  // Handle select all registers
  const handleSelectAllRegisters = () => {
    if (selectAll) {
      setSelectedRegisters([]);
    } else {
      setSelectedRegisters([...registerOptions]);
    }
    setSelectAll(!selectAll);
  };

  // Handle individual register selection
  const handleRegisterSelect = (register: string) => {
    setSelectedRegisters(prev => {
      const isSelected = prev.includes(register);
      
      // If register is currently selected, remove it
      if (isSelected) {
        setSelectAll(false);
        return prev.filter(r => r !== register);
      }
      
      // If all registers are now selected, set selectAll to true
      const newSelection = [...prev, register];
      if (newSelection.length === registerOptions.length) {
        setSelectAll(true);
      }
      
      return newSelection;
    });
  };

  // Handle column selection
  const handleColumnSelect = (columnId: string) => {
    setSelectedColumns(prev => {
      return prev.includes(columnId) 
        ? prev.filter(c => c !== columnId) 
        : [...prev, columnId];
    });
  };

  // Handle export button click
  const handleExport = () => {
    onExport(selectedRegisters, selectedColumns);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export PDF">
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Registers</h4>
          <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
            <div className="mb-2">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-blue-600"
                  checked={selectAll}
                  onChange={handleSelectAllRegisters}
                />
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Select All</span>
              </label>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {registerOptions.map(register => (
                <div key={register} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`register-${register}`}
                    className="form-checkbox h-4 w-4 text-blue-600"
                    checked={selectedRegisters.includes(register)}
                    onChange={() => handleRegisterSelect(register)}
                  />
                  <label
                    htmlFor={`register-${register}`}
                    className="ml-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    {register}
                  </label>
                </div>
              ))}
            </div>
          </div>
          {selectedRegisters.length === 0 && (
            <p className="mt-1 text-xs text-red-500">Please select at least one register.</p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Columns</h4>
          <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
            {availableColumns.map(column => (
              <label key={column.id} className="inline-flex items-center">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-blue-600"
                  checked={selectedColumns.includes(column.id)}
                  onChange={() => handleColumnSelect(column.id)}
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{column.label}</span>
              </label>
            ))}
          </div>
          {selectedColumns.length === 0 && (
            <p className="mt-1 text-xs text-red-500">Please select at least one column.</p>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={selectedRegisters.length === 0 || selectedColumns.length === 0}
            className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center ${
              selectedRegisters.length === 0 || selectedColumns.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 transition-colors'
            }`}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 mr-2" 
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M5 12v-1h4v1" />
              <path d="M9 12v6" />
              <path d="M5 18v-1h4v1" />
              <path d="M14 12h1v6h-1z" />
              <path d="M19 12h-4" />
              <path d="M19 15h-4" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExportPDFModal;