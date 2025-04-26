import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
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
  register: string | null;
  register_sect: string | null;
  gender: string | null;
  first_name: string | null;
  father_name: string | null;
  last_name: string | null;
  mother_name: string | null;
  full_name: string; // Assuming full_name is non-nullable
  situation: string | null;
  dob: string | null; // Date of birth - might need formatting
  sect: string | null;
  residence: string | null;
  has_voted: boolean; // Keep this field as well
}

const VoterList: React.FC = () => {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuthStore();
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
    }),
    columnHelper.accessor('alliance', { 
      header: 'Alliance', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('family', { 
      header: 'Family', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('register', { 
      header: 'Register', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('register_sect', { 
      header: 'Register Sect', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('gender', { 
      header: 'Gender', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('first_name', { 
      header: 'First Name', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('father_name', { 
      header: 'Father Name', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('last_name', { 
      header: 'Last Name', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('mother_name', { 
      header: 'Mother Name', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('situation', { 
      header: 'Situation', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('dob', { 
      header: 'DOB', 
      cell: info => info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : '-',
      enableSorting: true,
    }),
    columnHelper.accessor('sect', { 
      header: 'Sect', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
    }),
    columnHelper.accessor('residence', { 
      header: 'Residence', 
      cell: info => info.getValue() ?? '-',
      enableSorting: true,
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
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="mb-6">
          <div className="h-10 w-72 bg-gray-200 rounded-md animate-pulse mb-6"></div>
          <div className="h-12 w-full bg-gray-200 rounded-md animate-pulse mb-8"></div>
        </div>
        
        <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-gray-50 px-4 py-4">
            <div className="flex justify-between">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 rounded-md animate-pulse my-2 w-32"></div>
              ))}
            </div>
          </div>
          
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div key={rowIndex} className="py-4 px-6 animate-pulse">
                <div className="flex justify-between items-center mb-3">
                  <div className="h-6 bg-gray-200 rounded-md w-48"></div>
                  <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, colIndex) => (
                    <div key={colIndex} className="h-5 bg-gray-200 rounded-md w-full"></div>
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
      <div className="p-6 text-center bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg shadow-sm max-w-lg">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 mr-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700 text-lg font-medium">{error}</p>
          </div>
          <p className="mt-3 text-red-600 text-sm">Please try refreshing the page or contact an administrator.</p>
        </div>
      </div>
    );
  }

  // Calculate voted stats
  const votedCount = voters.filter(voter => voter.has_voted).length;
  const totalVoters = voters.length;
  const votedPercentage = totalVoters > 0 ? Math.round((votedCount / totalVoters) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold mb-2 text-blue-800">Voter's List</h2>
      <p className="text-gray-600 mb-6">Manage and monitor registered voters</p>
      
      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center">
          <div className="rounded-full bg-blue-100 p-3 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Voters</p>
            <p className="text-2xl font-bold text-gray-800">{totalVoters}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center">
          <div className="rounded-full bg-green-100 p-3 mr-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Voted</p>
            <p className="text-2xl font-bold text-gray-800">{votedCount}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500 font-medium mb-2">Participation Rate</p>
          <div className="flex items-center justify-between mb-1">
            <p className="text-2xl font-bold text-gray-800">{votedPercentage}%</p>
            <p className="text-sm text-gray-500">{votedCount} of {totalVoters}</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${votedPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          {/* Search Input */}
          <div className="relative flex-1 sm:min-w-[300px]">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="search"
              className="block w-full pl-10 pr-4 py-2.5 text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              placeholder="Search by name, family, alliance..."
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
            />
          </div>
          {/* View Mode Buttons */}
          <div className="flex bg-gray-100 rounded-lg p-1 shadow-inner">
            <button
              onClick={() => {
                setViewMode('table');
                userSelectedViewMode.current = true;
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
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
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Cards
              </div>
            </button>
          </div>
        </div>
        
        {viewMode === 'table' && (
          <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id} 
                        scope="col" 
                        className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
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
                            <svg xmlns="http://www.w3.org/2000/svg" className="ml-1.5 h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                          {header.column.getIsSorted() === 'desc' && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="ml-1.5 h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-blue-50 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td 
                        key={cell.id} 
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {table.getRowModel().rows.map(row => {
              const voter = row.original;
              return (
                <div key={row.id} 
                  className={`bg-white rounded-lg shadow-sm border ${voter.has_voted 
                    ? 'border-green-200 hover:shadow-green-100' 
                    : 'border-gray-100 hover:shadow-blue-100'} 
                    p-5 hover:shadow-md transition-all duration-200`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 truncate">{voter.full_name}</h3>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      voter.has_voted 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {voter.has_voted ? 'Voted' : 'Not Voted'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="space-y-2">
                      {voter.family && (
                        <p className="flex items-center"><span className="text-gray-500 w-16 flex-shrink-0">Family:</span> <span className="font-medium text-gray-700">{voter.family}</span></p>
                      )}
                      {voter.alliance && (
                        <p className="flex items-center"><span className="text-gray-500 w-16 flex-shrink-0">Alliance:</span> <span className="font-medium text-gray-700">{voter.alliance}</span></p>
                      )}
                      {voter.register && (
                        <p className="flex items-center"><span className="text-gray-500 w-16 flex-shrink-0">Register:</span> <span className="font-medium text-gray-700">{voter.register}</span></p>
                      )}
                      {voter.register_sect && (
                        <p className="flex items-center"><span className="text-gray-500 w-16 flex-shrink-0">Reg. Sect:</span> <span className="font-medium text-gray-700">{voter.register_sect}</span></p>
                      )}
                      {voter.sect && (
                        <p className="flex items-center"><span className="text-gray-500 w-16 flex-shrink-0">Sect:</span> <span className="font-medium text-gray-700">{voter.sect}</span></p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {voter.father_name && (
                        <p className="flex items-center"><span className="text-gray-500 w-16 flex-shrink-0">Father:</span> <span className="font-medium text-gray-700">{voter.father_name}</span></p>
                      )}
                      {voter.mother_name && (
                        <p className="flex items-center"><span className="text-gray-500 w-16 flex-shrink-0">Mother:</span> <span className="font-medium text-gray-700">{voter.mother_name}</span></p>
                      )}
                      {voter.gender && (
                        <p className="flex items-center"><span className="text-gray-500 w-16 flex-shrink-0">Gender:</span> <span className="font-medium text-gray-700">{voter.gender}</span></p>
                      )}
                      {voter.residence && (
                        <p className="flex items-center"><span className="text-gray-500 w-16 flex-shrink-0">Residence:</span> <span className="font-medium text-gray-700">{voter.residence}</span></p>
                      )}
                      {voter.dob && (
                        <p className="flex items-center"><span className="text-gray-500 w-16 flex-shrink-0">DOB:</span> <span className="font-medium text-gray-700">{new Date(voter.dob).toLocaleDateString()}</span></p>
                      )}
                    </div>
                  </div>
                  
                  {voter.situation && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="flex items-start">
                        <span className="text-gray-500 w-20 flex-shrink-0">Situation:</span> 
                        <span className="font-medium text-gray-700">{voter.situation}</span>
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
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span>
              Showing <span className="font-semibold text-gray-900">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{" "}
              <span className="font-semibold text-gray-900">
                {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, voters.length)}
              </span> of{" "}
              <span className="font-semibold text-gray-900">{voters.length}</span> voters
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              aria-label="Go to first page"
              title="First page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M15.79 14.77a.75.75 0 01-1.06.02l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 111.04 1.08L11.832 10l3.938 3.71a.75.75 0 01.02 1.06zm-6 0a.75.75 0 01-1.06.02l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 111.04 1.08L5.832 10l3.938 3.71a.75.75 0 01.02 1.06z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              aria-label="Go to previous page"
              title="Previous page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
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
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
              <span className="px-3 py-1.5 text-sm text-gray-700 font-medium">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
            </div>

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              aria-label="Go to next page"
              title="Next page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              aria-label="Go to last page"
              title="Last page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M4.21 5.23a.75.75 0 011.06-.02l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 11-1.04-1.08L8.168 10 4.23 6.29a.75.75 0 01-.02-1.06zm6 0a.75.75 0 011.06-.02l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 11-1.04-1.08L14.168 10l-3.938-3.71a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              Per page:
              <select
                value={table.getState().pagination.pageSize}
                onChange={e => {
                  table.setPageSize(Number(e.target.value));
                }}
                className="ml-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

export default VoterList;
