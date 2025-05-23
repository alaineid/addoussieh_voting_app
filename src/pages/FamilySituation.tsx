import React, { useState, useEffect, useRef } from 'react';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { useRealtime } from '../lib/useRealtime';
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  flexRender,
  getSortedRowModel,
  SortingState,
  getPaginationRowModel
} from '@tanstack/react-table';
import SimplePDFModal from '../components/SimplePDFModal';
import ExportExcelModal from '../components/ExportExcelModal';
import { exportTableDataToExcel } from '../utils/excelExport';
import { exportDataToPDF } from '../utils/pdfExport';

interface FamilyStatistics {
  family: string;
  AGAINST: number;
  DEATH: number;
  IMMIGRANT: number;
  MILITARY: number;
  N: number;
  N_PLUS: number;
  N_MINUS: number;
  NO_VOTE: number;
  WITH_FLAG: number;
  UNKNOWN: number;
}

// Formatted column names for display
const displayColumnNames: Record<string, string> = {
  AGAINST: 'Against',
  DEATH: 'Death',
  IMMIGRANT: 'Immigrant',
  MILITARY: 'Military',
  N: 'N',
  N_PLUS: 'N+',
  N_MINUS: 'N-',
  NO_VOTE: 'No Vote',
  WITH_FLAG: 'With',
  UNKNOWN: 'Unknown'
}; 

// Toast notification component for messages
const Toast: React.FC<{
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: 'bg-green-100 border-green-400 text-green-700 dark:bg-green-900/30 dark:border-green-500 dark:text-green-300',
    error: 'bg-red-100 border-red-400 text-red-700 dark:bg-red-900/30 dark:border-red-500 dark:text-red-300',
    info: 'bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-500 dark:text-yellow-300'
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className={`border-l-4 p-4 shadow-md rounded-r-lg ${bgColor[type]} flex justify-between items-center`}>
        <div className="flex items-center">
          {type === 'success' && <i className="fas fa-check-circle mr-2"></i>}
          {type === 'error' && <i className="fas fa-exclamation-circle mr-2"></i>}
          {type === 'info' && <i className="fas fa-info-circle mr-2"></i>}
          {type === 'warning' && <i className="fas fa-exclamation-triangle mr-2"></i>}
          <span>{message}</span>
        </div>
        <button onClick={onClose} className="ml-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  );
};

