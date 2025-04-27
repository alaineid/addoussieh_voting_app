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
  sect: string | null;
  n_plus: number | null;
  n: number | null;
  n_minus: number | null;
  against: number | null;
  no_vote: number | null;
  death: number | null;
  military: number | null;
  residence: string | null;
  has_voted: boolean | null;
  comments: string | null;
  search_vector: any; // unknown type
  with_flag: number | null;
  dob: string | null; // date as string
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

const VoterList: React.FC = () => {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const userSelectedViewMode = useRef<boolean>(false);

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
    columnHelper.accessor('full_name', { 
      header: 'Full Name', 
      cell: info => info.getValue(),
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('alliance', { 
      header: 'Alliance', 
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
    columnHelper.accessor('family', { 
      header: 'Family', 
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
    columnHelper.accessor('register', { 
      header: 'Register', 
      cell: info => info.getValue() ?? '-',
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
    columnHelper.accessor('first_name', { 
      header: 'First Name', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('father_name', { 
      header: 'Father Name', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('last_name', { 
      header: 'Last Name', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('mother_name', { 
      header: 'Mother Name', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('situation', { 
      header: 'Situation', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('dob', { 
      header: 'DOB', 
      cell: info => formatDate(info.getValue() as string),
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
    columnHelper.accessor('residence', { 
      header: 'Residence', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: 'includesString',
    }),
    columnHelper.accessor('has_voted', { 
      header: 'Has Voted', 
      cell: info => 
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          info.getValue() 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {info.getValue() ? 'Yes' : 'No'}
        </span>,
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
  ], [columnHelper]);

  // Fetch voters function
  const fetchVoters = async () => {
    // No need to set loading true here if it's called by realtime updates
    // setLoading(true); 
    setError(null);

    try {
      // Select all required columns explicitly, removed created_at
      const { data, error: fetchError } = await supabase
        .from('avp_voters')
        .select('id, alliance, family, register, register_sect, gender, first_name, father_name, last_name, mother_name, full_name, situation, dob, sect, residence, has_voted')
        .order('full_name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setVoters(data || []);

    } catch (err: any) {
      setError(err.message || 'Failed to fetch voters. Check RLS policies and network.');
      setVoters([]); // Clear voters on error
    } finally {
      // Only set loading false on initial load or explicit refresh
      // setLoading(false); 
    }
  };

  // Initial data fetch and real-time subscription setup
  useEffect(() => {
    if (profile?.voters_list_access === 'none') {
      setError('You do not have permission to view this page.');
      setLoading(false);
      return;
    }

    setLoading(true); // Set loading true for the initial fetch
    fetchVoters().finally(() => setLoading(false)); // Fetch initial data and then set loading false

    const channel = supabase
      .channel('voter-list-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'avp_voters' },
        (payload) => {
          console.log('Change received!', payload);
          // Refetch data when changes occur
          fetchVoters(); 
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to voter list changes!');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error:', err);
          setError(`Realtime connection failed: ${err?.message}`);
        }
        if (status === 'TIMED_OUT') {
          console.warn('Realtime connection timed out.');
          setError('Realtime connection timed out. Please refresh.');
        }
      });

    // Cleanup function to remove the channel subscription
    return () => {
      supabase.removeChannel(channel);
    };

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
    initialState: {
      pagination: {
        pageSize: 10, // Default page size
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

  // Calculate voted stats
  const votedCount = voters.filter(voter => voter.has_voted).length;
  const totalVoters = voters.length;
  const votedPercentage = totalVoters > 0 ? Math.round((votedCount / totalVoters) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-900 min-h-screen">
      <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">Voter's List</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Manage and monitor registered voters</p>
      
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
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-green-100 dark:border-green-900">
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
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{votedPercentage}%</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{votedCount} of {totalVoters}</p>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full" 
              style={{ width: `${votedPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6 border border-blue-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          {/* Search Input */}
          <div className="relative flex-1 sm:min-w-[300px]">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <i className="fas fa-search w-5 h-5 text-gray-500 dark:text-gray-400"></i>
            </div>
            <input
              type="search"
              className="block w-full pl-10 pr-4 py-2.5 text-gray-900 dark:text-white dark:bg-gray-700 border border-blue-200 dark:border-gray-600 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              placeholder="Search by name, family, alliance..."
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
            />
          </div>
          {/* View Mode Buttons */}
          <div className="flex bg-gray-50 dark:bg-gray-700 rounded-lg p-1 shadow-inner">
            <button
              onClick={() => {
                setViewMode('table');
                userSelectedViewMode.current = true;
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
            <button
              onClick={() => {
                setViewMode('card');
                userSelectedViewMode.current = true;
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
                            className="cursor-pointer whitespace-nowrap flex items-center"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                            {/* Sorting indicators with FontAwesome */}
                            {header.column.getIsSorted() === 'asc' && (
                              <i className="fas fa-sort-up ml-1.5 text-blue-600 dark:text-blue-400"></i>
                            )}
                            {header.column.getIsSorted() === 'desc' && (
                              <i className="fas fa-sort-down ml-1.5 text-blue-600 dark:text-blue-400"></i>
                            )}
                            {/* Add indicator for sortable columns that are not currently sorted */}
                            {header.column.getCanSort() && !header.column.getIsSorted() && (
                              <i className="fas fa-sort ml-1.5 text-gray-400 opacity-30 group-hover:opacity-70 transition-opacity"></i>
                            )}
                          </div>
                        </div>
                        
                        {/* Add column filters */}
                        {header.column.getCanFilter() ? (
                          <div className="mt-2">
                            {/* Use SelectFilter for 'family', 'register', etc. */}
                            {header.column.id === 'family' || header.column.id === 'register' || header.column.id === 'gender' || header.column.id === 'sect' || header.column.id === 'register_sect' || header.column.id === 'alliance' ? (
                              <SelectFilter column={header.column} table={table} />
                            ) : header.column.id === 'has_voted' ? (
                              <BooleanFilter column={header.column} table={table} />
                            ) : header.column.id === 'dob' ? (
                              <YearFilter column={header.column} table={table} />
                            ) : (
                              <TextFilter column={header.column} table={table} />
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
    </div>
  );
};

// Filter components moved outside VoterList to prevent re-creation on every render

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
    // Default sort (existing logic)
    return arr.sort((a, b) => {
      if (a === '__EMPTY__') return -1;
      if (b === '__EMPTY__') return 1;
      return String(a).localeCompare(String(b));
    });
  }, [column.id, table.getPreFilteredRowModel().flatRows]);
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
const BooleanFilter: React.FC<{ column: any; table: any }> = React.memo(({ column, table }) => {
  const columnFilterValue = column.getFilterValue() ?? '';
  // Check if there are any null/empty values
  const hasEmpty = table.getPreFilteredRowModel().flatRows.some((row: any) => {
    const v = row.getValue(column.id);
    return v === null || v === undefined || v === '';
  });
  return (
    <select
      value={columnFilterValue}
      onChange={e => column.setFilterValue(e.target.value)}
      className="w-full px-2 py-1 text-xs border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
    >
      <option value="">All</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
      {hasEmpty && <option value="__EMPTY__">-</option>}
    </select>
  );
});

// Year Filter component for DOB column
const YearFilter: React.FC<{ column: any; table: any }> = React.memo(({ column, table }) => {
  const columnFilterValue = column.getFilterValue() ?? '';
  const yearOptions = React.useMemo(() => {
    const dobValues = table.getPreFilteredRowModel().flatRows
      .map((row: any) => row.getValue(column.id))
      .map((dob: string) => {
        if (!dob) return '__EMPTY__';
        try {
          return new Date(`${dob}T12:00:00Z`).getUTCFullYear();
        } catch {
          return '__EMPTY__';
        }
      });
    const set = new Set(dobValues);
    return Array.from(set).sort((a, b) => {
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
      {yearOptions.map(year => (
        <option key={year} value={year}>
          {year === '__EMPTY__' ? '-' : year}
        </option>
      ))}
    </select>
  );
});

export default VoterList;
