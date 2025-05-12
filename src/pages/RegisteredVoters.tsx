import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { 
  createColumnHelper, 
  flexRender, 
  getCoreRowModel, 
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState
} from '@tanstack/react-table';
import ConfirmationModal from '../components/ConfirmationModal';
import SearchFilter from '../components/SearchFilter';  // Import the SearchFilter component
import Toast from '../components/Toast'; // Import shared Toast component
import SimplePDFModal from '../components/SimplePDFModal';
import ExportExcelModal from '../components/ExportExcelModal';
import { exportDataToPDF, formatDateForExport } from '../utils/pdfExport';
import { exportTableDataToExcel } from '../utils/excelExport';

// Define the structure of a voter record based on the requested columns
interface Voter {
  id: number;
  alliance: string | null;
  family: string | null;
  register: number | null;
  register_sect: string | null;
  gender: string | null;
  first_name: string | null;
  father_name: string | null;
  last_name: string | null;
  mother_name: string | null;
  full_name: string | null;
  situation: string | null;
  // Make these optional since we're not selecting them in our query
  n_plus?: number | null;
  n?: number | null;
  n_minus?: number | null;
  against?: number | null;
  no_vote?: number | null;
  death?: number | null;
  military?: number | null;
  residence: string | null;
  has_voted: boolean | null;
  comments?: string | null;
  search_vector?: any; // unknown type
  with_flag?: number | null;
  dob: string | null; // date as string
  sect: string | null; // Added missing property
}

// Helper function to format dates correctly accounting for timezone issues
const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-';
  
  // Parse the date - add time to avoid timezone issues
  const date = new Date(`${dateString}T12:00:00Z`);
  
  // Format as DD/MM/YYYY
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  
  return `${day}/${month}/${year}`;
};

