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
      <div className="p-6">
        <div className="mb-4">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-6"></div>
          <div className="h-10 w-full bg-gray-200 rounded animate-pulse mb-6"></div>
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 bg-gray-200 rounded animate-pulse my-2 w-32 inline-block mx-4"></div>
            ))}
          </div>
          
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div key={rowIndex} className="flex py-3 px-4">
                {Array.from({ length: 5 }).map((_, colIndex) => (
                  <div key={colIndex} className="h-6 bg-gray-200 rounded animate-pulse mx-4 w-32"></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-3xl font-bold text-blue-800">Voter List</h2>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* Search Input */}
              <div className="relative flex-1 sm:min-w-[300px]">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="search"
                  className="block w-full pl-10 pr-4 py-2 text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search voters..."
                  value={globalFilter ?? ''}
                  onChange={e => setGlobalFilter(e.target.value)}
                />
              </div>
              
              {/* View Mode Switch */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => {
                    setViewMode('table');
                    userSelectedViewMode.current = true;
                  }}
                  className={`px-3 py-1 rounded-md text-sm ${
                    viewMode === 'table'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Table
                </button>
                <button
                  onClick={() => {
                    setViewMode('card');
                    userSelectedViewMode.current = true;
                  }}
                  className={`px-3 py-1 rounded-md text-sm ${
                    viewMode === 'card'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Cards
                </button>
              </div>
            </div>
          </div>
          
          {voters.length === 0 && !loading ? (
            <div className="text-center py-10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="mt-4 text-gray-500 text-lg">No voters found.</p>
            </div>
          ) : (
            <>
              {/* Table View */}
              {viewMode === 'table' && (
                <div className="overflow-x-auto shadow rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map(header => (
                            <th 
                              key={header.id} 
                              scope="col" 
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
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
                                {{
                                  asc: <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                  </svg>,
                                  desc: <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>,
                                }[header.column.getIsSorted() as string] ?? null}
                              </div>
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {table.getRowModel().rows.map(row => (
                        <tr key={row.id} className="hover:bg-gray-50">
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
              
              {/* Card View */}
              {viewMode === 'card' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {table.getRowModel().rows.map(row => {
                    const voter = row.original;
                    return (
                      <div key={row.id} className="bg-white rounded-lg shadow border border-gray-100 p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-800">{voter.full_name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            voter.has_voted 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {voter.has_voted ? 'Voted' : 'Not Voted'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div className="space-y-2">
                            {voter.family && (
                              <p><span className="text-gray-500">Family:</span> {voter.family}</p>
                            )}
                            {voter.alliance && (
                              <p><span className="text-gray-500">Alliance:</span> {voter.alliance}</p>
                            )}
                            {voter.register && (
                              <p><span className="text-gray-500">Register:</span> {voter.register}</p>
                            )}
                            {voter.register_sect && (
                              <p><span className="text-gray-500">Register Sect:</span> {voter.register_sect}</p>
                            )}
                            {voter.sect && (
                              <p><span className="text-gray-500">Sect:</span> {voter.sect}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            {voter.father_name && (
                              <p><span className="text-gray-500">Father:</span> {voter.father_name}</p>
                            )}
                            {voter.mother_name && (
                              <p><span className="text-gray-500">Mother:</span> {voter.mother_name}</p>
                            )}
                            {voter.gender && (
                              <p><span className="text-gray-500">Gender:</span> {voter.gender}</p>
                            )}
                            {voter.residence && (
                              <p><span className="text-gray-500">Residence:</span> {voter.residence}</p>
                            )}
                            {voter.dob && (
                              <p><span className="text-gray-500">DOB:</span> {new Date(voter.dob).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                        
                        {voter.situation && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p><span className="text-gray-500">Situation:</span> {voter.situation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Pagination Controls - Styled like AdminPage */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
                {/* Items count info */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">
                    Showing <span className="font-medium">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{" "}
                    <span className="font-medium">
                      {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, voters.length)}
                    </span> of{" "}
                    <span className="font-medium">{voters.length}</span> voters
                  </span>
                </div>

                {/* Navigation buttons with page numbers */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                    className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
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
                    className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
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
                      
                      // Logic for which page numbers to display
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
                          className={`px-3 py-1 mx-1 rounded-md text-sm font-medium border ${
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
                  
                  {/* Mobile pagination display */}
                  <div className="sm:hidden flex items-center">
                    <span className="px-3 py-1 text-sm text-gray-700">
                      Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                    </span>
                  </div>

                  <button
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
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
                    className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                    aria-label="Go to last page"
                    title="Last page"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M4.21 5.23a.75.75 0 011.06-.02l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 11-1.04-1.08L8.168 10 4.23 6.29a.75.75 0 01-.02-1.06zm6 0a.75.75 0 011.06-.02l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 11-1.04-1.08L14.168 10l-3.938-3.71a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                {/* Page size selector */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">
                    Per page:
                    <select
                      value={table.getState().pagination.pageSize}
                      onChange={e => {
                        table.setPageSize(Number(e.target.value));
                      }}
                      className="ml-2 px-3 py-1 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
    </div>
  );
};

export default VoterList;
