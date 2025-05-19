import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useRealtime } from '../lib/useRealtime'; // Import useRealtime hook
import SearchFilter from '../components/SearchFilter';  // Import the SearchFilter component
import Toast from '../components/Toast'; // Import shared Toast component
import { 
  createColumnHelper, 
  useReactTable, 
  getCoreRowModel, 
  getFilteredRowModel, 
  getSortedRowModel, 
  getPaginationRowModel, 
  SortingState, 
  ColumnFiltersState,
  flexRender} from '@tanstack/react-table';
import ExportPDFModal from '../components/ExportPDFModal';
import ExportExcelModal from '../components/ExportExcelModal'; // Import ExcelModal
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; // Import autoTable directly
import { amiriRegularBase64 } from '../assets/fonts/Amiri-Regular-normal'; // Import the font
import { exportTableDataToExcel } from '../utils/excelExport'; // Import Excel export functions

// Define interface for voter data
interface Voter {
  id: number;
  full_name: string | null;
  register: number | null;
  register_sect: string | null;
  comments: string | null;
  has_voted: boolean | null;
  gender: string | null;
  voting_time?: string | null;
  situation?: string | null;
  family?: string | null; // Add family field
}

// Define custom column meta type that includes our filterComponent
interface CustomColumnMeta {
  filterComponent?: () => React.ReactNode;
}

// Declare module augmentation to extend the @tanstack/react-table types
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends unknown, TValue> extends CustomColumnMeta {}
}

// Filter components for table columns
// Text Filter component for text-based columns
const TextFilter: React.FC<{ column: any; table: any }> = React.memo(({ column }) => {
  const columnFilterValue = column.getFilterValue() ?? '';
  return (
    <input
      type="text"
      value={columnFilterValue}
      onChange={e => column.setFilterValue(e.target.value)}
      placeholder={`Filter...`}
      className="w-full px-2 py-1 text-xs border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
    />
  );
});

// Select Filter component for columns with finite options
const SelectFilter: React.FC<{ column: any; table: any }> = React.memo(({ column, table }) => {
  const columnFilterValue = column.getFilterValue() ?? '';
  const sortedUniqueValues = React.useMemo(() => {
    if (!table) return [];
    
    const values = table.getPreFilteredRowModel().flatRows
      .map((row: any) => row.getValue(column.id))
      .map((v: any) => (v === null || v === undefined || v === '' ? '__EMPTY__' : v));
    
    const set = new Set(values);
    const arr = Array.from(set);
    
    // For 'register', sort numerically (empty first)
    if (column.id === 'register') {
      return arr.sort((a, b) => {
        if (a === '__EMPTY__') return -1;
        if (b === '__EMPTY__') return 1;
        return Number(a) - Number(b);
      });
    }
    
    // Default sort
    return arr.sort((a, b) => {
      if (a === '__EMPTY__') return -1;
      if (b === '__EMPTY__') return 1;
      return String(a).localeCompare(String(b));
    });
  }, [column.id, table]);
  
  return (
    <select
      value={columnFilterValue}
      onChange={e => column.setFilterValue(e.target.value)}
      className="w-full px-2 py-1 text-xs border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
    >
      <option value="">All</option>
      {sortedUniqueValues.map((value) => (
        <option key={value as string} value={value as string}>
          {value === '__EMPTY__' ? '-' : (value as string)}
        </option>
      ))}
    </select>
  );
});

// Boolean Filter component for has_voted
const BooleanFilter: React.FC<{ column: any; table: any }> = React.memo(({ column }) => {
  const columnFilterValue = column.getFilterValue();
  
  return (
    <select
      value={columnFilterValue === undefined ? "" : String(columnFilterValue)}
      onChange={e => {
        let value: boolean | undefined = undefined;
        if (e.target.value === 'true') value = true;
        if (e.target.value === 'false') value = false;
        column.setFilterValue(value);
      }}
      className="w-full px-2 py-1 text-xs border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
    >
      <option value="">All</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
  );
});