// Simple debug component to show raw SQL results
const RawFamilyStats: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [rawData, setRawData] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchRawData = async () => {
      try {
        // Call the function directly using rpc rather than treating it as a table
        const { data, error } = await supabase
          .rpc('get_family_statistics')
          .select('*');

        if (error) throw error;
        setRawData(data);
      } catch (err: any) {
        console.error('Error fetching raw stats:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRawData();
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300">Raw Database Results</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4">
          {loading && <p className="text-center text-gray-600 dark:text-gray-400">Loading raw data...</p>}
          
          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-md text-red-700 dark:text-red-300">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}
          
          {rawData && (
            <>
              <p className="mb-2 text-gray-600 dark:text-gray-400">Total rows: {rawData.length}</p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border dark:border-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {rawData.length > 0 && Object.keys(rawData[0]).map(key => (
                        <th 
                          key={key} 
                          className="px-3 py-2 text-left text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wider"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {rawData.map((row, i) => (
                      <tr key={i} className="hover:bg-blue-50 dark:hover:bg-blue-900/30">
                        {Object.entries(row).map(([key, value]) => (
                          <td key={key} className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {value === null ? 'null' : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Raw JSON:</h3>
                <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-md text-xs overflow-auto max-h-60">
                  {JSON.stringify(rawData, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
        
        <div className="p-4 border-t dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const FamilySituation: React.FC = () => {
  const { isDarkMode } = useThemeStore();
  const { profile } = useAuthStore();
  const [familyStats, setFamilyStats] = useState<FamilyStatistics[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [totalStats, setTotalStats] = useState<FamilyStatistics | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);
  // Add state for accordion
  const [summaryExpanded, setSummaryExpanded] = useState<boolean>(true);
  // Add state for export modals
  const [exportPdfModalOpen, setExportPdfModalOpen] = useState(false);
  const [exportExcelModalOpen, setExportExcelModalOpen] = useState(false);
  
  // Check if user has permission to view the page
  const hasPermission = profile?.family_situation_access === 'view' || profile?.family_situation_access === 'edit';

  // Function to toggle accordion
  const toggleSummary = () => {
    setSummaryExpanded(!summaryExpanded);
  };

  // Function to fetch family statistics
  const fetchFamilyStatistics = async () => {
    setError(null);

    try {
      // Use rpc() to call the database function properly
      const { data, error: fetchError } = await supabase
        .rpc('get_family_statistics');

      if (fetchError) {
        throw fetchError;
      }

      console.log("Raw data from get_family_statistics:", data);

      // The total row is the first row in the result
      const totalRow = data && data.length > 0 ? data.find(row => row.family === 'Total') : null;
      
      // Filter out the Total row and just display family rows
      const familyRows = data?.filter((row: any) => row.family !== 'Total').map((row: any) => ({
        family: row.family || 'Unnamed',
        AGAINST: row.against || 0,  // Note: column names might be lowercase in the raw results
        DEATH: row.death || 0,
        IMMIGRANT: row.immigrant || 0,
        MILITARY: row.military || 0,
        N: row.n || 0,
        N_PLUS: row.n_plus || 0,
        N_MINUS: row.n_minus || 0,
        NO_VOTE: row.no_vote || 0,
        WITH_FLAG: row.with_flag || 0,
        UNKNOWN: row.unknown || 0
      })) || [];

      setFamilyStats(familyRows);
      
      // Set total stats for summary cards
      if (totalRow) {
        setTotalStats({
          family: totalRow.family,
          AGAINST: totalRow.against || 0,
          DEATH: totalRow.death || 0, 
          IMMIGRANT: totalRow.immigrant || 0,
          MILITARY: totalRow.military || 0,
          N: totalRow.n || 0,
          N_PLUS: totalRow.n_plus || 0,
          N_MINUS: totalRow.n_minus || 0,
          NO_VOTE: totalRow.no_vote || 0,
          WITH_FLAG: totalRow.with_flag || 0,
          UNKNOWN: totalRow.unknown || 0
        });
      }
    } catch (err: any) {
      console.error('Error fetching family statistics:', err);
      setError(err.message || 'Failed to fetch statistics');
      setFamilyStats([]);
    }
  };

  useEffect(() => {
    if (!hasPermission) {
      setError('You do not have permission to view this page.');
      setLoading(false);
      return;
    }

    setLoading(true);
    
    fetchFamilyStatistics()
      .then(() => {
      })
      .catch(err => {
        console.error('Initial data fetch error:', err);
      })
      .finally(() => {
        setLoading(false);
      });

  }, [hasPermission]);

  // Add real-time subscription to update family statistics when voter data changes
  useRealtime({
    table: 'avp_voters',
    event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
    onChange: (payload) => {
      console.log('Real-time update received for voters:', payload);
      fetchFamilyStatistics(); // Refresh the statistics when voter data changes
    }
  });

  // Close toast notification
  const closeToast = () => {
    setToast(null);
  };

  // Function to handle PDF export using the new utility
  const handleExportPDF = async (fileName: string) => {
    try {
      setToast({
        message: 'Preparing PDF export...',
        type: 'info',
        visible: true
      });

      if (!familyStats || familyStats.length === 0) {
        setToast({
          message: 'No data to export.',
          type: 'error',
          visible: true
        });
        return;
      }

      // Create headers array with explicit ordering to match the data exactly like Excel export
      const headers = [
        'Family',
        displayColumnNames.WITH_FLAG,
        displayColumnNames.AGAINST,
        displayColumnNames.N,
        displayColumnNames.N_PLUS,
        displayColumnNames.N_MINUS,
        displayColumnNames.DEATH, 
        displayColumnNames.IMMIGRANT,
        displayColumnNames.MILITARY,
        displayColumnNames.NO_VOTE,
        displayColumnNames.UNKNOWN
      ];
      
      // Create proper rows array with family name as first column and explicit order matching headers
      const rows = familyStats.map(stat => {
        return [stat.family].concat([
          String(stat.WITH_FLAG),
          String(stat.AGAINST),
          String(stat.N),
          String(stat.N_PLUS),
          String(stat.N_MINUS),
          String(stat.DEATH),
          String(stat.IMMIGRANT),
          String(stat.MILITARY),
          String(stat.NO_VOTE),
          String(stat.UNKNOWN)
        ]);
      });
      
      // Add total row at the end if totalStats is available
      if (totalStats) {
        rows.push([
          'TOTAL',
          String(totalStats.WITH_FLAG),
          String(totalStats.AGAINST),
          String(totalStats.N),
          String(totalStats.N_PLUS),
          String(totalStats.N_MINUS),
          String(totalStats.DEATH),
          String(totalStats.IMMIGRANT),
          String(totalStats.MILITARY),
          String(totalStats.NO_VOTE),
          String(totalStats.UNKNOWN)
        ]);
      }

      // Use our new utility function to export the PDF
      exportDataToPDF(
        headers,
        rows,
        'Family Situation Report',
        fileName || 'family-situation.pdf',
        'landscape'
      );

      setToast({
        message: 'PDF exported successfully',
        type: 'success',
        visible: true
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      setToast({
        message: 'Error generating PDF',
        type: 'error',
        visible: true
      });
    }
  };

  // Function to handle Excel export
  const handleExportExcel = async (fileName: string) => {
    try {
      setToast({
        message: 'Preparing Excel export...',
        type: 'info',
        visible: true
      });

      if (!familyStats || familyStats.length === 0) {
        setToast({
          message: 'No data to export.',
          type: 'error',
          visible: true
        });
        return;
      }

      // Create headers array with explicit ordering to match the data
      const headers = [
        'Family',
        displayColumnNames.WITH_FLAG,
        displayColumnNames.AGAINST,
        displayColumnNames.N,
        displayColumnNames.N_PLUS,
        displayColumnNames.N_MINUS,
        displayColumnNames.DEATH, 
        displayColumnNames.IMMIGRANT,
        displayColumnNames.MILITARY,
        displayColumnNames.NO_VOTE,
        displayColumnNames.UNKNOWN
      ];
      
      // Create proper rows array with family name as first column and values in correct order
      const rows = familyStats.map(stat => {
        return [stat.family].concat([
          String(stat.WITH_FLAG),
          String(stat.AGAINST),
          String(stat.N),
          String(stat.N_PLUS),
          String(stat.N_MINUS),
          String(stat.DEATH),
          String(stat.IMMIGRANT),
          String(stat.MILITARY),
          String(stat.NO_VOTE),
          String(stat.UNKNOWN)
        ]);
      });

      // Add total row at the end if totalStats is available
      if (totalStats) {
        rows.push([
          'TOTAL',
          String(totalStats.WITH_FLAG),
          String(totalStats.AGAINST),
          String(totalStats.N),
          String(totalStats.N_PLUS),
          String(totalStats.N_MINUS),
          String(totalStats.DEATH),
          String(totalStats.IMMIGRANT),
          String(totalStats.MILITARY),
          String(totalStats.NO_VOTE),
          String(totalStats.UNKNOWN)
        ]);
      }

      exportTableDataToExcel(headers, rows, fileName || 'family-situation.xlsx');

      setToast({
        message: 'Excel exported successfully',
        type: 'success',
        visible: true
      });
    } catch (err) {
      console.error('Error generating Excel:', err);
      setToast({
        message: 'Error generating Excel',
        type: 'error',
        visible: true
      });
    }
  };

  // Create table columns
  const columnHelper = createColumnHelper<FamilyStatistics>();
  const columns = React.useMemo(() => [
    columnHelper.accessor('family', {
      header: 'Family',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('WITH_FLAG', {
      header: () => <span className="text-green-600 dark:text-green-400">{displayColumnNames.WITH_FLAG}</span>,
      cell: info => (
        <span className="text-green-600 dark:text-green-400 font-medium">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('AGAINST', {
      header: () => <span className="text-red-600 dark:text-red-400">{displayColumnNames.AGAINST}</span>,
      cell: info => (
        <span className="text-red-600 dark:text-red-400 font-medium">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('N', {
      header: () => <span className="text-blue-500 dark:text-blue-300">{displayColumnNames.N}</span>,
      cell: info => (
        <span className="text-blue-500 dark:text-blue-300 font-medium">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('N_PLUS', {
      header: () => <span className="text-indigo-500 dark:text-indigo-300">{displayColumnNames.N_PLUS}</span>,
      cell: info => (
        <span className="text-indigo-500 dark:text-indigo-300 font-medium">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('N_MINUS', {
      header: () => <span className="text-purple-500 dark:text-purple-300">{displayColumnNames.N_MINUS}</span>,
      cell: info => (
        <span className="text-purple-500 dark:text-purple-300 font-medium">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('DEATH', {
      header: () => <span className="text-gray-600 dark:text-gray-400">{displayColumnNames.DEATH}</span>,
      cell: info => (
        <span className="text-gray-600 dark:text-gray-400 font-medium">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('IMMIGRANT', {
      header: () => <span className="text-yellow-600 dark:text-yellow-400">{displayColumnNames.IMMIGRANT}</span>,
      cell: info => (
        <span className="text-yellow-600 dark:text-yellow-400 font-medium">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('MILITARY', {
      header: () => <span className="text-purple-600 dark:text-purple-400">{displayColumnNames.MILITARY}</span>,
      cell: info => (
        <span className="text-purple-600 dark:text-purple-400 font-medium">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('NO_VOTE', {
      header: () => <span className="text-orange-600 dark:text-orange-400">{displayColumnNames.NO_VOTE}</span>,
      cell: info => (
        <span className="text-orange-600 dark:text-orange-400 font-medium">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('UNKNOWN', {
      header: () => <span className="text-gray-500 dark:text-gray-400">{displayColumnNames.UNKNOWN}</span>,
      cell: info => (
        <span className="text-gray-500 dark:text-gray-400 font-medium">{info.getValue()}</span>
      ),
    }),
  ], []);

  // Initialize the table instance
  const table = useReactTable({
    data: familyStats,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50, // Default page size
      },
    },
    enableRowSelection: false,
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

  // Calculate situation totals for the summary stats
  const totalVoters = totalStats ? (
    totalStats.WITH_FLAG + 
    totalStats.AGAINST + 
    totalStats.N + 
    totalStats.N_PLUS + 
    totalStats.N_MINUS + 
    totalStats.DEATH + 
    totalStats.IMMIGRANT + 
    totalStats.MILITARY + 
    totalStats.NO_VOTE + 
    totalStats.UNKNOWN
  ) : 0;

  const withPercentage = totalVoters > 0 ? Math.round((totalStats?.WITH_FLAG || 0) / totalVoters * 100) : 0;
  const againstPercentage = totalVoters > 0 ? Math.round((totalStats?.AGAINST || 0) / totalVoters * 100) : 0;
  const neutralPercentage = totalVoters > 0 ? Math.round(((totalStats?.N || 0)) / totalVoters * 100) : 0;

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
      
      <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">Family Situation</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Overview of family voting situations and statistics</p>
      
      {/* Unified Stats Summary Card as Accordion */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-blue-100 dark:border-gray-700 mb-6">
        {/* Accordion Header */}
        <button
          onClick={toggleSummary}
          className="w-full flex items-center justify-between p-4 md:p-6 text-left focus:outline-none"
          aria-expanded={summaryExpanded}
        >
          <h3 className="text-lg font-medium text-blue-800 dark:text-blue-300">Family Situation Summary</h3>
          <div className="ml-2 flex items-center">
            {totalVoters > 0 && (
              <span className="mr-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 py-1 px-2 rounded-md">
                {totalVoters} voters
              </span>
            )}
            <svg 
              className={`w-5 h-5 text-blue-600 dark:text-blue-400 transform transition-transform duration-200 ${summaryExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        
        {/* Accordion Content */}
        <div 
          className={`overflow-hidden transition-all duration-300 ${summaryExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="border-t dark:border-gray-700 p-4 md:p-6">
            {/* Primary Voting Stats */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[120px] bg-green-50 dark:bg-green-900/30 rounded-lg p-4 flex items-center">
                <div className="rounded-full bg-green-100 dark:bg-green-800 p-2 mr-3 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">With Us</p>
                  <div className="flex items-baseline">
                    <p className="text-xl font-bold text-green-600 dark:text-green-400 mr-1.5">{totalStats?.WITH_FLAG || 0}</p>
                    <span className="text-xs text-green-500 dark:text-green-400">({withPercentage}%)</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 min-w-[120px] bg-red-50 dark:bg-red-900/30 rounded-lg p-4 flex items-center">
                <div className="rounded-full bg-red-100 dark:bg-red-800 p-2 mr-3 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Against</p>
                  <div className="flex items-baseline">
                    <p className="text-xl font-bold text-red-600 dark:text-red-400 mr-1.5">{totalStats?.AGAINST || 0}</p>
                    <span className="text-xs text-red-500 dark:text-red-400">({againstPercentage}%)</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 min-w-[120px] bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 flex items-center">
                <div className="rounded-full bg-blue-100 dark:bg-blue-800 p-2 mr-3 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">N</p>
                  <div className="flex items-baseline">
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mr-1.5">{(totalStats?.N || 0)}</p>
                    <span className="text-xs text-blue-500 dark:text-blue-400">({neutralPercentage}%)</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Secondary Voting Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Death */}
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-md p-3 flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500 dark:bg-gray-400 mr-2.5"></div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Death</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{totalStats?.DEATH || 0}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                    {totalVoters > 0 ? Math.round((totalStats?.DEATH || 0) / totalVoters * 100) : 0}%
                  </div>
                </div>
              </div>
              
              {/* Immigrant */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-3 flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 dark:bg-yellow-400 mr-2.5"></div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Immigrant</p>
                    <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">{totalStats?.IMMIGRANT || 0}</p>
                  </div>
                  <div className="text-right text-xs text-yellow-600 dark:text-yellow-400">
                    {totalVoters > 0 ? Math.round((totalStats?.IMMIGRANT || 0) / totalVoters * 100) : 0}%
                  </div>
                </div>
              </div>
              
              {/* Military */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-md p-3 flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 dark:bg-purple-400 mr-2.5"></div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Military</p>
                    <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">{totalStats?.MILITARY || 0}</p>
                  </div>
                  <div className="text-right text-xs text-purple-600 dark:text-purple-400">
                    {totalVoters > 0 ? Math.round((totalStats?.MILITARY || 0) / totalVoters * 100) : 0}%
                  </div>
                </div>
              </div>
              
              {/* No Vote */}
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-md p-3 flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 dark:bg-orange-400 mr-2.5"></div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">No Vote</p>
                    <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">{totalStats?.NO_VOTE || 0}</p>
                  </div>
                  <div className="text-right text-xs text-orange-600 dark:text-orange-400">
                    {totalVoters > 0 ? Math.round((totalStats?.NO_VOTE || 0) / totalVoters * 100) : 0}%
                  </div>
                </div>
              </div>
              
              {/* N+ */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-md p-3 flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 dark:bg-indigo-300 mr-2.5"></div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">N+</p>
                    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{totalStats?.N_PLUS || 0}</p>
                  </div>
                  <div className="text-right text-xs text-indigo-600 dark:text-indigo-400">
                    {totalVoters > 0 ? Math.round((totalStats?.N_PLUS || 0) / totalVoters * 100) : 0}%
                  </div>
                </div>
              </div>
              
              {/* N- */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-md p-3 flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 dark:bg-purple-300 mr-2.5"></div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">N-</p>
                    <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">{totalStats?.N_MINUS || 0}</p>
                  </div>
                  <div className="text-right text-xs text-purple-600 dark:text-purple-400">
                    {totalVoters > 0 ? Math.round((totalStats?.N_MINUS || 0) / totalVoters * 100) : 0}%
                  </div>
                </div>
              </div>
              
              {/* Unknown */}
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-md p-3 flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500 mr-2.5"></div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Unknown</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{totalStats?.UNKNOWN || 0}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                    {totalVoters > 0 ? Math.round((totalStats?.UNKNOWN || 0) / totalVoters * 100) : 0}%
                  </div>
                </div>
              </div>
              
              {/* Total Voters */}
              <div className="sm:col-span-3 lg:col-span-6 bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/30 rounded-md p-3 mt-2 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-1.5 mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Total Registered Voters</p>
                </div>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{totalVoters}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6 border border-blue-100 dark:border-gray-700">
        {/* Add export buttons to the UI */}
        <div className="flex items-center space-x-2 justify-end mb-4">
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
        <div className="overflow-x-auto shadow-sm rounded-lg border border-blue-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      scope="col" 
                      className="px-6 py-3.5 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider whitespace-nowrap"
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
            {totalStats && (
              <tfoot className="bg-gray-50 dark:bg-gray-700 font-semibold">
                <tr>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-300 border-t-2 border-gray-300 dark:border-gray-600">
                    TOTAL
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-green-600 dark:text-green-400 border-t-2 border-gray-300 dark:border-gray-600">
                    {totalStats.WITH_FLAG}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-red-600 dark:text-red-400 border-t-2 border-gray-300 dark:border-gray-600">
                    {totalStats.AGAINST}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-blue-500 dark:text-blue-300 border-t-2 border-gray-300 dark:border-gray-600">
                    {totalStats.N}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-indigo-500 dark:text-indigo-300 border-t-2 border-gray-300 dark:border-gray-600">
                    {totalStats.N_PLUS}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-purple-500 dark:text-purple-300 border-t-2 border-gray-300 dark:border-gray-600">
                    {totalStats.N_MINUS}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-600 dark:text-gray-400 border-t-2 border-gray-300 dark:border-gray-600">
                    {totalStats.DEATH}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-yellow-600 dark:text-yellow-400 border-t-2 border-gray-300 dark:border-gray-600">
                    {totalStats.IMMIGRANT}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-purple-600 dark:text-purple-400 border-t-2 border-gray-300 dark:border-gray-600">
                    {totalStats.MILITARY}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-orange-600 dark:text-orange-400 border-t-2 border-gray-300 dark:border-gray-600">
                    {totalStats.NO_VOTE}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-500 dark:text-gray-400 border-t-2 border-gray-300 dark:border-gray-600">
                    {totalStats.UNKNOWN}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span>
              Showing <span className="font-semibold text-blue-900 dark:text-blue-300">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to{" "}
              <span className="font-semibold text-blue-900 dark:text-blue-300">
                {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, familyStats.length)}
              </span> of{" "}
              <span className="font-semibold text-blue-900 dark:text-blue-300">{familyStats.length}</span> families
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
                {[10, 20, 30, 50, 100].map(pageSize => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Legend for colors */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-100 dark:border-gray-700">
        <h3 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-3">Legend</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-green-500 mr-2"></span>
            <span className="text-sm text-gray-700 dark:text-gray-300">With</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-red-500 mr-2"></span>
            <span className="text-sm text-gray-700 dark:text-gray-300">Against</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-blue-500 mr-2"></span>
            <span className="text-sm text-gray-700 dark:text-gray-300">N</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-indigo-500 mr-2"></span>
            <span className="text-sm text-gray-700 dark:text-gray-300">N+</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-purple-500 mr-2"></span>
            <span className="text-sm text-gray-700 dark:text-gray-300">N-</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-gray-500 mr-2"></span>
            <span className="text-sm text-gray-700 dark:text-gray-300">Death</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-yellow-500 mr-2"></span>
            <span className="text-sm text-gray-700 dark:text-gray-300">Immigrant</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-purple-600 mr-2"></span>
            <span className="text-sm text-gray-700 dark:text-gray-300">Military</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-orange-500 mr-2"></span>
            <span className="text-sm text-gray-700 dark:text-gray-300">No Vote</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 rounded-full bg-gray-400 mr-2"></span>
            <span className="text-sm text-gray-700 dark:text-gray-300">Unknown</span>
          </div>
        </div>
      </div>

      {/* Export Modals */}
      <SimplePDFModal
        isOpen={exportPdfModalOpen}
        onClose={() => setExportPdfModalOpen(false)}
        onExport={handleExportPDF}
        defaultFileName="Family_Situation_Report.pdf"
      />
      <ExportExcelModal
        isOpen={exportExcelModalOpen}
        onClose={() => setExportExcelModalOpen(false)}
        onExport={handleExportExcel}
        defaultFileName="Family_Situation.xlsx"
      />
    </div>
  );
};

export default FamilySituation;
