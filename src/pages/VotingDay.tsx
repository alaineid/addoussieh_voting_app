import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { 
  createColumnHelper, 
  flexRender, 
  getCoreRowModel, 
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
  FilterFn
} from '@tanstack/react-table';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Define interface for voter data
interface Voter {
  id: number;
  full_name: string | null;
  register: number | null;
  register_sect: string | null;
  comments: string | null;
  has_voted: boolean | null;
  gender: string | null;
}

// Toast notification component for success/error messages
interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-md shadow-lg ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white`}>
      <div className="mr-3">
        {type === 'success' ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <div>{message}</div>
      <button 
        onClick={onClose} 
        className="ml-6 text-white hover:text-gray-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Voters table state
  const [voters, setVoters] = useState<Voter[]>([]);
  const [votersLoading, setVotersLoading] = useState<boolean>(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const subscriptionErrorCountRef = useRef<number>(0);
  
  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    visible: boolean;
  } | null>(null);

  // Dropdown options for filter (populated on data load)
  const [registerSectOptions, setRegisterSectOptions] = useState<string[]>([]);
  const [genderOptions, setGenderOptions] = useState<string[]>([]);
  const [registerOptions, setRegisterOptions] = useState<string[]>([]);
  
  // Determine permissions and which voters to show
  const hasEditPermission = profile?.voting_day_access?.includes('edit') || false;
  
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

  // Define table columns
  const columnHelper = createColumnHelper<Voter>();
  const columns = useMemo(() => [
    columnHelper.accessor('full_name', { 
      header: 'Full Name', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: 'includesString',
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
        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
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
      filterFn: 'includesString',
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
        if (!filterValue) return true;
        const value = row.getValue(columnId);
        if (filterValue === '__EMPTY__') return value === null || value === undefined || value === '';
        if (filterValue === 'true') return value === true;
        if (filterValue === 'false') return value === false;
        return true;
      },
    }),
    // Only add the actions column with Mark as Voted button if user has edit permission
    ...(hasEditPermission ? [
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const voter = row.original;
          return (
            <div className="flex space-x-2 justify-center">
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
            </div>
          );
        }
      })
    ] : [])
  ], [columnHelper, hasEditPermission]);

  // Handle marking a voter as voted
  const handleMarkVoted = async (voterId: number) => {
    try {
      const { error } = await supabase
        .from('avp_voters')
        .update({ has_voted: true })
        .eq('id', voterId);
      
      if (error) throw error;
      
      // Update local state
      setVoters(prev => prev.map(voter => 
        voter.id === voterId ? { ...voter, has_voted: true } : voter
      ));
      
      setToast({
        message: 'Voter marked as voted',
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
        .update({ has_voted: false })
        .eq('id', voterId);
      
      if (error) throw error;
      
      // Update local state
      setVoters(prev => prev.map(voter => 
        voter.id === voterId ? { ...voter, has_voted: false } : voter
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

  // Initial data fetch and real-time subscription setup
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
        // Setup realtime subscription after initial data fetch succeeds
        setupRealtimeSubscription();
      })
      .catch(err => {
        console.error('Initial data fetch error:', err);
      })
      .finally(() => {
        setLoading(false);
      });

    // Cleanup function
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };

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
    
    // Clean up existing subscription if it exists
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    
    // Fetch data with new filter
    fetchVoters()
      .then(() => {
        setupRealtimeSubscription();
        
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
        .select('id, full_name, register, register_sect, comments, has_voted, gender');
      
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
          .map(register => String(register)) as string[]
        )).sort((a, b) => Number(a) - Number(b));
        setRegisterOptions(registers);
      }
    } catch (err: any) {
      console.error('Error fetching voters:', err);
      setVotersLoading(false);
    }
  };

  // Setup realtime subscription function
  const setupRealtimeSubscription = () => {
    // Clean up existing subscription if it exists
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    // Create new subscription
    const channel = supabase
      .channel('voting-day-changes-' + Date.now()) // Add timestamp to make each channel name unique
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'avp_voters' },
        (payload) => {
          console.log('Voter change detected!', payload);
          
          // Get the current gender filter based on permissions
          const genderFilter = getGenderFilter();
          
          // Handle INSERT and DELETE events with a full refetch to maintain permission filters
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            fetchVoters();
            return;
          }

          // For UPDATE events, check if the voter should be included based on gender filter
          if (payload.eventType === 'UPDATE' && payload.new && payload.new.id) {
            // If we have a gender filter and the voter doesn't match, skip the update
            if (genderFilter && payload.new.gender !== genderFilter) {
              return;
            }
            
            // Otherwise update the voter in our local state
            setVoters(currentVoters => 
              currentVoters.map(voter => 
                voter.id === payload.new.id ? { ...voter, ...payload.new } : voter
              )
            );
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to voting day changes!');
          subscriptionErrorCountRef.current = 0; // Reset error count on successful subscription
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error:', err);
          
          subscriptionErrorCountRef.current += 1;
          
          // If we've had multiple errors, show a toast to the user
          if (subscriptionErrorCountRef.current >= 3) {
            setToast({
              message: 'Having trouble with live updates. You may need to refresh the page.',
              type: 'error',
              visible: true
            });
          }
          
          // Try to reestablish connection after a delay
          setTimeout(() => {
            if (subscriptionErrorCountRef.current < 5) { // Don't keep trying forever
              setupRealtimeSubscription();
            }
          }, 5000);
        }
        if (status === 'TIMED_OUT') {
          console.warn('Realtime connection timed out.');
          // Try to reconnect after timeout
          setTimeout(() => {
            setupRealtimeSubscription();
          }, 5000);
        }
      });

    // Store the channel reference for cleanup
    realtimeChannelRef.current = channel;
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
    initialState: {
      pagination: {
        pageSize: 10, // Default page size
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 dark:text-red-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700 dark:text-red-200 text-lg font-medium">{error}</p>
          </div>
          <p className="mt-3 text-red-600 dark:text-red-300 text-sm">Please try refreshing the page or contact an administrator.</p>
        </div>
      </div>
    );
  }

  // Calculate voting statistics
  const totalVoters = voters.length;
  const votedCount = voters.filter(voter => voter.has_voted).length;
  const votingRate = totalVoters > 0 ? Math.round((votedCount / totalVoters) * 100) : 0;

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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Voters</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{totalVoters}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-blue-100 dark:border-blue-900">
          <div className="rounded-full bg-green-100 dark:bg-green-900 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Voted</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{votedCount}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-blue-100 dark:border-blue-900">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-2">Participation Rate</p>
          <div className="flex items-center justify-between mb-1">
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{votingRate}%</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{votedCount} of {totalVoters}</p>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full" 
              style={{ width: `${votingRate}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Voters Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-blue-100 dark:border-gray-700 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 sm:mb-0">Registered Voters</h3>
          
          {/* Search Input */}
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="search"
              className="block w-full pl-10 pr-4 py-2 text-gray-900 dark:text-white dark:bg-gray-700 border border-blue-200 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              placeholder="Search voters..."
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
            />
          </div>
        </div>
        
        {votersLoading ? (
          // Loading skeleton for table
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-full mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-md w-full"></div>
              ))}
            </div>
          </div>
        ) : voters.length === 0 ? (
          // No voters found
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <p className="text-lg font-medium">No voters found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          // Voters table
          <>
            <div className="overflow-x-auto shadow-sm rounded-lg border border-blue-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th 
                          key={header.id} 
                          scope="col" 
                          className="px-6 py-3.5 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider whitespace-nowrap min-w-[100px]"
                        >
                          <div
                            className="cursor-pointer whitespace-nowrap flex items-center"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                            {/* Sorting indicators */}
                            {header.column.getIsSorted() === 'asc' && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="ml-1.5 h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                            {header.column.getIsSorted() === 'desc' && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="ml-1.5 h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                            {/* Indicator for sortable columns that are not currently sorted */}
                            {header.column.getCanSort() && !header.column.getIsSorted() && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="ml-1.5 h-4 w-4 text-gray-400 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}

                  {/* Column Filters Row */}
                  <tr>
                    {table.getHeaderGroups()[0].headers.map(header => {
                      const columnId = header.column.id;

                      return (
                        <th key={header.id} className="px-6 py-2 bg-gray-100 dark:bg-gray-700">
                          {/* Only add filters for data columns, not action column */}
                          {columnId !== 'actions' && (
                            <>
                              {/* Register Dropdown */}
                              {columnId === 'register' && (
                                <SelectFilter column={header.column} table={table} />
                              )}
                              
                              {/* Register Sect Dropdown */}
                              {columnId === 'register_sect' && (
                                <SelectFilter column={header.column} table={table} />
                              )}
                              
                              {/* Gender Dropdown */}
                              {columnId === 'gender' && (
                                <SelectFilter column={header.column} table={table} />
                              )}

                              {/* Has Voted Dropdown */}
                              {columnId === 'has_voted' && (
                                <BooleanFilter column={header.column} table={table} />
                              )}

                              {/* Text Search for Full Name and Comments */}
                              {['full_name', 'comments'].includes(columnId) && (
                                <TextFilter column={header.column} table={table} />
                              )}
                            </>
                          )}
                        </th>
                      );
                    })}
                  </tr>
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

            {/* Pagination Controls */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span>
                  Showing <span className="font-semibold text-blue-900 dark:text-blue-300">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{" "}
                  <span className="font-semibold text-blue-900 dark:text-blue-300">
                    {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, voters.length)}
                  </span> of{" "}
                  <span className="font-semibold text-blue-900 dark:text-blue-300">{voters.length}</span> voters
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  aria-label="Go to previous page"
                  title="Previous page"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <span className="px-3 py-2 text-sm text-blue-700 dark:text-blue-300 font-medium">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </span>

                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  aria-label="Go to next page"
                  title="Next page"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className="p-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  aria-label="Go to last page"
                  title="Last page"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
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
          </>
        )}
      </div>
    </div>
  );
};

export default VotingDay;