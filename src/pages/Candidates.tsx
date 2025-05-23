import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { Tab } from '@headlessui/react';
import Select from 'react-select';
import { 
  createColumnHelper, 
  useReactTable, 
  getCoreRowModel, 
  getFilteredRowModel, 
  getSortedRowModel, 
  getPaginationRowModel, 
  SortingState, 
  ColumnFiltersState,
  flexRender
} from '@tanstack/react-table';
import Toast from '../components/Toast'; // Import shared Toast component
import ConfirmationModal from '../components/ConfirmationModal';
import AlertModal from '../components/AlertModal';
import ExportExcelModal from '../components/ExportExcelModal';
import SimplePDFModal from '../components/SimplePDFModal'; // Import the simplified PDF modal
import { exportTableDataToExcel } from '../utils/excelExport';
import { exportDataToPDF } from '../utils/pdfExport';
import { useRealtime } from '../lib/useRealtime';

// Candidate interface
interface Candidate {
  id: number;
  list_id: number; // New field for foreign key
  list_name?: string; // Now optional, as we'll get it from the joined table
  candidate_of: string;
  score?: number;
  list_order?: number;
  candidate_order?: number;
  full_name?: string; // From joined avp_voters table
  voter_id?: number; // Reference to avp_voters table
  register_sect?: string | null;
  register?: number | null;
}

// List interface for the new avp_candidate_lists table
interface CandidateList {
  id: number;
  name: string;
}

// Voter interface
interface Voter {
  id: number;
  full_name: string | null;
  register_sect?: string | null;
  register?: number | null;
  sect?: string | null;
}

// Define option type for React Select
interface VoterOption {
  value: number;
  label: string;
  voter: Voter;
}

// Add this new interface for the list form data
interface ListFormData {
  name: string;
}

