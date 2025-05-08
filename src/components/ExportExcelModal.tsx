import React, { useState, useEffect } from 'react';
import Modal from './Modal';

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (fileName: string) => void;
}

const ExportExcelModal: React.FC<ExportExcelModalProps> = ({
  isOpen,
  onClose,
  onExport,
}) => {
  const [fileName, setFileName] = useState<string>("");

  // Reset filename when modal opens
  useEffect(() => {
    if (isOpen) {
      // Generate default filename with current date
      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, '0')}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getFullYear()}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      setFileName(`VotersList_${dateStr}`);
    }
  }, [isOpen]);

  // Handle export button click
  const handleExport = () => {
    // Add .xlsx extension if not already present
    const finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    onExport(finalFileName);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export to Excel">
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filename</h4>
          <div className="flex items-center">
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter filename"
            />
            <span className="px-3 py-2 bg-gray-100 dark:bg-gray-600 border-y border-r border-gray-300 dark:border-gray-600 rounded-r-md text-gray-500 dark:text-gray-300">
              .xlsx
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            The current filtered data will be exported to Excel. All visible columns and applied filters will be preserved.
          </p>
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
            disabled={!fileName.trim()}
            className={`px-5 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 flex items-center justify-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 ${
              !fileName.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                : 'bg-gradient-to-br from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white dark:from-green-600 dark:to-green-800 dark:hover:from-green-700 dark:hover:to-green-900'
            }`}
          >
            <i className="fas fa-file-excel text-green-100 mr-2 text-lg"></i>
            <span className="font-medium">Export Excel</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExportExcelModal;