import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { 
  createColumnHelper, 
  flexRender, 
  getCoreRowModel, 
  useReactTable,
  getPaginationRowModel
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

  // Define table columns using TanStack Table helpers
  const columnHelper = createColumnHelper<Voter>();
  const columns = useMemo(() => [
    columnHelper.accessor('full_name', { header: 'Full Name', cell: info => info.getValue() }),
    columnHelper.accessor('alliance', { header: 'Alliance', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('family', { header: 'Family', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('register', { header: 'Register', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('register_sect', { header: 'Register Sect', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('gender', { header: 'Gender', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('first_name', { header: 'First Name', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('father_name', { header: 'Father Name', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('last_name', { header: 'Last Name', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('mother_name', { header: 'Mother Name', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('situation', { header: 'Situation', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('dob', { header: 'DOB', cell: info => info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : '-' }),
    columnHelper.accessor('sect', { header: 'Sect', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('residence', { header: 'Residence', cell: info => info.getValue() ?? '-' }),
    columnHelper.accessor('has_voted', { header: 'Has Voted', cell: info => info.getValue() ? 'Yes' : 'No' }),
    // Add more columns as needed based on the Voter interface
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
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10, // Default page size
      },
    },
  });

  if (loading) {
    return <div className="p-6 text-center">Loading voter list...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <h2 className="text-3xl font-bold text-blue-800">Voter List</h2>
      </div>
      
      {voters.length === 0 && !loading ? (
        <p>No voters found.</p>
      ) : (
        <>
          {/* Table */}
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
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
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

              <div className="flex items-center">
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
                          ? 'bg-red-600 text-white border-red-600' 
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
                  className="ml-2 px-3 py-1 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
  );
};

export default VoterList;