const CreateCandidateTab: React.FC = () => {
  
  const { isDarkMode } = useThemeStore();
  const { session } = useAuthStore();
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);
  const [candidateLists, setCandidateLists] = useState<CandidateList[]>([]);
  const [formData, setFormData] = useState({
    list_id: 0,
    candidate_of: 'مختار',
  });
  const [voterOptions, setVoterOptions] = useState<VoterOption[]>([]);
  
  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);
  
  // Candidate of options
  const candidateOfOptions = ['مختار', 'عضو اختياري', 'عضو بلدي'];

  // Filter function for React Select
  const filterOption = (option: any, inputValue: string) => {
    // react-select v2+ often passes custom props inside option.data
    // Ensure option, option.data, and option.data.voter exist
    if (!option || !option.data || !option.data.voter) { 
      // console.warn("filterOption: called with invalid option structure or missing voter data", option);
      return false; // Don't show if the structure is not as expected
    }
    
    const voter = option.data.voter as Voter;
    const input = inputValue.toLowerCase();

    // If no input, show all options
    if (!input) {
      return true;
    }

    const nameMatch = voter.full_name ? voter.full_name.toLowerCase().includes(input) : false;
    const regSectMatch = voter.register_sect ? voter.register_sect.toLowerCase().includes(input) : false;
    const regMatch = voter.register ? voter.register.toString().toLowerCase().includes(input) : false;
    
    // 
    return nameMatch || regSectMatch || regMatch;
  };

  useEffect(() => {
    fetchVoters();
    fetchCandidateLists(); // Add this line to fetch candidate lists
  }, []);

  // Format voter information for display
  const formatVoterDisplayText = (voter: Voter): string => {
    return `${voter.full_name || '[Name not available]'} (${voter.register_sect || ''}) - ${voter.register || ''}`;
  };

  const fetchVoters = async () => {
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('avp_voters')
        .select('id, full_name, register_sect, sect, register');
      
      if (error) {
        console.error('CreateCandidateTab: Supabase error fetching voters:', error);
        throw error;
      }
      
      
      
      if (!data || data.length === 0) {
        console.warn('CreateCandidateTab: No voters data received from Supabase or data is empty.');
      }
      
      // Convert to voter options format for React Select
      const options = (data || []).map(voter => ({
        value: voter.id,
        label: formatVoterDisplayText(voter),
        voter: voter
      }));
      
      
      
      setVoterOptions(options);
      setVoters(data || []);
    } catch (err: any) {
      console.error('CreateCandidateTab: Error in fetchVoters function:', err.message);
      showToast('Failed to load voters', 'error');
      setVoterOptions([]); // Ensure options are empty on error
    } finally {
      setLoading(false);
      
    }
  };

  // Fetch candidate lists from the database
  const fetchCandidateLists = async () => {
    
    try {
      // Query the new avp_candidate_lists table
      const { data, error } = await supabase
        .from('avp_candidate_lists')
        .select('id, name')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('Error fetching candidate lists:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.warn('No candidate lists found');
      }
      
      setCandidateLists(data || []);
    } catch (err: any) {
      console.error('Error in fetchCandidateLists function:', err.message);
      showToast('Failed to load candidate lists', 'error');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const clearForm = () => {
    setSelectedVoter(null);
    setFormData({
      list_id: 0,
      candidate_of: 'مختار',
    });
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ message, type, visible: true });
  };

  const closeToast = () => {
    setToast(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    
    if (!selectedVoter) {
      showToast('Please select a voter', 'warning');
      return;
    }

    if (!formData.list_id) {
      showToast('Please select a list', 'warning');
      return;
    }

    try {
      // Check if the candidate already exists
      const { data: existingCandidate, error: selectError } = await supabase
        .from('avp_candidates')
        .select('id') // Only selecting 'id' is fine for an existence check
        .eq('id', selectedVoter.id)
        .maybeSingle(); // CHANGED to maybeSingle()

      // If there was an error during the select operation
      // (other than 'not found', which maybeSingle handles by returning null data and null error)
      if (selectError) {
        console.error('Error checking for existing candidate:', selectError);
        showToast(`Error checking for candidate: ${selectError.message}`, 'error');
        return; // Stop execution if there's a select error
      }

      if (existingCandidate) {
        showToast('This voter is already registered as a candidate', 'warning');
        return;
      }

      // Insert the new candidate
      const { error: insertError } = await supabase
        .from('avp_candidates')
        .insert({
          id: selectedVoter.id, 
          list_id: parseInt(formData.list_id.toString()), // Convert to number
          candidate_of: formData.candidate_of,
        });

      if (insertError) {
        console.error('Error inserting new candidate:', insertError);
        throw insertError; // Re-throw to be caught by the outer catch block
      }

      showToast('Candidate added successfully', 'success');
      clearForm();
    } catch (err: any) {
      console.error('Overall error in handleSubmit:', err.message);
      showToast(`Failed to add candidate: ${err.message}`, 'error');
    }
  };

  // Custom styles for React Select
  const selectStyles = {
    control: (baseStyles: any, state: any) => ({
      ...baseStyles,
      backgroundColor: isDarkMode ? '#374151' : 'white',
      borderColor: isDarkMode ? '#1f2937' : '#e5e7eb',
      boxShadow: state.isFocused ? (isDarkMode ? '0 0 0 1px #3b82f6' : '0 0 0 1px #3b82f6') : 'none',
      '&:hover': {
        borderColor: isDarkMode ? '#4b5563' : '#d1d5db'
      }
    }),
    menu: (baseStyles: any) => ({
      ...baseStyles,
      backgroundColor: isDarkMode ? '#1f2937' : 'white',
      borderColor: isDarkMode ? '#374151' : '#e5e7eb',
      zIndex: 50,
      position: 'absolute', 
      width: '100%',
      overflow: 'hidden',
      maxHeight: '300px' // Increase max height to show more options
    }),
    menuList: (baseStyles: any) => ({
      ...baseStyles,
      maxHeight: '300px', // Match the menu height
      overflowY: 'auto' // Ensure scrolling works
    }),
    option: (baseStyles: any, state: any) => ({
      ...baseStyles,
      backgroundColor: state.isFocused 
        ? (isDarkMode ? '#3b82f680' : '#dbeafe') 
        : (isDarkMode ? '#1f2937' : 'white'),
      color: isDarkMode ? '#e5e7eb' : '#111827',
      '&:hover': {
        backgroundColor: isDarkMode ? '#3b82f680' : '#dbeafe'
      },
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      direction: 'rtl', // Add RTL support for Arabic names
      textAlign: 'right' // Align text to the right
    }),
    input: (baseStyles: any) => ({
      ...baseStyles,
      color: isDarkMode ? 'white' : 'black'
    }),
    placeholder: (baseStyles: any) => ({
      ...baseStyles,
      color: isDarkMode ? '#9ca3af' : '#4b5563'
    }),
    singleValue: (baseStyles: any) => ({
      ...baseStyles,
      color: isDarkMode ? 'white' : 'black',
      direction: 'rtl', // Add RTL support for Arabic names
      textAlign: 'right' // Align text to the right
    }),
    multiValue: (baseStyles: any) => ({
      ...baseStyles,
      backgroundColor: isDarkMode ? '#4b5563' : '#e5e7eb'
    }),
    multiValueLabel: (baseStyles: any) => ({
      ...baseStyles,
      color: isDarkMode ? 'white' : 'black'
    }),
    multiValueRemove: (baseStyles: any) => ({
      ...baseStyles,
      color: isDarkMode ? '#9ca3af' : '#4b5563',
      '&:hover': {
        backgroundColor: isDarkMode ? '#6b7280' : '#d1d5db',
        color: isDarkMode ? 'white' : 'black'
      }
    })
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-colors duration-300 flex justify-center">
      <div className="w-full max-w-md">
        {/* Toast notification */}
        {toast && toast.visible && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={closeToast}
          />
        )}
        
        <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-6 text-center">Create New Candidate</h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Voter Selection - Using React Select */}
          <div className="relative">
            <label htmlFor="voter-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Voter
            </label>
            <Select
              id="voter-select"
              instanceId="voter-select-instance"
              options={voterOptions}
              value={selectedVoter ? {
                value: selectedVoter.id,
                label: formatVoterDisplayText(selectedVoter),
                voter: selectedVoter
              } : null}
              onChange={(option) => option ? setSelectedVoter(option.voter) : setSelectedVoter(null)}
              placeholder="Search by name, register section, or register..."
              isLoading={loading}
              isClearable
              filterOption={filterOption} // Re-enabled custom filter
              styles={selectStyles}
              className="react-select-container"
              classNamePrefix="react-select"
              theme={theme => ({
                ...theme,
                colors: {
                  ...theme.colors,
                  primary: isDarkMode ? '#3b82f6' : '#3b82f6',
                  primary75: isDarkMode ? '#3b82f6BF' : '#3b82f6BF',
                  primary50: isDarkMode ? '#3b82f680' : '#3b82f680',
                  primary25: isDarkMode ? '#3b82f640' : '#3b82f640',
                }
              })}
              required
            />
          </div>
          
          {/* List Name Selection */}
          <div>
            <label htmlFor="list_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              List Name
            </label>
            <div className="relative">
              <select
                id="list_id"
                name="list_id"
                className="w-full px-4 py-2 border border-blue-200 dark:border-blue-800 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-10"
                value={formData.list_id}
                onChange={handleInputChange}
                required
                dir="rtl"
              >
                <option value="">Select a list</option>
                {candidateLists.map(list => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Candidate Of Selection */}
          <div>
            <label htmlFor="candidate_of" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Candidate Of
            </label>
            <div className="relative">
              <select
                id="candidate_of"
                name="candidate_of"
                className="w-full px-4 py-2 border border-blue-200 dark:border-blue-800 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-10"
                value={formData.candidate_of}
                onChange={handleInputChange}
                required
                dir="rtl"
              >
                {candidateOfOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Submit Button */}
          <div>
            <button
              type="submit"
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-300"
            >
              Create Candidate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ManageCandidatesTab: React.FC = () => {
  
  const { isDarkMode } = useThemeStore();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Candidate>>({});
  const [candidateLists, setCandidateLists] = useState<CandidateList[]>([]);
  
  // Export modals state
  const [exportPdfModalOpen, setExportPdfModalOpen] = useState(false);
  const [exportExcelModalOpen, setExportExcelModalOpen] = useState(false);
  
  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);

  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    title: '',
    message: '',
    type: 'info'
  });

  // Candidate of options
  const candidateOfOptions = ['مختار', 'عضو اختياري', 'عضو بلدي'];

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ message, type, visible: true });
  };

  const closeToast = () => {
    setToast(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const startEdit = (candidate: Candidate) => {
    setEditingId(candidate.id);
    setEditFormData({
      list_id: candidate.list_id,
      candidate_of: candidate.candidate_of
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  // Setup realtime subscription for candidate changes
  useRealtime({
    table: 'avp_candidates',
    event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
    onChange: (payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      // Handle different event types
      if (eventType === 'INSERT') {
        // Fetch the complete candidate data including joined information
        fetchCandidateById(newRecord.id);
      } else if (eventType === 'UPDATE') {
        // Update the candidate in the current state
        setCandidates(currentCandidates => 
          currentCandidates.map(candidate => 
            candidate.id === newRecord.id 
              ? { 
                  ...candidate, 
                  list_id: newRecord.list_id,
                  candidate_of: newRecord.candidate_of 
                } 
              : candidate
          )
        );
      } else if (eventType === 'DELETE') {
        // Remove the candidate from the current state
        setCandidates(currentCandidates => 
          currentCandidates.filter(candidate => candidate.id !== oldRecord.id)
        );
      }
    }
  });

  // Helper function to fetch a single candidate by ID with joined data
  const fetchCandidateById = async (candidateId: number) => {
    try {
      const { data, error } = await supabase
        .from('avp_candidates')
        .select(`
          id, 
          list_id,
          candidate_of,
          avp_candidate_lists(id, name),
          avp_voters!inner(
            id,
            full_name,
            register_sect,
            register
          )
        `)
        .eq('id', candidateId)
        .single();

      if (error) {
        console.error("Error fetching candidate by ID:", error);
        return;
      }

      if (data) {
        // Transform the data to match our candidate format
        const newCandidate = {
          id: data.id,
          list_id: data.list_id,
          list_name: (data.avp_candidate_lists as any)?.name || 'Unknown List',
          candidate_of: data.candidate_of,
          full_name: (data.avp_voters as any)?.full_name || 'Unknown',
          register_sect: (data.avp_voters as any)?.register_sect || 'N/A',
          register: (data.avp_voters as any)?.register || null
        };

        // Add the new candidate to the current state
        setCandidates(currentCandidates => [...currentCandidates, newCandidate]);
      }
    } catch (err) {
      console.error("Error in fetchCandidateById:", err);
    }
  };

  useEffect(() => {
    
    fetchCandidates();
    fetchCandidateLists(); // Add this to fetch candidate lists
    checkDatabaseSchema(); // Add this function call
    
  }, []);

  // Add this function to check the database schema
  const checkDatabaseSchema = async () => {
    try {
      
      
      // Check if the table exists and get its structure
      const { data: tableInfo, error: tableError } = await supabase
        .from('avp_candidates')
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error("Error checking avp_candidates table:", tableError.message);
        return;
      }
      
      
      
      // Check if there are any rows in the table
      const { count, error: countError } = await supabase
        .from('avp_candidates')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error("Error counting rows in avp_candidates:", countError.message);
        return;
      }
      
      
      
      // Check the relationship between tables
      const { data: votersData, error: votersError } = await supabase
        .from('avp_voters')
        .select('id')
        .limit(1);
      
      if (votersError) {
        console.error("Error checking avp_voters table:", votersError.message);
        return;
      }
      
      
      
    } catch (err) {
      console.error("Error checking database schema:", err);
    }
  };

  const fetchCandidates = async () => {
    
    try {
      setLoading(true);
      setError(null);

      
      
      // Use proper join to get candidate data with voter and list information
      const { data, error } = await supabase
        .from('avp_candidates')
        .select(`
          id, 
          list_id,
          candidate_of,
          avp_candidate_lists(id, name),
          avp_voters!inner(
            id,
            full_name,
            register_sect,
            register
          )
        `);

      if (error) {
        console.error("Supabase query error:", error);
        throw error;
      } 
      
      
      // Transform the data to flatten voter and list information
      const transformedData = data.map(item => ({
        id: item.id,
        list_id: item.list_id,
        list_name: (item.avp_candidate_lists as any)?.name || 'Unknown List',
        candidate_of: item.candidate_of,
        full_name: (item.avp_voters as any)?.full_name || 'Unknown',
        register_sect: (item.avp_voters as any)?.register_sect || 'N/A',
        register: (item.avp_voters as any)?.register || null
      }));

      

      setCandidates(transformedData);
    } catch (err: any) {
      console.error('Error fetching candidates:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch candidate lists from the database
  const fetchCandidateLists = async () => {
    
    try {
      // Query the new avp_candidate_lists table
      const { data, error } = await supabase
        .from('avp_candidate_lists')
        .select('id, name')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('Error fetching candidate lists:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.warn('No candidate lists found');
      }
      
      setCandidateLists(data || []);
    } catch (err: any) {
      console.error('Error in fetchCandidateLists function:', err.message);
      showToast('Failed to load candidate lists', 'error');
    }
  };

  // Generate and download PDF function with simplified approach
  const handleExportPDF = async (fileName: string) => {
    try {
      showToast('Preparing PDF export...', 'info');

      // Get the current filtered data from the table
      const filteredData = table.getFilteredRowModel().rows.map(row => row.original);
      
      if (!filteredData || filteredData.length === 0) {
        showToast('No data to export. Please adjust your filters.', 'error');
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

      // Create column headers for the PDF
      const headers = visibleColumns.map(colId => {
        // Map column IDs to readable headers
        switch (colId) {
          case 'full_name': return 'Full Name';
          case 'register_sect': return 'Register Sect';
          case 'register': return 'Register';
          case 'list_name': return 'List Name';
          case 'candidate_of': return 'Candidate Of';
          default: return colId;
        }
      });

      // Get column data
      const rows = filteredData.map(candidate => {
        return visibleColumns.map(colId => {
          const value = candidate[colId as keyof Candidate];
          if (value === null || value === undefined) return '-';
          return String(value);
        });
      });

      // Use our common utility function to export the PDF
      exportDataToPDF(
        headers,
        rows,
        'Candidates Report',
        fileName || 'candidates-report.pdf',
        'landscape'
      );

      // Show success message
      showToast('PDF exported successfully', 'success');
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      showToast(err.message || 'Error generating PDF', 'error');
    }
  };

  // Generate and download Excel function
  const handleExportExcel = async (fileName: string) => {
    try {
      showToast('Preparing Excel export...', 'info');
      
      // Get the current filtered data from the table
      const filteredData = table.getFilteredRowModel().rows.map(row => row.original);
      
      if (!filteredData || filteredData.length === 0) {
        showToast('No data to export. Please adjust your filters.', 'error');
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
        // Map column IDs to readable headers
        switch (colId) {
          case 'full_name': return 'Full Name';
          case 'register_sect': return 'Register Sect';
          case 'register': return 'Register';
          case 'list_name': return 'List Name';
          case 'candidate_of': return 'Candidate Of';
          default: return colId;
        }
      });

      // Extract data for each row
      const rows = filteredData.map(candidate => {
        return visibleColumns.map(colId => {
          const value = candidate[colId as keyof Candidate];
          if (value === null || value === undefined) return '-';
          return String(value);
        });
      });

      // Export data to Excel
      exportTableDataToExcel(headers, rows, fileName);

      // Show success message
      showToast('Excel exported successfully', 'success');
    } catch (err: any) {
      console.error('Error generating Excel:', err);
      showToast(err.message || 'Error generating Excel', 'error');
    }
  };

  // Available columns for export
  const availableColumns = [
    { id: 'full_name', label: 'Full Name' },
    { id: 'register_sect', label: 'Register Sect' },
    { id: 'register', label: 'Register' },
    { id: 'list_name', label: 'List Name' },
    { id: 'candidate_of', label: 'Candidate Of' }
  ];

  const handleSaveEdit = async () => {
    if (!editingId || !editFormData) return;
    

    try {
        // Validate if the list_id exists in avp_candidate_lists
        const { data: validList, error: listError } = await supabase
            .from('avp_candidate_lists')
            .select('id')
            .eq('id', parseInt(editFormData.list_id?.toString() || '0'))
            .single();

        if (listError || !validList) {
            console.error('Invalid list_id:', listError);
            showToast('Selected list does not exist. Please choose a valid list.', 'error');
            return;
        }

        const { error } = await supabase
            .from('avp_candidates')
            .update({
                list_id: parseInt(editFormData.list_id?.toString() || '0'),
                candidate_of: editFormData.candidate_of
            })
            .eq('id', editingId);

        if (error) {
            throw error;
        }

        showToast('Candidate updated successfully', 'success');
        setEditingId(null);
        setEditFormData({});
        fetchCandidates(); // Refresh the list
    } catch (err: any) {
        console.error('Error updating candidate:', err.message);
        showToast(`Failed to update candidate: ${err.message}`, 'error');
    }
};

  const confirmDelete = (candidate: Candidate) => {
    setCandidateToDelete(candidate);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!candidateToDelete) return;
    
    
    try {
      const { error } = await supabase
        .from('avp_candidates')
        .delete()
        .eq('id', candidateToDelete.id);

      if (error) {
        throw error;
      }

      showToast('Candidate deleted successfully', 'success');
      setDeleteModalOpen(false);
      setCandidateToDelete(null);
      fetchCandidates(); // Refresh the list
    } catch (err: any) {
      console.error('Error deleting candidate:', err.message);
      showToast(`Failed to delete candidate: ${err.message}`, 'error');
    }
  };

  const columnHelper = createColumnHelper<Candidate>();
  const hasEditAccess = useAuthStore.getState().profile?.candidate_access === 'edit';
  
  const columns = [
    columnHelper.accessor('full_name', {
      header: 'Full Name',
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('register_sect', {
      header: 'Register Section',
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('register', {
      header: 'Register',
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('list_name', {
      header: 'List Name',
      cell: info => {
        const candidate = info.row.original;
        if (hasEditAccess && editingId === candidate.id) {
          return (
            <select
              name="list_id"
              value={editFormData.list_id}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            >
              {candidateLists.map(list => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          );
        }
        return info.getValue();
      },
      enableSorting: true,
    }),
    columnHelper.accessor('candidate_of', {
      header: 'Candidate Of',
      cell: info => {
        const candidate = info.row.original;
        if (hasEditAccess && editingId === candidate.id) {
          return (
            <select
              name="candidate_of"
              value={editFormData.candidate_of}
              onChange={handleInputChange}
              className="w-full p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
            >
              {candidateOfOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          );
        }
        return info.getValue();
      },
      enableSorting: true,
    }),
    // Only include the actions column if the user has edit access
    ...(hasEditAccess ? [
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const candidate = row.original;
          
          if (editingId === candidate.id) {
            return (
              <div className="flex space-x-3">
                <button 
                  onClick={handleSaveEdit}
                  className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
                  title="Save"
                >
                  <i className="fas fa-save text-lg"></i>
                </button>
                <button 
                  onClick={cancelEdit}
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
                onClick={() => startEdit(candidate)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                title="Edit"
              >
                <i className="fas fa-edit text-lg"></i>
              </button>
              <button 
                onClick={() => confirmDelete(candidate)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                title="Delete"
              >
                <i className="fas fa-trash-alt text-lg"></i>
              </button>
            </div>
          );
        }
      })
    ] : [])
  ];

  const table = useReactTable({
    data: candidates,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetPageIndex: false,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-colors duration-300">
        <div className="mb-6">
          <div className="h-10 w-72 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-6"></div>
        </div>
        
        <div className="border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-4">
            <div className="flex justify-between">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 dark:bg-gray-600 rounded-md animate-pulse my-2 w-32"></div>
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
      <div className="p-6 text-center bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-colors duration-300">
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-700 p-6 rounded-lg shadow-sm max-w-lg mx-auto">
          <div className="flex items-center">
            <i className="fas fa-exclamation-circle h-8 w-8 text-red-500 dark:text-red-400 mr-3"></i>
            <p className="text-red-700 dark:text-red-300 text-lg font-medium">{error}</p>
          </div>
          <p className="mt-3 text-red-600 dark:text-red-400 text-sm">Please try refreshing the page or contact an administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-colors duration-300">
      {/* Toast notification */}
      {toast && toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-4 sm:mb-0">
            {useAuthStore.getState().profile?.candidate_access === 'edit' ? "Manage Candidates" : "Candidates List"}
          </h3>
        </div>
          
        {/* Export buttons - Aligned to the far right */}
        <div className="flex items-center space-x-2 justify-end px-2 py-1 text-xs rounded-md bg-white dark:bg-gray-700 h-8 min-h-0 mb-4 sm:mb-0 ml-auto">
          <button
            onClick={() => setExportPdfModalOpen(true)}
            className="h-6 px-2 py-0 text-xs rounded bg-white dark:bg-gray-700 border border-transparent flex items-center text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 focus:outline-none"
            style={{ minWidth: 'auto' }}
            aria-label="Export PDF"
            title="Export PDF"
          >
            <i className="fas fa-file-pdf text-base"></i>
            <span className="ml-1">PDF</span>
          </button>
          <button
            onClick={() => setExportExcelModalOpen(true)}
            className="h-6 px-2 py-0 text-xs rounded bg-white dark:bg-gray-700 border border-transparent flex items-center text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400 focus:outline-none"
            style={{ minWidth: 'auto' }}
            aria-label="Export Excel"
            title="Export Excel"
          >
            <i className="fas fa-file-excel text-base"></i>
            <span className="ml-1">Excel</span>
          </button>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">No candidates found</h3>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Please add a candidate using the Create Candidate tab.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-blue-100 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-blue-50 dark:bg-blue-900/20">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id} 
                        scope="col" 
                        className="px-6 py-3.5 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider whitespace-nowrap"
                        onClick={header.column.getToggleSortingHandler()}
                        style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                      >
                        <div className="flex items-center">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          {header.column.getIsSorted() === 'asc' && (
                            <i className="fas fa-sort-up ml-1.5 text-blue-600 dark:text-blue-400"></i>
                          )}
                          {header.column.getIsSorted() === 'desc' && (
                            <i className="fas fa-sort-down ml-1.5 text-blue-600 dark:text-blue-400"></i>
                          )}
                          {header.column.getCanSort() && !header.column.getIsSorted() && (
                            <i className="fas fa-sort ml-1.5 text-gray-400 dark:text-gray-600 opacity-30 group-hover:opacity-70 transition-opacity"></i>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
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
        </div>
      )}
      
      {/* Pagination Controls */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <span>
            Showing <span className="font-semibold text-blue-900 dark:text-blue-400">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{" "}
            <span className="font-semibold text-blue-900 dark:text-blue-400">
              {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, candidates.length)}
            </span> of{" "}
            <span className="font-semibold text-blue-900 dark:text-blue-400">{candidates.length}</span> candidates
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Go to first page"
            title="First page"
          >
            <i className="fas fa-angle-double-left w-5 h-5"></i>
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
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
                      ? 'bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-700' 
                      : 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30'
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
            <span className="px-3 py-1.5 text-sm text-blue-700 dark:text-blue-400 font-medium">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
          </div>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Go to next page"
            title="Next page"
          >
            <i className="fas fa-angle-right w-5 h-5"></i>
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            aria-label="Go to last page"
            title="Last page"
          >
            <i className="fas fa-angle-double-right w-5 h-5"></i>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-blue-700 dark:text-blue-400">
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

      {/* Custom modals */}
      <ConfirmationModal 
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Candidate"
        message={candidateToDelete ? `Are you sure you want to delete ${candidateToDelete.full_name} from candidates?` : 'Are you sure you want to delete this candidate?'}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
      />
      
      <AlertModal 
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />

      {/* Export modals */}
      <SimplePDFModal
        isOpen={exportPdfModalOpen}
        onClose={() => setExportPdfModalOpen(false)}
        onExport={handleExportPDF}
        defaultFileName="Candidates_Report.pdf"
      />
      
      <ExportExcelModal
        isOpen={exportExcelModalOpen}
        onClose={() => setExportExcelModalOpen(false)}
        onExport={handleExportExcel}
        defaultFileName="Candidates_Report.xlsx"
      />
    </div>
  );
};

const CreateListTab: React.FC = () => {
  const { isDarkMode } = useThemeStore();
  const [candidateLists, setCandidateLists] = useState<CandidateList[]>([]);
  const [formData, setFormData] = useState<ListFormData>({
    name: '',
  });
  const [loading, setLoading] = useState(false);
  // Add state for delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState<CandidateList | null>(null);
  
  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);

  useEffect(() => {
    
    fetchCandidateLists();
  }, []);

  const fetchCandidateLists = async () => {
    
    try {
      setLoading(true);
      // Query the avp_candidate_lists table
      const { data, error } = await supabase
        .from('avp_candidate_lists')
        .select('id, name')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('Error fetching candidate lists:', error);
        throw error;
      }
      
      setCandidateLists(data || []);
    } catch (err: any) {
      console.error('Error in fetchCandidateLists function:', err.message);
      showToast('Failed to load candidate lists', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ message, type, visible: true });
  };

  const closeToast = () => {
    setToast(null);
  };

  const clearForm = () => {
    setFormData({
      name: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    
    if (!formData.name.trim()) {
      showToast('Please enter a list name', 'warning');
      return;
    }

    try {
      setLoading(true);
      
      // Check if the list name already exists
      const { data: existingList, error: selectError } = await supabase
        .from('avp_candidate_lists')
        .select('id')
        .eq('name', formData.name.trim())
        .maybeSingle();

      if (selectError) {
        console.error('Error checking for existing list:', selectError);
        throw selectError;
      }

      if (existingList) {
        showToast('This list name already exists', 'warning');
        return;
      }

      // Insert the new list
      const { error: insertError } = await supabase
        .from('avp_candidate_lists')
        .insert({
          name: formData.name.trim(),
        });

      if (insertError) {
        console.error('Error inserting new list:', insertError);
        throw insertError;
      }

      showToast('List added successfully', 'success');
      clearForm();
      fetchCandidateLists(); // Refresh the list
      
    } catch (err: any) {
      console.error('Error creating list:', err.message);
      showToast(`Failed to create list: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteList = (list: CandidateList) => {
    // Set the list to delete and open the modal
    setListToDelete(list);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!listToDelete) return;
    
    try {
      // Check if any candidates are using this list
      const { data: usingCandidates, error: checkError } = await supabase
        .from('avp_candidates')
        .select('id')
        .eq('list_id', listToDelete.id)
        .limit(1);
        
      if (checkError) {
        throw checkError;
      }
      
      if (usingCandidates && usingCandidates.length > 0) {
        showToast('Cannot delete list: it is being used by candidates', 'error');
        setDeleteModalOpen(false);
        setListToDelete(null);
        return;
      }
      
      const { error: deleteError } = await supabase
        .from('avp_candidate_lists')
        .delete()
        .eq('id', listToDelete.id);
        
      if (deleteError) {
        throw deleteError;
      }
      
      showToast('List deleted successfully', 'success');
      fetchCandidateLists(); // Refresh the list
      
    } catch (err: any) {
      console.error('Error deleting list:', err.message);
      showToast(`Failed to delete list: ${err.message}`, 'error');
    } finally {
      setDeleteModalOpen(false);
      setListToDelete(null);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm transition-colors duration-300">
      {/* Toast notification */}
      {toast && toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create List Form */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-blue-100 dark:border-blue-900">
          <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-6">Create New List</h3>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                List Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Enter list name"
                className="w-full px-4 py-2 border border-blue-200 dark:border-blue-800 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.name}
                onChange={handleInputChange}
                required
                dir="rtl"
              />
            </div>
            
            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white 
                  ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} 
                  dark:${loading ? 'bg-blue-600 cursor-not-allowed' : 'bg-blue-700 hover:bg-blue-800'} 
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-300`}
              >
                {loading ? 'Creating...' : 'Create List'}
              </button>
            </div>
          </form>
        </div>
        
        {/* Current Lists */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-blue-100 dark:border-blue-900">
          <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-6">Current Lists</h3>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading lists...</p>
            </div>
          ) : candidateLists.length === 0 ? (
            <div className="text-center py-8">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">No lists found</h3>
              <p className="mt-1 text-gray-500 dark:text-gray-400">Create your first list using the form.</p>
            </div>
          ) : (
            <div className="overflow-hidden border border-gray-200 dark:border-gray-700 sm:rounded-md">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {candidateLists.map(list => (
                  <li key={list.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750">
                    <span className="text-gray-900 dark:text-white font-medium" dir="rtl">{list.name}</span>
                    <button
                      onClick={() => confirmDeleteList(list)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                      title="Delete List"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete List"
        message={listToDelete ? `Are you sure you want to delete the list "${listToDelete.name}"?` : 'Are you sure you want to delete this list?'}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
      />
    </div>
  );
};

// Main Candidates component with tabs
const Candidates: React.FC = () => {
  
  const { isDarkMode } = useThemeStore();
  const { profile } = useAuthStore();
  const [selectedTabIndex, setSelectedTabIndex] = useState(profile?.candidate_access === 'view' ? 1 : 0); // Default to Manage Candidates tab (index 1) for view-only access

  

  const hasEditAccess = profile?.candidate_access === 'edit';

  // useEffect is no longer needed for localStorage, 
  // but can be kept if other mount-time logic is added later.
  useEffect(() => {
    
  }, []); // Runs once on mount

  const handleTabChange = (index: number) => {
    // Only allow tab change if user has edit access or is staying on the ManageCandidates tab
    if (hasEditAccess || index === 1) {
      
      setSelectedTabIndex(index);
      
    }
  };

  // Use useMemo to persist the tab components across renders
  const createCandidateTabComponent = useMemo(() => <CreateCandidateTab />, []);
  const manageCandidatesTabComponent = useMemo(() => <ManageCandidatesTab />, []);
  const createListTabComponent = useMemo(() => <CreateListTab />, []);

  

  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-900 min-h-screen transition-colors duration-300">
      <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">
        {hasEditAccess ? "Candidates Management" : "Candidates"}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {hasEditAccess 
          ? "Create and manage candidates for elections" 
          : "View all candidates in elections"}
      </p>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-blue-100 dark:border-gray-700 mb-6 transition-colors duration-300">
        {hasEditAccess ? (
          <Tab.Group selectedIndex={selectedTabIndex} onChange={handleTabChange}>
            <Tab.List className="flex border-b border-blue-100 dark:border-gray-700 bg-blue-50 dark:bg-gray-800">
              <Tab
                className={({ selected }: { selected: boolean }) => {
                  return `px-6 py-3 text-sm font-medium leading-5 focus:outline-none transition-colors ${
                    selected
                      ? 'text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-gray-700'
                      : 'text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30'
                  }`;
                }}
              >
                Create List
              </Tab>
              <Tab
                className={({ selected }: { selected: boolean }) => {
                  return `px-6 py-3 text-sm font-medium leading-5 focus:outline-none transition-colors ${
                    selected
                      ? 'text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-gray-700'
                      : 'text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30'
                  }`;
                }}
              >
                Create Candidate
              </Tab>
              <Tab
                className={({ selected }: { selected: boolean }) => {
                  return `px-6 py-3 text-sm font-medium leading-5 focus:outline-none transition-colors ${
                    selected
                      ? 'text-blue-700 dark:text-blue-300 border-b-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-gray-700'
                      : 'text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30'
                  }`;
                }}
              >
                Manage Candidates
              </Tab>
            </Tab.List>
            <Tab.Panels>
              <Tab.Panel>{createListTabComponent}</Tab.Panel>
              <Tab.Panel>{createCandidateTabComponent}</Tab.Panel>
              <Tab.Panel>{manageCandidatesTabComponent}</Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        ) : (
          // For view-only access, just display the ManageCandidatesTab without tabs
          manageCandidatesTabComponent
        )}
      </div>
    </div>
  );
};

export default Candidates;