import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState
} from '@tanstack/react-table';
import ExportExcelModal from '../components/ExportExcelModal';
import { exportTableDataToExcel } from '../utils/excelExport';
import Toast from '../components/Toast';

interface Ballot {
  id: number;
  ballot_id: number;
  candidate_id: number;
  vote: number;
  ballot_type: string;
  ballot_source: string;
  post_date: string;
}

interface Candidate {
  id: number;
  full_name: string;
}

interface FormattedBallot {
  ballot_id: number;
  candidate_votes: {[key: number]: number | string};
  ballot_type: string;
  post_date: string;
  is_valid: boolean;
  is_blank: boolean;
}

const BallotAnalysis = () => {
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [formattedBallots, setFormattedBallots] = useState<FormattedBallot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidateIds, setCandidateIds] = useState<number[]>([]);
  const [candidates, setCandidates] = useState<{[key: number]: Candidate}>({});
  const [sorting, setSorting] = useState<SortingState>([{ id: 'post_date', desc: true }]);
  const { profile } = useAuthStore();
  
  // Export modal states
  const [exportExcelModalOpen, setExportExcelModalOpen] = useState(false);
  // Toast state for notifications
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);
  
  // Close toast function
  const closeToast = () => {
    setToast(null);
  };

  // Fetch all ballots and candidates
  useEffect(() => {
    const fetchBallotsAndCandidates = async () => {
      setLoading(true);
      try {
        // Get all candidates with their full_name from avp_voters
        const { data: candidateData, error: candidateError } = await supabase
          .from('avp_candidates')
          .select(`
            id,
            avp_voters!inner(full_name)
          `)
          .order('id');

        if (candidateError) {
          throw candidateError;
        }

        // Map candidates by ID for easy lookup, extracting full_name from the joined voters table
        const candidatesMap: {[key: number]: Candidate} = {};
        candidateData.forEach((candidate) => {
          candidatesMap[candidate.id] = {
            id: candidate.id,
            full_name: (candidate.avp_voters as any)?.full_name || `Candidate ${candidate.id}`
          };
        });

        setCandidates(candidatesMap);
        const sortedCandidateIds = candidateData.map(c => c.id);
        setCandidateIds(sortedCandidateIds);

        // Then fetch all ballots (fetch in batches to avoid row limit)
        let allRows: Ballot[] = [];
        let start = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('avp_ballots')
            .select('*')
            .order('post_date', { ascending: false })
            .range(start, start + pageSize - 1);
          if (error) {
            throw error;
          }
          if (!data || data.length === 0) break;
          allRows = allRows.concat(data as Ballot[]);
          if (data.length < pageSize) break;
          start += pageSize;
        }
        setBallots(allRows);
        // Process the ballots to format them as required for the table
        const processed = processBallotsData(allRows, sortedCandidateIds);
        setFormattedBallots(processed);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch ballot data');
      } finally {
        setLoading(false);
      }
    };

    fetchBallotsAndCandidates();
  }, []);

  // Process raw ballot data into the format needed for display
  const processBallotsData = (ballots: Ballot[], candidateIds: number[]): FormattedBallot[] => {
    // Group ballots by ballot_id
    const ballotGroups: {[key: number]: Ballot[]} = {};
    
    for (const ballot of ballots) {
      if (!ballotGroups[ballot.ballot_id]) {
        ballotGroups[ballot.ballot_id] = [];
      }
      ballotGroups[ballot.ballot_id].push(ballot);
    }

    // Format each group into a single row
    return Object.entries(ballotGroups).map(([ballotId, groupBallots]) => {
      const candidateVotes: {[key: number]: number | string} = {};
      let isBlank = true;
      let isValid = true;
      
      // Initialize all candidates with "-" (blank)
      candidateIds.forEach(id => {
        candidateVotes[id] = "-";
      });
      
      // Fill in the actual votes
      for (const ballot of groupBallots) {
        // Simply use the actual vote value
        candidateVotes[ballot.candidate_id] = ballot.vote;
        
        // Check if this is a blank ballot
        if (ballot.vote !== 0) {
          isBlank = false;
        }
      }
      
      // Determine if valid or invalid based on ballot_type
      isValid = groupBallots[0].ballot_type === 'valid';

      // Get ballot type and date from the first ballot in the group
      const firstBallot = groupBallots[0];
      
      return {
        ballot_id: parseInt(ballotId),
        candidate_votes: candidateVotes,
        ballot_type: firstBallot.ballot_type,
        post_date: new Date(firstBallot.post_date).toLocaleString('en-US', { timeZone: 'Asia/Beirut' }),
        is_valid: isValid,
        is_blank: isBlank
      };
    });
  };

  // Define ballot status
  const getBallotStatus = (ballot: FormattedBallot): string => {
    if (ballot.is_blank) return "Blank";
    if (!ballot.is_valid) return "Invalid";
    return "Valid";
  };

  // Get appropriate CSS class for the ballot status
  const getBallotStatusClass = (status: string): string => {
    switch (status) {
      case "Valid":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Invalid":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "Blank":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
      default:
        return "";
    }
  };

  // Count statistics
  const validBallots = formattedBallots.filter(b => !b.is_blank && b.is_valid).length;
  const invalidBallots = formattedBallots.filter(b => !b.is_blank && !b.is_valid).length;
  const blankBallots = formattedBallots.filter(b => b.is_blank).length;
  const totalBallots = formattedBallots.length;

  // Setup table with pagination
  const columnHelper = createColumnHelper<FormattedBallot>();
  const columns = useMemo(() => [
    columnHelper.accessor('ballot_id', {
      header: 'Ballot #',
      cell: info => info.getValue(),
    }),
    ...candidateIds.map(id => 
      columnHelper.accessor(
        row => row.candidate_votes[id], 
        {
          id: `candidate-${id}`,
          header: candidates[id]?.full_name || `Candidate ${id}`,
          cell: info => {
            const value = info.getValue();
            const row = info.row.original;
            const isInvalid = !row.is_valid && !row.is_blank;
            
            return (
              <span className={`${
                value === 1 && !isInvalid ? 'text-green-600 dark:text-green-400 font-bold' : 
                value === 1 && isInvalid ? 'text-amber-600 dark:text-amber-400 font-bold' : // Invalid but checked
                value === 0 ? 'text-gray-500 dark:text-gray-400' :
                value === "-" ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-400 dark:text-gray-500'
              }`}>
                {value}
              </span>
            );
          }
        }
      )
    ),
    columnHelper.accessor('post_date', {
      header: ({ column }) => {
        return (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 group"
          >
            Timestamp
            <span className="text-gray-400 dark:text-gray-500">
              {column.getIsSorted() === "asc" ? (
                <i className="fas fa-sort-up"></i>
              ) : column.getIsSorted() === "desc" ? (
                <i className="fas fa-sort-down"></i>
              ) : (
                <i className="fas fa-sort opacity-50"></i>
              )}
            </span>
          </button>
        );
      },
      cell: info => info.getValue(),
    }),
    columnHelper.accessor(
      row => getBallotStatus(row),
      {
        id: 'status',
        header: 'Status',
        cell: info => {
          const status = info.getValue();
          return (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getBallotStatusClass(status)}`}>
              {status}
            </span>
          );
        }
      }
    ),
  ], [candidateIds, candidates]);

  const table = useReactTable({
    data: formattedBallots,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
      sorting: [
        {
          id: 'post_date',
          desc: true,
        },
      ],
    },
  });

  // Available columns for export
  const availableColumns = useMemo(() => [
    { id: 'ballot_id', label: 'Ballot #' },
    ...candidateIds.map(id => ({
      id: `candidate-${id}`,
      label: candidates[id]?.full_name || `Candidate ${id}`
    })),
    { id: 'post_date', label: 'Timestamp' },
    { id: 'status', label: 'Status' }
  ], [candidateIds, candidates]);

  // Generate and download Excel function
  const handleExportExcel = async (fileName: string) => {
    try {
      setToast({
        message: 'Preparing Excel export...',
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

      // Create headers for Excel
      const headers = [
        'Ballot #',
        ...candidateIds.map(id => candidates[id]?.full_name || `Candidate ${id}`),
        'Timestamp',
        'Status'
      ];

      // Format row data
      const rows = filteredData.map(ballot => {
        const status = getBallotStatus(ballot);
        return [
          ballot.ballot_id.toString(),
          ...candidateIds.map(id => {
            const value = ballot.candidate_votes[id];
            return value === null || value === undefined ? '-' : String(value);
          }),
          ballot.post_date,
          status
        ];
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

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8 bg-red-100 dark:bg-red-900 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-200">Unauthorized Access</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            You do not have permission to view this page. This page is only accessible by administrators.
          </p>
        </div>
      </div>
    );
  }

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
              {Array.from({ length: 4 }).map((_, i) => (
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
                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: (candidateIds.length || 3) + 2 }).map((_, colIndex) => (
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
      
      {/* Export Excel Modal */}
      <ExportExcelModal
        isOpen={exportExcelModalOpen}
        onClose={() => setExportExcelModalOpen(false)}
        onExport={handleExportExcel}
        defaultFileName="BallotAnalysis.xlsx"
      />
      
      <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">Ballot Analysis</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Review and analyze all submitted ballots</p>
      
      {/* Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-blue-100 dark:border-blue-900">
          <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Ballots</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{totalBallots}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-green-100 dark:border-green-900">
          <div className="rounded-full bg-green-100 dark:bg-green-900 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Valid Ballots</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{validBallots}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-red-100 dark:border-red-900">
          <div className="rounded-full bg-red-100 dark:bg-red-900 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Invalid Ballots</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{invalidBallots}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex items-center border border-gray-100 dark:border-gray-700">
          <div className="rounded-full bg-gray-100 dark:bg-gray-700 p-3 mr-4 flex items-center justify-center w-12 h-12">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Blank Ballots</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{blankBallots}</p>
          </div>
        </div>
      </div>

      {/* Ballot validity chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-blue-100 dark:border-gray-700 mb-6">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Ballot Validity Distribution</h3>
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block py-1 px-2 rounded-full text-green-600 bg-green-200 dark:bg-green-900 dark:text-green-300">
                Valid: {validBallots} ({totalBallots > 0 ? Math.round((validBallots / totalBallots) * 100) : 0}%)
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold inline-block py-1 px-2 rounded-full text-red-600 bg-red-200 dark:bg-red-900 dark:text-red-300">
                Invalid: {invalidBallots} ({totalBallots > 0 ? Math.round((invalidBallots / totalBallots) * 100) : 0}%)
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold inline-block py-1 px-2 rounded-full text-gray-600 bg-gray-200 dark:bg-gray-700 dark:text-gray-300">
                Blank: {blankBallots} ({totalBallots > 0 ? Math.round((blankBallots / totalBallots) * 100) : 0}%)
              </span>
            </div>
          </div>
          <div className="flex h-4 mb-4 rounded-full overflow-hidden">
            <div 
              style={{ width: `${totalBallots > 0 ? (validBallots / totalBallots) * 100 : 0}%` }} 
              className="bg-green-500 dark:bg-green-600 flex flex-col text-center whitespace-nowrap text-white justify-center shadow-none"
            ></div>
            <div 
              style={{ width: `${totalBallots > 0 ? (invalidBallots / totalBallots) * 100 : 0}%` }} 
              className="bg-red-500 dark:bg-red-600 flex flex-col text-center whitespace-nowrap text-white justify-center shadow-none"
            ></div>
            <div 
              style={{ width: `${totalBallots > 0 ? (blankBallots / totalBallots) * 100 : 0}%` }} 
              className="bg-gray-500 dark:bg-gray-600 flex flex-col text-center whitespace-nowrap text-white justify-center shadow-none"
            ></div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-blue-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-blue-100 dark:border-gray-700 bg-blue-50 dark:bg-gray-750 flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2 sm:mb-0">Detailed Ballot Analysis</h3>
          
          {/* Export buttons */}
          <div className="flex items-center space-x-2 justify-end">
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
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {table.getFlatHeaders().map(header => (
                  <th key={header.id} className="px-6 py-3.5 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={table.getFlatHeaders().length} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No ballots found. Ballots will appear here once they are submitted.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => {
                  const ballot = row.original;
                  const status = getBallotStatus(ballot);
                  
                  return (
                    <tr 
                      key={`ballot-${ballot.ballot_id}`}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        status === 'Invalid' ? 'bg-red-50 dark:bg-red-900/20' : 
                        status === 'Blank' ? 'bg-gray-50 dark:bg-gray-700/30' : 
                        'bg-white dark:bg-gray-800'
                      }`}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {table.getRowModel().rows.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 pb-6">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <span>
                Showing <span className="font-semibold text-blue-900 dark:text-blue-300">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{" "}
                <span className="font-semibold text-blue-900 dark:text-blue-300">
                  {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, formattedBallots.length)}
                </span> of{" "}
                <span className="font-semibold text-blue-900 dark:text-blue-300">{formattedBallots.length}</span> ballots
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
                  {[10, 20, 50, 100].map(pageSize => (
                    <option key={pageSize} value={pageSize}>
                      {pageSize}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BallotAnalysis;