import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import Toast from '../components/Toast';
import SimplePDFModal from '../components/SimplePDFModal';
import ExportExcelModal from '../components/ExportExcelModal';

import { exportTableDataToExcel } from '../utils/excelExport';
import { exportDataToPDF } from '../utils/pdfExport';

// Candidate interface with the new database structure
interface Candidate {
  id: number;
  list_id: number;
  list_name: string; // We'll populate this from the join with avp_candidate_lists
  candidate_of: string;
  full_name: string;
  score_from_female: number;
  score_from_male: number;
  list_order: number;
  candidate_order: number;
}

// Add ballot count interface
interface BallotCount {
  female_ballots: number;
  male_ballots: number;
  total_ballots: number;
}

// Helper function to determine colors based on list index
const getListColor = () => {
  // Use blue for all candidates
  return {
    bar: 'bg-blue-600 dark:bg-blue-700',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
    rank: 'bg-blue-600 dark:bg-blue-700',
    score: 'text-blue-700 dark:text-blue-300'
  };
};

const LiveScores: React.FC = () => {
  const { profile, session } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sortedCandidates, setSortedCandidates] = useState<Candidate[]>([]);
  
  // Add ballot count state
  const [ballotCount, setBallotCount] = useState<BallotCount>({
    female_ballots: 0,
    male_ballots: 0,
    total_ballots: 0
  });
  
  // Export modals state
  const [exportPdfModalOpen, setExportPdfModalOpen] = useState(false);
  const [exportExcelModalOpen, setExportExcelModalOpen] = useState(false);
  
  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);

  // Process candidates data for display
  const candidatesByList = candidates.reduce((acc: { 
    [key: string]: { 
      candidates: Candidate[], 
      order: number 
    } 
  }, candidate) => {
    if (!acc[candidate.list_name]) {
      acc[candidate.list_name] = {
        candidates: [],
        order: candidate.list_order || 0
      };
    }
    acc[candidate.list_name].candidates.push(candidate);
    return acc;
  }, {});

  // Sort candidates within each list by total votes
  Object.keys(candidatesByList).forEach(listName => {
    candidatesByList[listName].candidates.sort((a, b) => {
      const scoreA = (a.score_from_female || 0) + (a.score_from_male || 0);
      const scoreB = (b.score_from_female || 0) + (b.score_from_male || 0);
      return scoreB - scoreA; // Sort in descending order
    });
  });

  // Get total votes for percentage calculations
  const totalVotes = candidates.reduce((sum, candidate) => {
    return sum + (candidate.score_from_female || 0) + (candidate.score_from_male || 0);
  }, 0);

  // Sort candidates when data changes
  useEffect(() => {
    if (candidates.length > 0) {
      // Create a new sorted array without modifying the original
      const newSortedCandidates = [...candidates].sort((a, b) => {
        const scoreA = (a.score_from_female || 0) + (a.score_from_male || 0);
        const scoreB = (b.score_from_female || 0) + (b.score_from_male || 0);
        return scoreB - scoreA;
      });

      setSortedCandidates(newSortedCandidates);
    }
  }, [candidates]);

  // Fetch candidates data on initial load
  useEffect(() => {
    fetchCandidates();
    fetchBallotCount();
    
    // Set up a regular refresh interval instead of updates
    const refreshInterval = setInterval(() => {
      fetchCandidateScores();
      fetchBallotCount();
    }, 30000); // Refresh every 30 seconds
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  // Refresh data when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCandidates();
        fetchBallotCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Add function to fetch ballot count
  const fetchBallotCount = async () => {
    try {
      // Query for ballot counts directly from avp_candidates
      const { data, error } = await supabase
        .from('avp_candidates')
        .select('score_from_female, score_from_male');

      if (error) {
        console.error('Error fetching ballot count:', error);
        return;
      }

      if (data) {
        // Calculate total ballots from the scores
        const female_ballots = data.reduce((sum, candidate) => sum + (candidate.score_from_female || 0), 0);
        const male_ballots = data.reduce((sum, candidate) => sum + (candidate.score_from_male || 0), 0);
        const total_ballots = female_ballots + male_ballots;

        setBallotCount({
          female_ballots,
          male_ballots,
          total_ballots
        });
      }
    } catch (err) {
      console.error('Error in fetchBallotCount:', err);
    }
  };

  // Fetch full candidates data
  const fetchCandidates = async () => {
    try {
      setLoading(true);
      
      const { data, error: fetchError } = await supabase
        .from('avp_candidates')
        .select(`
          id, 
          list_id,
          candidate_of, 
          score_from_female,
          score_from_male,
          list_order,
          candidate_order,
          avp_candidate_lists(id, name),
          avp_voters!inner(full_name)
        `);

      if (fetchError) {
        throw fetchError;
      }

      // Transform data to include the full_name and list_name from joined tables
      const transformedCandidates = data.map(item => ({
        id: item.id,
        list_id: item.list_id,
        list_name: (item.avp_candidate_lists as any)?.name || 'Unknown List',
        candidate_of: item.candidate_of,
        score_from_female: item.score_from_female || 0,
        score_from_male: item.score_from_male || 0,
        list_order: item.list_order || 0,
        candidate_order: item.candidate_order || 0,
        full_name: (item.avp_voters as any)?.full_name || 'Unknown Candidate'
      }));

      setCandidates(transformedCandidates);
    } catch (err: any) {
      console.error('Error fetching candidates:', err);
      setError(err.message);
      showToast(`Failed to load candidates: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch only scores data (lightweight update)
  const fetchCandidateScores = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('avp_candidates')
        .select('id, score_from_female, score_from_male');

      if (fetchError) {
        throw fetchError;
      }

      // Update only the scores in the existing candidates array
      setCandidates(prev => prev.map(candidate => {
        const scoreUpdate = data.find(item => item.id === candidate.id);
        return scoreUpdate 
          ? { 
              ...candidate, 
              score_from_female: scoreUpdate.score_from_female || 0,
              score_from_male: scoreUpdate.score_from_male || 0
            } 
          : candidate;
      }));
      
    } catch (err: any) {
      console.error('Error fetching candidate scores:', err);
    }
  };

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ message, type, visible: true });
  };

  // Close toast notification
  const closeToast = () => {
    setToast(null);
  };

  // Generate and download PDF function
  const handleExportPDF = async (fileName: string) => {
    try {
      showToast('Preparing PDF export...', 'info');
      
      if (candidates.length === 0) {
        showToast('No data to export.', 'error');
        return;
      }

      // Headers for the PDF
      const headers = ['Candidate', 'Position', 'List', 'Female Votes', 'Male Votes', 'Total'];

      // Extract data for each row
      const rows = candidates
        .sort((a, b) => {
          // Sort by total votes descending
          const scoreA = (a.score_from_female || 0) + (a.score_from_male || 0);
          const scoreB = (b.score_from_female || 0) + (b.score_from_male || 0);
          return scoreB - scoreA;
        })
        .map(candidate => {
          const totalScore = (candidate.score_from_female || 0) + (candidate.score_from_male || 0);
          return [
            candidate.full_name,
            candidate.candidate_of,
            candidate.list_name,
            candidate.score_from_female || 0,
            candidate.score_from_male || 0,
            totalScore
          ];
        });

      // Use our new utility function to export the PDF
      exportDataToPDF(
        headers,
        rows,
        'Candidate Scores Report',
        fileName || 'candidate-scores.pdf',
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
      
      if (candidates.length === 0) {
        showToast('No data to export.', 'error');
        return;
      }

      // Headers for Excel
      const headers = ['Candidate', 'Position', 'List', 'Female Votes', 'Male Votes', 'Total'];

      // Extract data for each row
      const rows = candidates
        .sort((a, b) => {
          // Sort by total votes descending
          const scoreA = (a.score_from_female || 0) + (a.score_from_male || 0);
          const scoreB = (b.score_from_female || 0) + (b.score_from_male || 0);
          return scoreB - scoreA;
        })
        .map(candidate => {
          const totalScore = (candidate.score_from_female || 0) + (candidate.score_from_male || 0);
          return [
            candidate.full_name,
            candidate.candidate_of,
            candidate.list_name,
            candidate.score_from_female || 0,
            candidate.score_from_male || 0,
            totalScore
          ];
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

  // Loading state
  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-900 min-h-screen">
        <div className="mb-6">
          <div className="h-10 w-72 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-6"></div>
          <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-8"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
              <div className="animate-pulse p-6">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3 mb-6"></div>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(j => (
                    <div key={j} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                  ))}
                </div>
              </div>
            </div>
          ))}
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
      
      <div className="mb-8">
        <h2 className="text-4xl font-bold mb-2 text-blue-800 dark:text-blue-300">Scores</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Vote counts updated every 30 seconds
          <button 
            onClick={() => {
              fetchCandidates();
              fetchBallotCount();
              showToast('Data refreshed', 'success');
            }}
            className="ml-4 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/30"
          >
            Refresh Now
          </button>
        </p>
      </div>

      {/* Ballot Count Section */}
      <section className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-blue-200 dark:border-blue-900 overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-900/30 px-6 py-4">
            <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-300 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Ballot Count
            </h3>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4 text-center">
                <span className="block text-sm font-medium text-pink-700 dark:text-pink-300 mb-1">Female Ballots</span>
                <span className="text-2xl font-bold text-pink-600 dark:text-pink-400">{ballotCount.female_ballots}</span>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <span className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Male Ballots</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{ballotCount.male_ballots}</span>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
                <span className="block text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Total Ballots</span>
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{ballotCount.total_ballots}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Combined Total Scores Section */}
      <section className="mb-10">
        <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
          <i className="fas fa-chart-bar mr-2 text-blue-600 dark:text-blue-400"></i> Voting Board
        </h3>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-blue-100 dark:border-blue-900">
          <div className="space-y-6">
            {sortedCandidates.map((candidate, index) => {
              const totalScore = (candidate.score_from_female || 0) + (candidate.score_from_male || 0);
              // Calculate percentage based on total votes
              const votePercentage = totalVotes > 0 ? Math.round((totalScore / totalVotes) * 100) : 0;
              
              // For progress bar width
              const progressWidth = votePercentage || 0;
              
              // Get colors for this list
              const colors = getListColor();

              return (
                <div 
                  key={candidate.id}
                  className="relative transition-all duration-700 ease-in-out"
                >
                  <div className="flex items-center">
                    {/* Rank indicator */}
                    <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-lg mr-4 text-white ${colors.rank}`}>
                      {index + 1}
                    </div>

                    <div className="flex-grow">
                      <div className="flex justify-between items-center mb-1">
                        <div>
                          {/* Candidate name and position */}
                          <div className="flex items-center">
                            <span className="font-semibold text-gray-900 dark:text-white text-lg">
                              {candidate.full_name}
                            </span>
                            <span className={`ml-3 text-xs px-2 py-1 rounded-full font-medium ${colors.badge}`}>
                              {candidate.list_name}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {candidate.candidate_of}
                          </p>
                        </div>
                        
                        {/* Score */}
                        <div className="flex items-end">
                          <span className={`text-2xl font-bold ${colors.score}`}>
                            {totalScore}
                          </span>
                          <span className="text-sm ml-1 text-gray-500 dark:text-gray-400">
                            {votePercentage}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Vote breakdown */}
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <div>
                          <span className="text-pink-600 dark:text-pink-400">
                            F: {candidate.score_from_female || 0}
                          </span>
                          <span className="mx-2">|</span>
                          <span className="text-blue-600 dark:text-blue-400">
                            M: {candidate.score_from_male || 0}
                          </span>
                        </div>
                      </div>
                      
                      {/* Score bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ease-out ${colors.bar}`}
                          style={{ width: `${Math.max(progressWidth, 3)}%` }} // Minimum 3% for visibility
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Split Scores Section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 flex items-center">
            <i className="fas fa-search mr-2 text-blue-600 dark:text-blue-400"></i> Scores by Gender
          </h3>
          
          {/* Export buttons with same styling as in other pages */}
          <div className="flex items-center space-x-2 justify-start px-2 py-1 text-xs rounded-md bg-white dark:bg-gray-700 h-8 min-h-0">
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

        <div className="overflow-x-auto">
          <table id="scores-table" className="min-w-full bg-white dark:bg-gray-800 rounded-xl shadow-md border border-blue-100 dark:border-blue-900">
            <thead>
              <tr className="bg-blue-100 dark:bg-blue-900/30">
                <th className="py-4 px-6 text-left text-sm font-semibold text-blue-800 dark:text-blue-300">Candidate</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-blue-800 dark:text-blue-300">Position</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-blue-800 dark:text-blue-300">List</th>
                <th className="py-4 px-6 text-center text-sm font-semibold text-pink-600 dark:text-pink-400">
                  <div className="flex items-center justify-center">
                    <i className="fas fa-female mr-1"></i>
                    Female Votes
                  </div>
                </th>
                <th className="py-4 px-6 text-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                  <div className="flex items-center justify-center">
                    <i className="fas fa-male mr-1"></i>
                    Male Votes
                  </div>
                </th>
                <th className="py-4 px-6 text-center text-sm font-semibold text-purple-600 dark:text-purple-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {candidates
                .sort((a, b) => {
                  // Sort by total votes descending
                  const scoreA = (a.score_from_female || 0) + (a.score_from_male || 0);
                  const scoreB = (b.score_from_female || 0) + (b.score_from_male || 0);
                  return scoreB - scoreA;
                })
                .map((candidate, index) => {
                  const totalScore = (candidate.score_from_female || 0) + (candidate.score_from_male || 0);
                  
                  return (
                    <tr 
                      key={candidate.id}
                      className={`${
                        index % 2 === 0 
                          ? 'bg-white dark:bg-gray-800' 
                          : 'bg-gray-50 dark:bg-gray-700'
                      } transition-all`}
                    >
                      <td className="py-4 px-6 text-sm font-medium text-gray-900 dark:text-white">
                        {candidate.full_name}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500 dark:text-gray-400">
                        {candidate.candidate_of}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500 dark:text-gray-400">
                        {candidate.list_name}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-pink-500 dark:text-pink-300">
                            {candidate.score_from_female || 0}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-blue-500 dark:text-blue-300">
                            {candidate.score_from_male || 0}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-purple-500 dark:text-purple-300">
                            {totalScore}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
      
      <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
        <p>Last updated: {new Date().toLocaleString()}</p>
        <p className="mt-1">Data refreshes automatically every 30 seconds</p>
      </div>

      {/* Export modals */}
      <SimplePDFModal
        isOpen={exportPdfModalOpen}
        onClose={() => setExportPdfModalOpen(false)}
        onExport={handleExportPDF}
        defaultFileName="Candidate_Scores_Report.pdf"
      />
      
      <ExportExcelModal
        isOpen={exportExcelModalOpen}
        onClose={() => setExportExcelModalOpen(false)}
        onExport={handleExportExcel}
        defaultFileName="Candidate_Scores_Report.xlsx"
      />
    </div>
  );
};

export default LiveScores;