const VotingDay: React.FC = () => {
  const { profile, session } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Voters table state
  const [voters, setVoters] = useState<Voter[]>([]);
  const [votersLoading, setVotersLoading] = useState<boolean>(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  
  // Export PDF modal state
  const [exportPdfModalOpen, setExportPdfModalOpen] = useState(false);
  
  // Export Excel modal state
  const [exportExcelModalOpen, setExportExcelModalOpen] = useState(false);

  // Comment modal state
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);
  const [commentText, setCommentText] = useState('');
  
  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    visible: boolean;
  } | null>(null);

  // Dropdown options for filter (populated on data load)
  const [registerSectOptions, setRegisterSectOptions] = useState<string[]>([]);
  const [genderOptions, setGenderOptions] = useState<string[]>([]);
  const [registerOptions, setRegisterOptions] = useState<string[]>([]);
  const [familyOptions, setFamilyOptions] = useState<string[]>([]); // Added family options
  
  // Determine permissions and which voters to show
  const hasEditPermission = profile?.voting_day_access?.includes('edit') || false;

  // Setup real-time updates with useRealtime hook
  useRealtime({
    table: 'avp_voters',
    event: 'UPDATE',
    onChange: (payload) => {
      // Simply update the voters state with the new data
      const updatedVoter = payload.new as Voter;
      
      setVoters(prev => 
        prev.map(voter => 
          voter.id === updatedVoter.id ? { ...voter, ...updatedVoter } : voter
        )
      );
    }
  });
  
  // Get gender filter based on permission
  const getGenderFilter = () => {
    if (!profile || !profile.voting_day_access) return null;
    
    const accessType = profile.voting_day_access;
    
    if (accessType === 'view female' || accessType === 'edit female') {
      return 'الإناث'; // Female
    } else if (accessType === 'view male' || accessType === 'edit male') {
      return 'الذكور'; // Male
    }
    
    return null; // For 'view both' and 'edit both', return null to show all
  };

  // Open comment modal for a voter
  const handleOpenCommentModal = (voter: Voter) => {
    setSelectedVoter(voter);
    setCommentText(voter.comments || '');
    setCommentModalOpen(true);
  };

  // Close comment modal
  const handleCloseCommentModal = () => {
    setCommentModalOpen(false);
    setSelectedVoter(null);
    setCommentText('');
  };

  // Save comment for voter
  const handleSaveComment = async () => {
    if (!selectedVoter) return;

    try {
      const { error } = await supabase
        .from('avp_voters')
        .update({ comments: commentText })
        .eq('id', selectedVoter.id);
      
      if (error) throw error;
      
      // Update local state
      setVoters(prev => prev.map(voter => 
        voter.id === selectedVoter.id ? { ...voter, comments: commentText } : voter
      ));
      
      setToast({
        message: 'Comment saved successfully',
        type: 'success',
        visible: true
      });
      
      // Close the modal
      handleCloseCommentModal();
    } catch (err: any) {
      console.error('Error saving comment:', err);
      setToast({
        message: err.message || 'Error saving comment',
        type: 'error',
        visible: true
      });
    }
  };

  // Generate and download PDF function
  const handleExportPDF = async (selectedFamilies: string[], selectedColumns: string[], fileName: string) => { // Removed registerSects parameter
    try {
      setToast({
        message: 'Preparing PDF export...',
        type: 'success',
        visible: true
      });

      // Fetch fresh data from the database for the selected families
      let query = supabase
        .from('avp_voters')
        .select(selectedColumns.join(', ')) // Only select the columns we need
        .eq('has_voted', false); // Only get voters who haven't voted yet

      // Filter by the selected families (if any)
      if (selectedFamilies.length > 0) {
        query = query.in('family', selectedFamilies);
      }

      // Apply gender filter based on permissions if needed
      const genderFilter = getGenderFilter();
      if (genderFilter) {
        query = query.eq('gender', genderFilter);
      }
      
      const { data: filteredData, error } = await query;
      
      if (error) throw error;

      if (!filteredData || filteredData.length === 0) {
        setToast({
          message: 'No eligible voters found for the selected criteria', // Updated message
          type: 'error',
          visible: true
        });
        return;
      }

      // Create column headers for the PDF (remain in default font)
      const headers = selectedColumns.map(col => {
        // Find the column definition from availableColumns (defined later in the component)
        const columnDef = availableColumns.find(c => c.id === col);
        return columnDef ? columnDef.label : col;
      });

      // Define a more flexible type for the voter data from the database
      type VoterExportData = {
        [key: string]: any; // Allows access to any property
      };

      // Get column data (will be rendered using Amiri font)
      const rows = (filteredData as VoterExportData[]).map(voter => {
        return selectedColumns.map(col => {
          const value = voter[col];
          if (value === null || value === undefined) return '-';

          switch (col) {
            case 'has_voted':
              return value ? 'Yes' : 'No';
            case 'voting_time':
              try {
                const date = new Date(value);
                return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
              } catch (e) {
                return '-';
              }
            default:
              return String(value);
          }
        });
      });

      // Create PDF document
      const pdf = new jsPDF('landscape');

      // Add the Amiri font
      pdf.addFileToVFS('Amiri-Regular.ttf', amiriRegularBase64);
      pdf.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');

      // Set default font for title and metadata
      pdf.setFont('Amiri');
      pdf.setFontSize(16);
      pdf.text('Eligible Voters Report', 14, 15);

      const now = new Date();
      pdf.setFontSize(10);
      pdf.text(`Generated on: ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`, 14, 22);
      
      // Update filter text in PDF metadata
      let filterText = 'Filters: Non-voted and eligible voters only (including MILITARY and DEATH)';
      if (selectedFamilies.length > 0) {
        filterText += ` | Families: ${selectedFamilies.length > 5 ? 'Multiple families selected' : selectedFamilies.join(', ')}`;
      }
      pdf.text(filterText, 14, 27);

      // Create the table using autoTable
      autoTable(pdf, {
        head: [headers],
        body: rows,
        startY: 32,
        headStyles: { fillColor: [41, 128, 185], textColor: 255, font: 'Amiri' },
        bodyStyles: { font: 'Amiri', fontStyle: 'normal' },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        styles: { fontSize: 9 },
        margin: { top: 32 },
      });

      // Save the PDF using the filename from the modal
      pdf.save(fileName);

      // Show success message
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
            case 'voting_time':
              try {
                if (!value) return '-';
                const date = new Date(value as string);
                return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
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
    { id: 'comments', label: 'Comments' },
    { id: 'has_voted', label: 'Has Voted' },
    { id: 'voting_time', label: 'Voting Time' },
  ];

  // Define table columns
  const columnHelper = createColumnHelper<Voter>();
  const columns = useMemo(() => [
    // Only add the actions column with Mark as Voted button if user has edit permission
    ...(hasEditPermission ? [
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const voter = row.original;
          return (
            <div className="flex space-x-2 justify-start">
              {!voter.has_voted && (
                <button
                  onClick={() => handleMarkVoted(voter.id)}
                  className="bg-green-100 hover:bg-green-200 text-green-800 font-medium py-1 px-2 rounded text-xs transition-colors"
                >
                  Mark as Voted
                </button>
              )}
              {voter.has_voted && (
                <button
                  onClick={() => handleUnmarkVoted(voter.id)}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium py-1 px-2 rounded text-xs transition-colors"
                >
                  Unmark
                </button>
              )}
              <button
                onClick={() => handleOpenCommentModal(voter)}
                className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium py-1 px-2 rounded text-xs transition-colors"
              >
                Add Comment
              </button>
            </div>
          );
        },
        enableColumnFilter: true,
        filterFn: () => true,
      })
    ] : [
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: () => <div></div>,
        enableColumnFilter: true,
        filterFn: () => true,
      })
    ]),
    columnHelper.accessor('situation', {
      header: 'Situation',
      cell: info => {
        const value = info.getValue();
        const colorClass = value === 'WITH' ? 'text-green-600 dark:text-green-400' :
                          value === 'AGAINST' ? 'text-red-600 dark:text-red-400' :
                          value === 'NEUTRAL' ? 'text-blue-500 dark:text-blue-300' :
                          value === 'NEUTRAL+' ? 'text-indigo-500 dark:text-indigo-300' :
                          value === 'DEATH' ? 'text-gray-600 dark:text-gray-400' :
                          value === 'IMMIGRANT' ? 'text-yellow-600 dark:text-yellow-400' :
                          value === 'MILITARY' ? 'text-purple-600 dark:text-purple-400' :
                          value === 'NO VOTE' ? 'text-orange-600 dark:text-orange-400' :
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
    columnHelper.accessor('full_name', { 
      header: 'Full Name', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (!value) return false;
        // Use substring matching instead of exact matching
        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      },
    }),
    columnHelper.accessor('register', { 
      header: 'Register', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        // Compare as strings
        return String(value) === filterValue;
      },
    }),
    columnHelper.accessor('register_sect', { 
      header: 'Register Sect', 
      cell: info => info.getValue() ?? '-',
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
    columnHelper.accessor('gender', { 
      header: 'Gender', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        return String(value) === filterValue;
      },
    }),
    columnHelper.accessor('comments', { 
      header: 'Comments', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (!value) return false;
        // Use substring matching instead of exact matching
        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      },
    }),
    columnHelper.accessor('has_voted', { 
      header: 'Has Voted', 
      cell: info => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          info.getValue() 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {info.getValue() ? 'Yes' : 'No'}
        </span>
      ),
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (filterValue === undefined) return true;
        const value = row.getValue(columnId);
        return value === filterValue;
      },
    }),
    columnHelper.accessor('voting_time', { 
      header: 'Voting Time', 
      cell: info => {
        const value = info.getValue();
        if (!value) return '-';
        const date = new Date(value);
        return date.toLocaleString('en-US', {
          timeZone: 'Asia/Beirut',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      },
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (typeof value === 'string') {
          // Use exact matching instead of substring matching
          return value === filterValue;
        }
        return false;
      },
    }),
  ], [columnHelper, hasEditPermission]);

  // Handle marking a voter as voted
  const handleMarkVoted = async (voterId: number) => {
    try {
      const { error } = await supabase
        .from('avp_voters')
        .update({ has_voted: true, voting_time: new Date().toISOString() })
        .eq('id', voterId);
      
      if (error) throw error;
      
      // Find the voter in our local state to get their name
      const voter = voters.find(v => v.id === voterId);
      
      // Update local state
      setVoters(prev => prev.map(voter => 
        voter.id === voterId ? { ...voter, has_voted: true, voting_time: new Date().toISOString() } : voter
      ));
      
      setToast({
        message: voter ? `Voter "${voter.full_name}" has voted` : 'Voter has been marked as voted',
        type: 'success',
        visible: true
      });
    } catch (err: any) {
      console.error('Error updating voter status:', err);
      setToast({
        message: err.message || 'Error updating voter status',
        type: 'error',
        visible: true
      });
    }
  };
  
  // Handle unmarking a voter (set has_voted to false)
  const handleUnmarkVoted = async (voterId: number) => {
    try {
      const { error } = await supabase
        .from('avp_voters')
        .update({ has_voted: false, voting_time: null })
        .eq('id', voterId);
      
      if (error) throw error;
      
      // Update local state
      setVoters(prev => prev.map(voter => 
        voter.id === voterId ? { ...voter, has_voted: false, voting_time: null } : voter
      ));
      
      setToast({
        message: 'Voter unmarked',
        type: 'success',
        visible: true
      });
    } catch (err: any) {
      console.error('Error updating voter status:', err);
      setToast({
        message: err.message || 'Error updating voter status',
        type: 'error',
        visible: true
      });
    }
  };

  useEffect(() => {
    if (profile?.voting_day_access === 'none') {
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

  }, [profile?.id]); // Only run on initial mount or when user changes

  // Watch for changes in voting_day_access permission and perform a full reset
  useEffect(() => {
    if (!profile || loading) return;
    
    if (profile.voting_day_access === 'none') {
      setError('You do not have permission to view this page.');
      setLoading(false);
      return;
    }
    
    console.log('Permission changed to:', profile.voting_day_access);
    setVotersLoading(true); // Show loading state

    // Clear existing data to avoid showing incorrect filtered data momentarily
    setVoters([]);
    
    // Fetch data with new filter
    fetchVoters()
      .then(() => {
        
        // Show success toast for better UX feedback
        setToast({
          message: `Filter applied: ${profile.voting_day_access}`,
          type: 'success',
          visible: true
        });
      })
      .catch(err => {
        console.error('Error applying new filter:', err);
        setToast({
          message: 'Failed to apply new filter. Please refresh the page.',
          type: 'error',
          visible: true
        });
      })
      .finally(() => {
        setVotersLoading(false);
      });
      
  }, [profile?.voting_day_access]);

  // Close toast notification
  const handleCloseToast = () => {
    setToast(null);
  };

  // Fetch voters function
  const fetchVoters = async () => {
    setVotersLoading(true);
    try {
      // Build query with required columns
      let query = supabase
        .from('avp_voters')
        .select('id, full_name, register, register_sect, comments, has_voted, gender, voting_time, situation, family')
        // Include all voters, including MILITARY and DEATH
        .order('register', { ascending: true })
        .order('register_sect', { ascending: true })
        .order('full_name', { ascending: true });
                      
      // Apply gender filter based on permissions
      const genderFilter = getGenderFilter();
      if (genderFilter) {
        query = query.eq('gender', genderFilter);
      }
      
      // Execute query and sort by name
      const { data, error: fetchError } = await query.order('full_name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // Set voters data
      setVoters(data as Voter[] || []);
      setVotersLoading(false);

      // Extract unique values for dropdown filters
      if (data) {
        // Get unique register sect values
        const sects = Array.from(new Set(data
          .map(voter => voter.register_sect)
          .filter(sect => sect !== null) as string[]
        )).sort();
        setRegisterSectOptions(sects);

        // Get unique gender values
        const genders = Array.from(new Set(data
          .map(voter => voter.gender)
          .filter(gender => gender !== null) as string[]
        )).sort();
        setGenderOptions(genders);
        
        // Get unique register values sorted in ascending order
        const registers = Array.from(new Set(data
          .map(voter => voter.register)
          .filter(register => register !== null)
          .map(register => String(register))
        )).sort((a, b) => Number(a) - Number(b));
        setRegisterOptions(registers);
        
        // Get unique family values
        const families = Array.from(new Set(data
          .map(voter => voter.family)
          .filter(family => family !== null) as string[]
        )).sort();
        setFamilyOptions(families);
      }
    } catch (err: any) {
      console.error('Error fetching voters:', err);
      setVotersLoading(false);
    }
  };

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
    // Prevent pagination reset on data update
    autoResetPageIndex: false, 
    initialState: {
      pagination: {
        pageSize: 50, // Default page size
      },     
    },
  });

  // Fetch voters data on component mount
  useEffect(() => {
    if (profile?.voting_day_access !== 'none') {
      fetchVoters();
    }
  }, [profile]);
  
  // Loading state
  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-900 min-h-screen">
        <div className="mb-6">
          <div className="h-10 w-72 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-6"></div>
          <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-8"></div>
        </div>
        <div className="border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          <div className="animate-pulse p-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3 mb-6"></div>
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-md mb-6"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-1/2 mb-4"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
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

  // Calculate voting statistics based on filtered data
  const filteredRows = table.getFilteredRowModel().rows;
  const filteredVoters = filteredRows.map(row => row.original);
  const filteredVotersCount = filteredRows.length;
  const filteredVotedCount = filteredRows.filter(row => row.original.has_voted).length;
  const filteredVotingRate = filteredVotersCount > 0 ? Math.round((filteredVotedCount / filteredVotersCount) * 100) : 0;

  // Main content
  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-900 min-h-screen">
      {/* Toast notification */}
      {toast && toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleCloseToast}
        />
      )}
      
      {/* Export PDF Modal */}
      <ExportPDFModal
        isOpen={exportPdfModalOpen}
        onClose={() => setExportPdfModalOpen(false)}
        registerOptions={registerOptions}
        familyOptions={familyOptions} // Pass familyOptions prop
        onExport={handleExportPDF}
      />
      
      {/* Export Excel Modal */}
      <ExportExcelModal
        isOpen={exportExcelModalOpen}
        onClose={() => setExportExcelModalOpen(false)}
        registerOptions={registerOptions}
        registerSectOptions={registerSectOptions}
        onExport={handleExportExcel}
      />
      
      {/* Comment Modal */}
      {commentModalOpen && selectedVoter && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div 
              className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
            >
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                      Add/Edit Comment for {selectedVoter.full_name}
                    </h3>
                    <div className="mt-4">
                      <textarea
                        rows={4}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        placeholder="Enter comment here..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleSaveComment}
                >
                  Save Comment
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleCloseCommentModal}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">Voting Day</h2>
          <p className="text-gray-600 dark:text-gray-400">Monitor and manage election day activities</p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-blue-100 dark:border-blue-900">
          <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <i className="fas fa-users text-blue-600 dark:text-blue-300 flex items-center justify-center w-6 h-6"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Voters</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{filteredVotersCount}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-blue-100 dark:border-blue-900">
          <div className="rounded-full bg-green-100 dark:bg-green-900 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <i className="fas fa-check-circle text-green-600 dark:text-green-300 flex items-center justify-center w-6 h-6"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Voted</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{filteredVotedCount}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-blue-100 dark:border-blue-900">
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

      {/* Voters Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-blue-100 dark:border-gray-700 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 sm:mb-0">Registered Voters</h3>
          
          <div className="flex items-center space-x-2">
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
        
        {votersLoading ? (
          // Loading skeleton for table
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-full mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
              ))}
            </div>
          </div>
        ) : voters.length === 0 ? (
          // No voters found
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <i className="fas fa-face-frown h-12 w-12 mx-auto mb-4 text-gray-400"></i>
            <p className="text-lg font-medium">No voters found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          // Voters table
          <>
            <div className="overflow-x-auto shadow-sm rounded-lg border border-blue-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-blue-50 dark:bg-gray-700">
                  {table.getHeaderGroups().map(headerGroup => (
                    <React.Fragment key={headerGroup.id}>
                      <tr>
                        {headerGroup.headers.map(header => (
                          <th 
                            key={header.id} 
                            scope="col" 
                            className="px-4 py-3 text-left text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider"
                            style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                          >
                            <div 
                              className={`flex items-center ${header.column.getCanSort() ? 'cursor-pointer select-none group' : ''}`}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() && (
                                <div className="ml-2">
                                  {{
                                    asc: (
                                      <i className="fas fa-sort-up text-blue-600 dark:text-blue-400 text-lg"></i>
                                    ),
                                    desc: (
                                      <i className="fas fa-sort-down text-blue-600 dark:text-blue-400 text-lg"></i>
                                    ),
                                  }[header.column.getIsSorted() as string] ?? (
                                    <i className="fas fa-sort text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity"></i>
                                  )}
                                </div>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                      {/* Filter row with export buttons under Actions */}
                      <tr>
                        {headerGroup.headers.map(header => (
                          <th key={header.id} className="px-4 py-2 bg-blue-50 dark:bg-gray-700">
                            {header.column.id === 'actions' ? (
                              <div>
                                {/* Empty div to preserve spacing */}
                              </div>
                            ) : header.column.getCanFilter() ? (
                              header.column.id === 'full_name' || header.column.id === 'comments' || header.column.id === 'voting_time' ? (
                                <SearchFilter type="text" column={header.column} table={table} />
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
                              ) : header.column.id === 'family' || header.column.id === 'gender' || header.column.id === 'sect' || header.column.id === 'register_sect' || header.column.id === 'situation' ? (
                                <SearchFilter type="select" column={header.column} table={table} />
                              ) : (
                                <SearchFilter type="text" column={header.column} table={table} />
                              )
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </React.Fragment>
                  ))}
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls - Fixed structure */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
              {/* Showing X to Y of Z voters */}
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span>
                  Showing <span className="font-semibold text-blue-900 dark:text-blue-300">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{" "}
                  <span className="font-semibold text-blue-900 dark:text-blue-300">
                    {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredVotersCount)}
                  </span> of{" "}
                  <span className="font-semibold text-blue-900 dark:text-blue-300">{filteredVotersCount}</span> voters
                </span>
              </div>
              
              {/* Page navigation buttons */}
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

              {/* Per page selector */}
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
          </> /* Correctly closed fragment */
        )}
      </div> {/* Correctly closed div */}
    </div> /* Correctly closed div */
  );
};

export default VotingDay;