const RegisteredVoters: React.FC = () => {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuthStore();
  useThemeStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const userSelectedViewMode = useRef<boolean>(false);
  
  // Export PDF modal state
  const [exportPdfModalOpen, setExportPdfModalOpen] = useState(false);
  
  // Export Excel modal state
  const [exportExcelModalOpen, setExportExcelModalOpen] = useState(false);
  
  // Edit and delete state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Voter>>({});
  // Track only fields that have been specifically modified by user input
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [voterToDelete, setVoterToDelete] = useState<Voter | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);
  
  // Add new voter state
  const [isAddVoterModalOpen, setIsAddVoterModalOpen] = useState(false);
  const [newVoterData, setNewVoterData] = useState<Partial<Voter>>({
    has_voted: false
  });

  // Dropdown options for filters (populated on data load)
  const [situationOptions, setSituationOptions] = useState<string[]>([]);
  const [registerOptions, setRegisterOptions] = useState<string[]>([]);
  const [registerSectOptions, setRegisterSectOptions] = useState<string[]>([]);

  // Permission check
  const hasEditPermission = profile?.registered_voters_access === 'edit';
  
  // Available columns for export
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
    { id: 'residence', label: 'Residence' },
    { id: 'comments', label: 'Comments' },
    { id: 'has_voted', label: 'Has Voted' },
    { id: 'dob', label: 'Date of Birth' },
  ];
  
  // Generate and download PDF function
  const handleExportPDF = async (fileName: string) => {
    try {
      setToast({
        message: 'Preparing PDF export...',
        type: 'info',
        visible: true
      });

      // Get the current filtered data from the table
      const filteredData = table.getFilteredRowModel().rows.map(row => row.original);

      if (!filteredData || filteredData.length === 0) {
        setToast({
          message: 'No data to export. Please adjust your filters.',
          type: 'error',
          visible: true
        });
        return;
      }

      // Get visible columns and exclude action column
      const visibleColumns = table.getAllColumns()
        .filter(col => col.getIsVisible() && col.id !== 'actions')
        .map(col => col.id);

      // Create column headers
      const headers = visibleColumns.map(colId => {
        const columnDef = availableColumns.find(c => c.id === colId);
        return columnDef ? columnDef.label : colId;
      });

      // Format row data
      const rows = filteredData.map(voter => {
        return visibleColumns.map(col => {
          const value = voter[col as keyof Voter];
          if (value === null || value === undefined) return '-';
          switch (col) {
            case 'has_voted':
              return value ? 'Yes' : 'No';
            case 'dob':
              return formatDateForExport(value as string);
            default:
              return String(value);
          }
        });
      });

      // Use our new utility function to export the PDF
      exportDataToPDF(
        headers,
        rows,
        'Registered Voters Report',
        fileName || 'registered-voters.pdf',
        'landscape'
      );

      setToast({
        message: 'PDF exported successfully',
        type: 'success',
        visible: true
      });
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      setToast({
        message: err.message || 'Error generating PDF',
        type: 'error',
        visible: true
      });
    }
  };

  // Generate and download Excel function with the current filtered data
  const handleExportExcel = async (fileName: string) => {
    try {
      setToast({
        message: 'Preparing Excel export...',
        type: 'success',
        visible: true
      });
      
      // Get the current filtered data from the table
      const filteredData = table.getFilteredRowModel().rows.map(row => row.original);
      
      if (!filteredData || filteredData.length === 0) {
        setToast({
          message: 'No data to export. Please adjust your filters.',
          type: 'error',
          visible: true
        });
        return;
      }

      // Get the visible columns from the table's state
      const visibleColumns = table.getAllColumns()
        .filter(col => col.getIsVisible())
        .map(col => {
          const id = col.id;
          // Skip the actions column
          if (id === 'actions') return null;
          return id;
        })
        .filter(Boolean) as string[];

      // Create headers for Excel
      const headers = visibleColumns.map(colId => {
        // Find the column definition for better labeling
        const column = columns.find(col => col.id === colId);
        // If it's a custom column with header function, use a fallback
        const headerValue = column?.header || colId;
        
        // Convert the header to a string
        if (typeof headerValue === 'function') {
          return colId; // Fallback to column ID
        }
        return String(headerValue);
      });

      // Extract data for each row
      const rows = filteredData.map(voter => {
        return visibleColumns.map(colId => {
          const value = voter[colId as keyof Voter];
          if (value === null || value === undefined) return '-';

          // Format specific columns
          switch (colId) {
            case 'has_voted':
              return value ? 'Yes' : 'No';
            case 'dob':
              if (!value) return '-';
              try {
                const date = new Date(`${value as string}T12:00:00Z`);
                return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getFullYear()}`;
              } catch (e) {
                return '-';
              }
            default:
              return String(value);
          }
        });
      });

      // Export data to Excel
      exportTableDataToExcel(headers, rows, fileName);

      // Show success message
      setToast({
        message: 'Excel exported successfully',
        type: 'success',
        visible: true
      });
    } catch (err: any) {
      console.error('Error generating Excel:', err);
      setToast({
        message: err.message || 'Error generating Excel',
        type: 'error',
        visible: true
      });
    }
  };

  // Edit and delete functions
  const startEdit = (voter: Voter) => {
    setEditingId(voter.id);
    setEditFormData(voter);
    // Clear modified fields when starting edit
    setModifiedFields(new Set());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
    setModifiedFields(new Set());
  };

  // Handle field change while editing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setModifiedFields(prev => new Set(prev).add(name));
    
    let processedValue: any = value;

    // Handle specific types
    if (name === 'has_voted') {
      processedValue = value === 'true';
    } else if (type === 'number' && name === 'register') { // Assuming 'register' is the only number input for now
      // Allow empty string for clearing, otherwise parse as number
      processedValue = value === '' ? null : parseInt(value, 10); 
      // Handle potential NaN if parsing fails, treat as null
      if (isNaN(processedValue)) {
          processedValue = null; 
      }
    }
    // Add handling for other numeric fields if necessary

    setEditFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  // Handle Add New Voter form input changes
  const handleNewVoterInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let processedValue: any = value;

    // Handle specific types
    if (name === 'has_voted') {
      processedValue = value === 'true';
    } else if (type === 'number' && name === 'register') {
      // Allow empty string for clearing, otherwise parse as number
      processedValue = value === '' ? null : parseInt(value, 10);
      if (isNaN(processedValue)) {
        processedValue = null;
      }
    }

    setNewVoterData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  // Handle submitting the new voter form
  const handleAddVoter = async () => {
    try {
      // Fetch the session and ensure type safety
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData || !sessionData.session || !sessionData.session.user) {
        console.error('No authenticated user found.');
        setToast({
          message: 'You must be logged in to add voters.',
          type: 'error',
          visible: true
        });
        return;
      }

      console.log('Authenticated user ID:', sessionData.session.user.id);

      // Check if user has permission
      if (!hasEditPermission) {
        setToast({
          message: 'You do not have permission to add voters',
          type: 'error',
          visible: true
        });
        return;
      }

      // Validate required fields
      if (!newVoterData.first_name || !newVoterData.last_name) {
        setToast({
          message: 'First name and last name are required',
          type: 'error',
          visible: true
        });
        return;
      }

      // Create full_name field if not provided
      let voterToAdd = { ...newVoterData };
      if (!voterToAdd.full_name && voterToAdd.first_name && voterToAdd.last_name) {
        const fname = voterToAdd.first_name.trim();
        const lname = voterToAdd.last_name.trim();
        voterToAdd.full_name = `${fname} ${lname}`;
      }

      console.log('Adding new voter:', voterToAdd);

      // Attempt to insert the voter
      const { data, error } = await supabase
        .from('avp_voters')
        .insert(voterToAdd)
        .select();

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      // Add the new voter to the local state
      if (data && data.length > 0) {
        setVoters(prev => [...prev, data[0] as Voter]);
      }

      // Close modal and reset form
      setIsAddVoterModalOpen(false);
      setNewVoterData({ has_voted: false });

      // Show success toast
      setToast({
        message: 'Voter added successfully!',
        type: 'success',
        visible: true
      });

    } catch (err: any) {
      console.error('Error adding voter:', err);
      let errorMessage = err.message || 'Failed to add voter';

      // Handle specific error codes
      if (err.code === '42501') {
        errorMessage = 'Permission denied. Ensure your profile has registered_voters_access set to "edit".';
      } else if (err.code === '22007') {
        errorMessage = 'Invalid date format. Please ensure dates are YYYY-MM-DD.';
      } else if (err.message) {
        errorMessage = `Add failed: ${err.message}`;
      }

      setToast({
        message: errorMessage,
        type: 'error',
        visible: true
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editFormData) return;

    try {
      const currentVoter = voters.find(voter => voter.id === editingId);
      if (!currentVoter) {
        throw new Error('Voter not found');
      }

      const changesToSend: Partial<Voter> = {};
      console.log("Starting save process. Modified fields:", modifiedFields); // Log modified fields set

      // Check if we need to regenerate the full_name based on modified name fields
      if (modifiedFields.has('first_name') || modifiedFields.has('father_name') || modifiedFields.has('last_name')) {
        // Take the new values if modified, otherwise use existing values from current voter
        const firstName = editFormData.first_name ?? currentVoter.first_name ?? '';
        const fatherName = editFormData.father_name ?? currentVoter.father_name ?? '';
        const lastName = editFormData.last_name ?? currentVoter.last_name ?? '';
        
        // Generate full name by concatenating names with spaces between non-empty values
        const nameParts = [firstName, fatherName, lastName].filter(part => part.trim().length > 0);
        const generatedFullName = nameParts.join(' ');
        
        // Only update full_name if it actually changed
        if (generatedFullName !== currentVoter.full_name) {
          changesToSend.full_name = generatedFullName;
          console.log(`  -> Generated full_name: "${generatedFullName}" from individual name fields`);
        }
      }

      modifiedFields.forEach(fieldName => {
        // Skip full_name as we handle it separately
        if (fieldName === 'full_name') return;
        
        const field = fieldName as keyof Voter;
        const newValue = editFormData[field];
        const originalValue = currentVoter[field];

        console.log(`Checking field: ${field}, New: ${JSON.stringify(newValue)}, Original: ${JSON.stringify(originalValue)}`); // Log comparison

        // Check if the value has actually changed (strict comparison)
        if (newValue !== originalValue) {
          console.log(`  -> Field ${field} changed. Adding to payload.`); // Log change detection

          // Handle Date of Birth specifically
          if (field === 'dob') {
            if (newValue === '') {
              if (originalValue !== null) {
                changesToSend[field] = null;
                console.log(`    -> Setting ${field} to null`);
              } else {
                 console.log(`    -> ${field} was already null, not sending.`);
              }
            } else {
              changesToSend[field] = newValue;
               console.log(`    -> Setting ${field} to ${newValue}`);
            }
          } else {
            // For other fields, just send the new value
            changesToSend[field] = newValue;
             console.log(`    -> Setting ${field} to ${newValue}`);
          }
        } else {
           console.log(`  -> Field ${field} did NOT change.`); // Log no change
        }
      });

      // Final check: Ensure dob is not an empty string if it somehow got added
      // This is a safeguard against unexpected states.
      if (changesToSend.dob === '') {
         // If the original was null, remove dob entirely from the payload.
         // If the original was not null, explicitly set it to null.
         if (currentVoter.dob === null) {
            delete changesToSend.dob;
         } else {
            changesToSend.dob = null;
         }
      }

      // Log the final payload right before sending
      console.log('Final changes being sent to API:', changesToSend);

      if (Object.keys(changesToSend).length === 0) {
        console.log('No actual changes detected after validation, cancelling save.');
        setEditingId(null);
        setEditFormData({});
        setModifiedFields(new Set());
        return;
      }

      const { error } = await supabase
        .from('avp_voters')
        .update(changesToSend) // Use the carefully constructed changesToSend
        .eq('id', editingId)
        .select();

      if (error) {
        // Log the error along with the payload that caused it for better debugging
        console.error('Error updating voter. Payload:', changesToSend, 'Error:', error);
        throw error;
      }

      // Update local state optimistically using the final payload
      setVoters(prev =>
        prev.map(voter =>
          voter.id === editingId ? { ...voter, ...changesToSend } : voter
        )
      );

      // Clear edit state
      setEditingId(null);
      setEditFormData({});
      setModifiedFields(new Set());

      // Show success toast
      setToast({
        message: 'Voter updated successfully!',
        type: 'success',
        visible: true
      });

    } catch (err: any) {
      // Enhanced error logging
      console.error('Caught error in handleSaveEdit:', err);
      let errorMessage = err.message || 'Failed to update voter';
      if (err.code === '22007') {
        errorMessage = 'Invalid date format. Please ensure dates are YYYY-MM-DD or leave blank.';
      } else if (err.message) {
         errorMessage = `Update failed: ${err.message}`;
      }
      // Include error code/details if available
      if (err.code || err.details) {
        errorMessage += ` (Code: ${err.code || 'N/A'}, Details: ${err.details || 'N/A'})`;
      }
      setToast({
        message: errorMessage,
        type: 'error',
        visible: true
      });
    }
  };

  const confirmDelete = (voter: Voter) => {
    setVoterToDelete(voter);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!voterToDelete) return;
    
    try {
      const { error } = await supabase
        .from('avp_voters')
        .delete()
        .eq('id', voterToDelete.id);

      if (error) throw error;

      // Update local state to avoid full refetch
      setVoters(prev => prev.filter(voter => voter.id !== voterToDelete.id));

      // Close modal and reset state
      setDeleteModalOpen(false);
      setVoterToDelete(null);

      // Show success toast
      setToast({
        message: 'Voter deleted successfully!',
        type: 'success',
        visible: true
      });

    } catch (err: any) {
      console.error('Error deleting voter:', err);
      setToast({
        message: err.message || 'Failed to delete voter',
        type: 'error',
        visible: true
      });
      
      // Close modal anyway to prevent user from being stuck
      setDeleteModalOpen(false);
      setVoterToDelete(null);
    }
  };

  const closeToast = () => {
    setToast(null);
  };

  // Use media query for initial view mode only
  useEffect(() => {
    const handleResize = () => {
      // Only change view mode automatically if user hasn't explicitly selected one
      if (!userSelectedViewMode.current) {
        if (window.innerWidth < 768) {
          setViewMode('card');
        } else {
          setViewMode('table');
        }
      }
    };
    
    // Set initial view mode
    handleResize();
    
    // Only attach resize listener, not scroll listener
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Define table columns using TanStack Table helpers
  const columnHelper = createColumnHelper<Voter>();
  const columns = useMemo(() => [
    // Add actions column with edit and delete buttons if user has edit permissions
    ...(hasEditPermission ? [
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const voter = row.original;
          
          if (editingId === voter.id) {
            return (
              <div className="flex space-x-3">
                <button 
                  onClick={() => handleSaveEdit()}
                  className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
                  title="Save"
                >
                  <i className="fas fa-save text-lg"></i>
                </button>
                <button 
                  onClick={() => cancelEdit()}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
                  title="Cancel"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>
            );
          }
          
          return (
            <div className="flex space-x-3">
              <button 
                onClick={() => startEdit(voter)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                title="Edit"
              >
                <i className="fas fa-edit text-lg"></i>
              </button>
              <button 
                onClick={() => confirmDelete(voter)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                title="Delete"
              >
                <i className="fas fa-trash-alt text-lg"></i>
              </button>
            </div>
          );
        }
      }),
      columnHelper.accessor('situation', {
        header: 'Situation',
        cell: info => {
          const voter = info.row.original;
          if (editingId === voter.id) {
            return (
              <select
                name="situation"
                value={editFormData.situation ?? voter.situation ?? ''}
                onChange={handleInputChange}
                className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
              >
                <option value="">Select...</option>
                {situationOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            );
          }

          const value = info.getValue();
          const colorClass = value === 'WITH' ? 'text-green-600 dark:text-green-400' :
                            value === 'AGAINST' ? 'text-red-600 dark:text-red-400' :
                            value === 'NEUTRAL' ? 'text-blue-500 dark:text-blue-300' :
                            value === 'NEUTRAL+' ? 'text-indigo-500 dark:text-indigo-300' :
                            value === 'DEATH' ? 'text-gray-600 dark:text-gray-400' :
                            value === 'IMMIGRANT' ? 'text-yellow-600 dark:text-yellow-400' :
                            value === 'MILITARY' ? 'text-purple-600 dark:text-purple-400' :
                            value === 'NO_VOTE' ? 'text-orange-600 dark:text-orange-400' :
                            value === 'UNKNOWN' ? 'text-gray-500 dark:text-gray-400' :
                            'text-gray-700 dark:text-gray-300';

          return (
            <span className={`${colorClass} font-medium`}>{value || '-'}</span>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue) return true;
          const value = row.getValue(columnId);
          // Use exact matching instead of substring matching
          return String(value) === String(filterValue);
        },
      }),
    ] : []),
    columnHelper.accessor('full_name', { 
      header: 'Full Name', 
      cell: info => {
        const voter = info.row.original;
        // For full_name, we don't provide an edit input as it will be auto-generated
        if (editingId === voter.id) {
          return (
            <div className="text-gray-500 dark:text-gray-400 italic">
              {editFormData.first_name ?? voter.first_name ?? ''} {editFormData.father_name ?? voter.father_name ?? ''} {editFormData.last_name ?? voter.last_name ?? ''}
              <div className="text-xs">(Generated automatically)</div>
            </div>
          );
        }
        return info.getValue();
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('alliance', { 
      header: 'Alliance', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <input
              type="text"
              name="alliance"
              value={editFormData.alliance ?? voter.alliance ?? ''}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          );
        }
        return info.getValue() ?? '-';
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        // Use exact matching instead of substring matching
        return String(value) === String(filterValue);
      },
    }),
    columnHelper.accessor('family', { 
      header: 'Family', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <input
              type="text"
              name="family"
              value={editFormData.family ?? voter.family ?? ''}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          );
        }
        return info.getValue() ?? '-';
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        // Use exact matching instead of substring matching
        return String(value) === String(filterValue);
      },
    }),
    columnHelper.accessor('register', { 
      header: 'Register', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <input
              type="number" // Use number type for register
              name="register"
              value={editFormData.register ?? voter.register ?? ''}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          );
        }
        return info.getValue() ?? '-';
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        // Compare as numbers
        return String(value) === filterValue;
      },
    }),
    columnHelper.accessor('register_sect', { 
      header: 'Register Sect', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <input
              type="text"
              name="register_sect"
              value={editFormData.register_sect ?? voter.register_sect ?? ''}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          );
        }
        return info.getValue() ?? '-';
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        // Use exact matching instead of substring matching
        return String(value) === String(filterValue);
      },
    }),
    columnHelper.accessor('gender', { 
      header: 'Gender', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          // Assuming gender has specific values, a select might be better
          return (
            <select
              name="gender"
              value={editFormData.gender ?? voter.gender ?? ''}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            >
              <option value="">Select...</option>
              <option value="الذكور">الذكور</option>
              <option value="الإناث">الإناث</option>
              {/* Add other options if needed */}
            </select>
          );
        }
        return info.getValue() ?? '-';
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        return String(value) === filterValue;
      },
    }),
    columnHelper.accessor('first_name', { 
      header: 'First Name', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <input
              type="text"
              name="first_name"
              value={editFormData.first_name ?? voter.first_name ?? ''}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          );
        }
        return info.getValue() ?? '-';
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        // Use exact matching instead of substring matching
        return String(value) === String(filterValue);
      },
    }),
    columnHelper.accessor('father_name', { 
      header: 'Father Name', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <input
              type="text"
              name="father_name"
              value={editFormData.father_name ?? voter.father_name ?? ''}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          );
        }
        return info.getValue() ?? '-';
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        // Use exact matching instead of substring matching
        return String(value) === String(filterValue);
      },
    }),
    columnHelper.accessor('last_name', { 
      header: 'Last Name', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <input
              type="text"
              name="last_name"
              value={editFormData.last_name ?? voter.last_name ?? ''}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          );
        }
        return info.getValue() ?? '-';
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('mother_name', { 
      header: 'Mother Name', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <input
              type="text"
              id="mother_name"
              name="mother_name"
              value={editFormData.mother_name || ''}
              onChange={handleNewVoterInputChange}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            />
          );
        }
        return info.getValue() ?? '-';
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        // Use exact matching instead of substring matching
        return String(value) === String(filterValue);
      },
    }),
    columnHelper.accessor('dob', { 
      header: 'DOB', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <input
              type="date" // Use date type for dob
              name="dob"
              value={editFormData.dob ?? voter.dob ?? ''}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          );
        }
        return formatDate(info.getValue() as string);
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const dobString = row.getValue(columnId) as string;
        if (filterValue === '__EMPTY__') return !dobString;
        if (!dobString) return false;
        try {
          const date = new Date(`${dobString}T12:00:00Z`);
          const dobYear = date.getUTCFullYear().toString();
          return dobYear === filterValue;
        } catch (e) {
          console.error("Error parsing date for filtering:", dobString, e);
          return false;
        }
      },
    }),
    columnHelper.accessor('sect', { 
      header: 'Sect', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <input
              type="text"
              name="sect"
              value={editFormData.sect ?? voter.sect ?? ''}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          );
        }
        return info.getValue() ?? '-';
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        // Use exact matching instead of substring matching
        return String(value) === String(filterValue);
      },
    }),
    columnHelper.accessor('residence', { 
      header: 'Residence', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <input
              type="text"
              name="residence"
              value={editFormData.residence ?? voter.residence ?? ''}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          );
        }
        return info.getValue() ?? '-';
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        // Use exact matching instead of substring matching
        return String(value) === filterValue;
      },
    }),
    columnHelper.accessor('has_voted', { 
      header: 'Has Voted', 
      cell: info => {
        const voter = info.row.original;
        if (editingId === voter.id) {
          return (
            <select
              name="has_voted"
              // Ensure value is string for select comparison
              value={editFormData.has_voted !== undefined ? String(editFormData.has_voted) : (voter.has_voted !== null ? String(voter.has_voted) : 'false')}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          );
        }
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            info.getValue() 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {info.getValue() ? 'Yes' : 'No'}
          </span>
        );
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: 'equals',
    }),
    // ...existing code...
  ], [columnHelper, hasEditPermission, editingId, editFormData, handleInputChange]);

  // Fetch voters function
  const fetchVoters = async () => {
    // No need to set loading true here if it's called by updates
    setError(null);

    try {
      // Select all required columns explicitly
      const { data, error: fetchError } = await supabase
        .from('avp_voters')
        .select('id, alliance, family, register, register_sect, gender, first_name, father_name, last_name, mother_name, full_name, situation, dob, sect, residence, has_voted')
        .order('register', { ascending: true })
        .order('register_sect', { ascending: true })
        .order('full_name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // Type assertion to tell TypeScript that this data matches our Voter interface
      setVoters(data as Voter[] || []);
      
      // Fetch distinct situation values
      const { data: situationData, error: situationError } = await supabase
        .from('avp_voters')
        .select('situation')
        .not('situation', 'is', null);
        
      if (!situationError && situationData) {
        // Extract unique situation values
        const uniqueSituations = Array.from(
          new Set(situationData.map(item => item.situation).filter(Boolean))
        ).sort() as string[];
        setSituationOptions(uniqueSituations);
      }

    } catch (err: any) {
      console.error('Error fetching voters:', err);
      setError(err.message || 'Failed to fetch voters. Check RLS policies and network.');
      setVoters([]); // Clear voters on error
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (profile?.registered_voters_access === 'none') {
      setError('You do not have permission to view this page.');
      setLoading(false);
      return;
    }

    setLoading(true); // Set loading true for the initial fetch
    
    // Fetch initial data
    fetchVoters()
      .then(() => {
      })
      .catch(err => {
        console.error('Initial data fetch error:', err);
      })
      .finally(() => {
        setLoading(false);
      });

  }, [profile]); // Rerun effect if profile changes

  // Initialize the table instance
  const table = useReactTable({
    data: voters,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false, // Prevent page reset when filters or sorting change
    initialState: {
      pagination: {
        pageSize: 50, // Default page size
      },      
    },
  });

  // Loading skeleton UI
  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-900 min-h-screen">
        <div className="mb-6">
          <div className="h-10 w-72 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-6"></div>
          <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-8"></div>
        </div>
        
        <div className="border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-4">
            <div className="flex justify-between">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse my-2 w-32"></div>
              ))}
            </div>
          </div>
          
          <div className="divide-y dark:divide-gray-700">
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div key={rowIndex} className="py-4 px-6 animate-pulse">
                <div className="flex justify-between items-center mb-3">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md w-48"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, colIndex) => (
                    <div key={colIndex} className="h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-full"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center bg-white dark:bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-700 p-6 rounded-lg shadow-sm max-w-lg">
          <div className="flex items-center">
            <i className="fas fa-exclamation-circle h-8 w-8 text-red-500 dark:text-red-400 mr-3"></i>
            <p className="text-red-700 dark:text-red-200 text-lg font-medium">{error}</p>
          </div>
          <p className="mt-3 text-red-600 dark:text-red-300 text-sm">Please try refreshing the page or contact an administrator.</p>
        </div>
      </div>
    );
  }

  // Calculate voted stats based on filtered data instead of all data
  const filteredRows = table.getFilteredRowModel().rows;
  const filteredVotersCount = filteredRows.length;
  const filteredVotedCount = filteredRows.filter(row => row.original.has_voted).length;
  const filteredVotingRate = filteredVotersCount > 0 ? Math.round((filteredVotedCount / filteredVotersCount) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-900 min-h-screen">
      {/* Toast notification */}
      {toast && toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
      
      {/* Export PDF Modal */}
      <SimplePDFModal
        isOpen={exportPdfModalOpen}
        onClose={() => setExportPdfModalOpen(false)}
        onExport={handleExportPDF}
        defaultFileName="RegisteredVoters_Report.pdf"
      />
      
      {/* Export Excel Modal */}
      <ExportExcelModal
        isOpen={exportExcelModalOpen}
        onClose={() => setExportExcelModalOpen(false)}
        onExport={handleExportExcel}
        defaultFileName="RegisteredVoters.xlsx"
      />
      
      {/* Floating Action Button (FAB) for adding voters */}
      {hasEditPermission && (
        <button
          onClick={() => setIsAddVoterModalOpen(true)}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center z-20 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          title="Add New Voter"
          aria-label="Add New Voter"
        >
          <i className="fas fa-plus text-sm"></i>
        </button>
      )}
      
      <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">Registered Voters</h2>
      <div className="flex flex-row justify-between items-center mb-6">
        <p className="text-gray-600 dark:text-gray-400">Manage and monitor registered voters</p>
        
        
      </div>
      
      {/* Stats Section - Updated to use filtered data */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-blue-100 dark:border-blue-900">
          <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Voters</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{filteredVotersCount}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-green-100 dark:border-green-900">
          <div className="rounded-full bg-green-100 dark:bg-green-900 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Voted</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{filteredVotedCount}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-2">Participation Rate</p>
          <div className="flex items-center justify-between mb-1">
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{filteredVotingRate}%</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{filteredVotedCount} of {filteredVotersCount}</p>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full" 
              style={{ width: `${filteredVotingRate}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6 border border-blue-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          {/* View Mode Buttons - moved to the left */}
          <div className="flex bg-gray-50 dark:bg-gray-700 rounded-lg p-1 shadow-inner">
            <button
              onClick={() => {
                userSelectedViewMode.current = true;
                setViewMode('card');
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'card'
                  ? 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <div className="flex items-center">
                <i className="fas fa-th-large mr-1.5"></i>
                Cards
              </div>
            </button>

            <button
              onClick={() => {
                userSelectedViewMode.current = true;
                setViewMode('table');
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              <div className="flex items-center">
                <i className="fas fa-table mr-1.5"></i>
                Table
              </div>
            </button>
          </div>

          {/* Export buttons - moved to the far right */}
          <div className="flex items-center space-x-2 justify-end">
            <button
              onClick={() => setExportPdfModalOpen(true)}
              className="h-8 px-2 py-0 text-sm rounded flex items-center text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 focus:outline-none"
              aria-label="Export PDF"
              title="Export PDF"
            >
              <i className="fas fa-file-pdf text-base"></i>
              <span className="ml-1">PDF</span>
            </button>
            <button
              onClick={() => setExportExcelModalOpen(true)}
              className="h-8 px-2 py-0 text-sm rounded flex items-center text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 focus:outline-none"
              aria-label="Export Excel"
              title="Export Excel"
            >
              <i className="fas fa-file-excel text-base"></i>
              <span className="ml-1">Excel</span>
            </button>
          </div>
        </div>
        
        {viewMode === 'table' && (
          <div className="overflow-x-auto shadow-sm rounded-lg border border-blue-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
              <thead className="bg-gray-50 dark:bg-gray-800">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id} 
                        scope="col" 
                        className="px-6 py-3.5 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider whitespace-nowrap min-w-[100px]"
                      >
                        <div className="flex items-center">
                          <div
                            className={`cursor-pointer whitespace-nowrap flex items-center ${header.column.getCanSort() ? 'group' : ''}`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                            {/* Sorting indicators with FontAwesome icons for better visibility */}
                            {header.column.getIsSorted() === 'asc' && (
                              <i className="fas fa-sort-up ml-2 text-blue-600 dark:text-blue-400 text-lg"></i>
                            )}
                            {header.column.getIsSorted() === 'desc' && (
                              <i className="fas fa-sort-down ml-2 text-blue-600 dark:text-blue-400 text-lg"></i>
                            )}
                            {/* Add indicator for sortable columns that are not currently sorted */}
                            {header.column.getCanSort() && !header.column.getIsSorted() && (
                              <i className="fas fa-sort ml-2 text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity"></i>
                            )}
                          </div>
                        </div>
                        
                        {/* Add column filters */}
                        {header.column.getCanFilter() ? (
                          <div className="mt-2">
                            {/* Use SearchFilter for all columns except 'dob' */}
                            {header.column.id === 'dob' ? (
                              <YearFilter column={header.column} table={table} />
                            ) : header.column.id === 'has_voted' ? (
                              <select
                                value={header.column.getFilterValue() === undefined ? "" : header.column.getFilterValue() === true ? "true" : "false"}
                                onChange={e => {
                                  let value: boolean | undefined = undefined;
                                  if (e.target.value === 'true') value = true;
                                  if (e.target.value === 'false') value = false;
                                  header.column.setFilterValue(value);
                                }}
                                className="w-full px-2 py-1 text-xs border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                              >
                                <option value="">All</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            ) : header.column.id === 'register' ? (
                              <SearchFilter type="exactMatch" column={header.column} table={table} />
                            ) : header.column.id === 'family' || header.column.id === 'gender' || header.column.id === 'sect' || header.column.id === 'register_sect' || header.column.id === 'alliance' || header.column.id === 'situation' ? (
                              <SearchFilter type="select" column={header.column} table={table} />
                            ) : (
                              <SearchFilter type="text" column={header.column} table={table} />
                            )}
                          </div>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td 
                        key={cell.id} 
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {viewMode === 'card' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {table.getRowModel().rows.map(row => {
              const voter = row.original;
              return (
                <div key={row.id} 
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border 
                    ${voter.has_voted 
                      ? 'border-l-4 border-green-500 hover:shadow-green-100/80 dark:hover:shadow-green-900/30' 
                      : 'border-l-4 border-blue-500 hover:shadow-blue-100/80 dark:hover:shadow-blue-900/30'} 
                    p-5 hover:shadow-md transition-all duration-200 dark:border-r dark:border-t dark:border-b dark:border-gray-700`}>
                  
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 truncate">{voter.full_name}</h3>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      voter.has_voted 
                        ? 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700' 
                        : 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700'
                    }`}>
                      {voter.has_voted ? 'Voted' : 'Not Voted'}
                    </span>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-3">
                    {voter.dob && (
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center text-blue-600 dark:text-blue-400">
                          <i className="fas fa-calendar-day h-4 w-4 mr-1.5"></i>
                          <span className="text-xs font-medium">DOB:</span>
                        </div>
                        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{formatDate(voter.dob!)}</span>
                      </div>
                    )}
                    
                    {voter.gender && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-blue-600 dark:text-blue-400">
                          <i className="fas fa-user h-4 w-4 mr-1.5"></i>
                          <span className="text-xs font-medium">Gender:</span>
                        </div>
                        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{voter.gender}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                    {voter.family && (
                      <div className="col-span-1">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Family</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{voter.family}</p>
                      </div>
                    )}
                    
                    {voter.alliance && (
                      <div className="col-span-1">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Alliance</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{voter.alliance}</p>
                      </div>
                    )}
                    
                    {voter.register && (
                      <div className="col-span-1">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Register</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{voter.register}</p>
                      </div>
                    )}
                    
                    {voter.register_sect && (
                      <div className="col-span-1">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Reg. Sect</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{voter.register_sect}</p>
                      </div>
                    )}
                    
                    {voter.sect && (
                      <div className="col-span-1">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Sect</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{voter.sect}</p>
                      </div>
                    )}
                    
                    {voter.residence && (
                      <div className="col-span-1">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Residence</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{voter.residence || 'RESIDENT'}</p>
                      </div>
                    )}
                    
                    {voter.father_name && (
                      <div className="col-span-1">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Father</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{voter.father_name}</p>
                      </div>
                    )}
                    
                    {voter.mother_name && (
                      <div className="col-span-1">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Mother</p>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{voter.mother_name}</p>
                      </div>
                    )}
                  </div>
                  
                  {voter.situation && (
                    <div className="mt-2 pt-3 border-t border-blue-100 dark:border-gray-700">
                      <div className="flex items-center mb-1">
                        <i className="fas fa-info-circle h-4 w-4 text-blue-600 dark:text-blue-400 mr-1.5"></i>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Situation</p>
                      </div>
                      <p className={`text-sm font-medium ${
                        voter.situation === 'AGAINST' 
                          ? 'text-red-600 dark:text-red-400' 
                          : voter.situation === 'WITH' 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {voter.situation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Pagination Controls */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span>
              Showing <span className="font-semibold text-blue-900 dark:text-blue-300">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{" "}
              <span className="font-semibold text-blue-900 dark:text-blue-300">
                {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredVotersCount)}
              </span> of{" "}
              <span className="font-semibold text-blue-900 dark:text-blue-300">{filteredVotersCount}</span> voters
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              aria-label="Go to first page"
              title="First page"
            >
              <i className="fas fa-angle-double-left w-5 h-5"></i>
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              aria-label="Go to previous page"
              title="Previous page"
            >
              <i className="fas fa-angle-left w-5 h-5"></i>
            </button>

            <div className="hidden sm:flex items-center">
              {Array.from({length: Math.min(5, table.getPageCount())}, (_, i) => {
                const pageIndex = table.getState().pagination.pageIndex;
                let showPage: number;
                
                if (table.getPageCount() <= 5) {
                  showPage = i;
                } else if (pageIndex < 3) {
                  showPage = i;
                } else if (pageIndex > table.getPageCount() - 4) {
                  showPage = table.getPageCount() - 5 + i;
                } else {
                  showPage = pageIndex - 2 + i;
                }
                
                return (
                  <button
                    key={showPage}
                    onClick={() => table.setPageIndex(showPage)}
                    disabled={pageIndex === showPage}
                    className={`px-3.5 py-2 mx-1 rounded-md text-sm font-medium border transition-colors ${
                      pageIndex === showPage 
                        ? 'bg-blue-600 dark:bg-blue-800 text-white border-blue-600 dark:border-blue-800' 
                        : 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                    }`}
                    aria-label={`Go to page ${showPage + 1}`}
                    aria-current={pageIndex === showPage ? 'page' : undefined}
                  >
                    {showPage + 1}
                  </button>
                );
              })}
            </div>
            
            <div className="sm:hidden flex items-center">
              <span className="px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 font-medium">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
            </div>

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              aria-label="Go to next page"
              title="Next page"
            >
              <i className="fas fa-angle-right w-5 h-5"></i>
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              aria-label="Go to last page"
              title="Last page"
            >
              <i className="fas fa-angle-double-right w-5 h-5"></i>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Per page:
              <select
                value={table.getState().pagination.pageSize}
                onChange={e => {
                  table.setPageSize(Number(e.target.value));
                }}
                className="ml-2 px-3 py-1.5 text-sm border border-blue-200 dark:border-blue-800 rounded-md bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {[5, 10, 20, 30, 50].map(pageSize => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for delete */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Voter"
        message={voterToDelete ? `Are you sure you want to delete ${voterToDelete.full_name}? This action cannot be undone.` : 'Are you sure you want to delete this voter?'}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
      />
      
      {/* Add Voter Modal */}
      {isAddVoterModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg md:max-w-2xl sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300">Add New Voter</h3>
                  <button 
                    onClick={() => setIsAddVoterModalOpen(false)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    aria-label="Close"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div className="form-group">
                    <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="first_name"
                      name="first_name"
                      value={newVoterData.first_name || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  
                  {/* Last Name */}
                  <div className="form-group">
                    <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="last_name"
                      name="last_name"
                      value={newVoterData.last_name || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  
                  {/* Father Name */}
                  <div className="form-group">
                    <label htmlFor="father_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Father Name
                    </label>
                    <input
                      type="text"
                      id="father_name"
                      name="father_name"
                      value={newVoterData.father_name || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Mother Name */}
                  <div className="form-group">
                    <label htmlFor="mother_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mother Name
                    </label>
                    <input
                      type="text"
                      id="mother_name"
                      name="mother_name"
                      value={newVoterData.mother_name || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Family */}
                  <div className="form-group">
                    <label htmlFor="family" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Family
                    </label>
                    <input
                      type="text"
                      id="family"
                      name="family"
                      value={newVoterData.family || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Alliance */}
                  <div className="form-group">
                    <label htmlFor="alliance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Alliance
                    </label>
                    <input
                      type="text"
                      id="alliance"
                      name="alliance"
                      value={newVoterData.alliance || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Register */}
                  <div className="form-group">
                    <label htmlFor="register" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Register
                    </label>
                    <input
                      type="number"
                      id="register"
                      name="register"
                      value={newVoterData.register || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Register Sect */}
                  <div className="form-group">
                    <label htmlFor="register_sect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Register Sect
                    </label>
                    <input
                      type="text"
                      id="register_sect"
                      name="register_sect"
                      value={newVoterData.register_sect || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Gender */}
                  <div className="form-group">
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Gender
                    </label>
                    <select
                      id="gender"
                      name="gender"
                      value={newVoterData.gender || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select...</option>
                      <option value="الذكور">الذكور</option>
                      <option value="الإناث">الإناث</option>
                      {/* Add other options if needed */}
                    </select>
                  </div>
                  
                  {/* Date of Birth */}
                  <div className="form-group">
                    <label htmlFor="dob" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      id="dob"
                      name="dob"
                      value={newVoterData.dob || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Sect */}
                  <div className="form-group">
                    <label htmlFor="sect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Sect
                    </label>
                    <input
                      type="text"
                      id="sect"
                      name="sect"
                      value={newVoterData.sect || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Residence */}
                  <div className="form-group">
                    <label htmlFor="residence" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Residence
                    </label>
                    <input
                      type="text"
                      id="residence"
                      name="residence"
                      value={newVoterData.residence || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {/* Has Voted */}
                  <div className="form-group">
                    <label htmlFor="has_voted" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Has Voted
                    </label>
                    <select
                      id="has_voted"
                      name="has_voted"
                      value={String(newVoterData.has_voted)}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  
                  {/* Situation */}
                  <div className="form-group">
                    <label htmlFor="situation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Situation
                    </label>
                    <select
                      id="situation"
                      name="situation"
                      value={newVoterData.situation || ''}
                      onChange={handleNewVoterInputChange}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select...</option>
                      {situationOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex flex-row-reverse sm:px-6 gap-2">
                <button
                  type="button"
                  onClick={handleAddVoter}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-800"
                >
                  Add Voter
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddVoterModalOpen(false)}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Filter components moved outside RegisteredVoters to prevent re-creation on every render

// Year Filter component for DOB column
const YearFilter: React.FC<{ column: any; table: any }> = React.memo(({ column, table }) => {
  const columnFilterValue = column.getFilterValue() ?? '';
  const yearOptions = React.useMemo(() => {
    const dobValues = table.getPreFilteredRowModel().flatRows
      .map((row: any) => row.getValue(column.id))
      .map((dob: string | null) => {
        if (!dob) return '__EMPTY__';
        try {
          return new Date(`${dob}T12:00:00Z`).getUTCFullYear();
        } catch {
          return '__EMPTY__';
        }
      });
    const set = new Set(dobValues);
    return Array.from(set).sort((a: any, b: any) => {
      if (a === '__EMPTY__') return -1;
      if (b === '__EMPTY__') return 1;
      return Number(a) - Number(b);
    });
  }, [column.id, table.getPreFilteredRowModel().flatRows]);
  
  return (
    <select
      value={columnFilterValue}
      onChange={e => column.setFilterValue(e.target.value)}
      className="w-full px-2 py-1 text-xs border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
    >
      <option value="">All Years</option>
      {(yearOptions as Array<string | number>).map((year) => (
        <option key={String(year)} value={String(year)}>
          {year === '__EMPTY__' ? '-' : year}
        </option>
      ))}
    </select>
  );
});

export default RegisteredVoters;
