import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { RealtimeChannel } from '@supabase/supabase-js';
import Toast from '../components/Toast';
import SimplePDFModal from '../components/SimplePDFModal';
import ExportExcelModal from '../components/ExportExcelModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { amiriRegularBase64 } from '../assets/fonts/Amiri-Regular-normal';
import { exportTableDataToExcel } from '../utils/excelExport';

// Define interface for candidate data
interface Candidate {
  id: number;
  list_name: string;
  candidate_of: string;
  score_from_female: number;
  score_from_male: number;
  list_order?: number;
  candidate_order?: number;
  full_name?: string;
  isUpdating?: boolean;
  previousPosition?: number;
  lastUpdatedTimestamp?: number;
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
  const [positionsChanged, setPositionsChanged] = useState<boolean>(false);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const previousRankingsRef = useRef<{[key: number]: number}>({});
  const keepAliveIntervalRef = useRef<number | null>(null);
  const hasInitializedRef = useRef<boolean>(false);
  
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

  // Sort list names based on list_order
  const sortedListNames = Object.keys(candidatesByList).sort((a, b) => 
    candidatesByList[a].order - candidatesByList[b].order
  );

  // Sort candidates within each list by total votes
  Object.keys(candidatesByList).forEach(listName => {
    candidatesByList[listName].candidates.sort((a, b) => {
      const scoreA = (a.score_from_female || 0) + (a.score_from_male || 0);
      const scoreB = (b.score_from_female || 0) + (b.score_from_male || 0);
      return scoreB - scoreA; // Sort in descending order
    });
  });

  // Get maximum score for percentage calculations
  const maxScore = candidates.reduce((max, candidate) => {
    const total = (candidate.score_from_female || 0) + (candidate.score_from_male || 0);
    return Math.max(max, total);
  }, 1); // Default to 1 to avoid division by zero

  // Get total votes for percentage calculations
  const totalVotes = candidates.reduce((sum, candidate) => {
    return sum + (candidate.score_from_female || 0) + (candidate.score_from_male || 0);
  }, 0);

  // Sort candidates and track position changes
  useEffect(() => {
    if (candidates.length > 0) {
      // Create a new sorted array without modifying the original
      const newSortedCandidates = [...candidates].sort((a, b) => {
        const scoreA = (a.score_from_female || 0) + (a.score_from_male || 0);
        const scoreB = (b.score_from_female || 0) + (b.score_from_male || 0);
        return scoreB - scoreA;
      });

      // Track position changes
      const currentRankings: {[key: number]: number} = {};
      let positionsHaveChanged = false;

      newSortedCandidates.forEach((candidate, index) => {
        currentRankings[candidate.id] = index;
        
        // Check if this candidate has moved positions
        if (previousRankingsRef.current[candidate.id] !== undefined && 
            previousRankingsRef.current[candidate.id] !== index) {
          positionsHaveChanged = true;
        }
      });

      if (positionsHaveChanged) {
        // Add previousPosition property to candidates
        const candidatesWithPositionData = newSortedCandidates.map(candidate => ({
          ...candidate,
          previousPosition: previousRankingsRef.current[candidate.id]
        }));

        setSortedCandidates(candidatesWithPositionData);
        setPositionsChanged(true);

        // Reset the positions changed flag after animation
        setTimeout(() => {
          setPositionsChanged(false);
        }, 1000);
      } else {
        setSortedCandidates(newSortedCandidates);
      }

      // Store current rankings for next comparison
      previousRankingsRef.current = currentRankings;
    }
  }, [candidates]);

  // Fetch candidates data and setup real-time subscription
  useEffect(() => {
    fetchCandidates();
    setupRealtimeSubscription();

    // Cleanup function
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      if (keepAliveIntervalRef.current) {
        window.clearInterval(keepAliveIntervalRef.current);
      }
    };
  }, []);

  // Refresh data when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCandidates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Setup realtime subscription with optimized parameters
  const setupRealtimeSubscription = () => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel('live-scores-channel-' + Date.now(), {
        config: {
          broadcast: {
            self: true
          },
          presence: {
            key: 'live-scores-viewer'
          }
          // Removed fastLane as it's not a supported property
        }
      })
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'avp_candidates',
        },
        (payload) => {
          console.log('Candidate score change detected!', payload);
          
          // For score-related changes, update scores immediately without full refresh
          if (payload.eventType === 'UPDATE' && payload.new && payload.old) {
            if (payload.new.score_from_female !== payload.old.score_from_female || 
                payload.new.score_from_male !== payload.old.score_from_male) {
              
              // Update immediately without network request for the changed candidate
              setCandidates(prev => {
                // Apply the update to the specific candidate
                const updatedCandidates = prev.map(cand => 
                  cand.id === payload.new.id 
                    ? { 
                        ...cand, 
                        score_from_female: payload.new.score_from_female || 0,
                        score_from_male: payload.new.score_from_male || 0,
                        isUpdating: true,
                        lastUpdatedTimestamp: Date.now()
                      } 
                    : cand
                );
                
                return updatedCandidates;
              });
              
              // Remove highlight after animation (reduced from 1500ms to 1000ms)
              setTimeout(() => {
                setCandidates(prev => prev.map(cand => 
                  cand.id === payload.new.id 
                    ? { ...cand, isUpdating: false } 
                    : cand
                ));
              }, 1000);
            } else {
              // For other changes that aren't score-related, refresh all data
              fetchCandidates();
            }
          } else {
            // For non-update changes (insert/delete), refresh all data
            fetchCandidates();
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to live scores updates!');
          
          // Set up periodic refresh as a backup (every 20 seconds)
          // Only as a fallback in case real-time events are missed
          const intervalId = setInterval(() => {
            fetchCandidateScores();
          }, 20000);
          
          return () => clearInterval(intervalId);
        }
        
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error:', err);
          
          // Try to reconnect after delay (reduced to 1 second)
          setTimeout(() => {
            setupRealtimeSubscription();
          }, 1000);
        }

        if (status === 'TIMED_OUT') {
          console.warn('Realtime connection timed out');
          setupRealtimeSubscription(); // Immediately try to reconnect
        }
      });

    realtimeChannelRef.current = channel;
  };

  // Setup visibility change and keep-alive mechanisms
  useEffect(() => {
    // Keep the realtime connection alive with periodic pings
    const setupKeepAlive = () => {
      if (keepAliveIntervalRef.current) {
        window.clearInterval(keepAliveIntervalRef.current);
      }
      
      // Send a ping every 15 seconds to keep the connection alive
      keepAliveIntervalRef.current = window.setInterval(() => {
        const channel = realtimeChannelRef.current;
        if (channel) {
          // Track when we send a keep-alive
          console.log('Sending realtime keep-alive ping:', new Date().toISOString());
          
          // Use presence to keep the connection alive
          channel.track({
            online_at: new Date().toISOString(),
            user_agent: navigator.userAgent
          });
        }
      }, 15000);
    };

    // Initial visibility state handler
    const handleInitVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab is visible - fetching fresh data');
        fetchCandidates();
      } else {
        console.log('Tab is hidden - setting up keep-alive mechanism');
        setupKeepAlive();
      }
    };
    
    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refreshing data...');
        fetchCandidates();
        
        // Clear the keep-alive interval when the tab is visible
        if (keepAliveIntervalRef.current) {
          window.clearInterval(keepAliveIntervalRef.current);
          keepAliveIntervalRef.current = null;
        }
      } else {
        console.log('Tab hidden, setting up keep-alive...');
        setupKeepAlive();
      }
    };

    // Set up initial visibility handling
    if (!hasInitializedRef.current) {
      handleInitVisibility();
      hasInitializedRef.current = true;
    }

    // Add event listener for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up event listener and interval
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (keepAliveIntervalRef.current) {
        window.clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }
    };
  }, []);

  // Fetch full candidates data
  const fetchCandidates = async () => {
    try {
      setLoading(true);
      
      const { data, error: fetchError } = await supabase
        .from('avp_candidates')
        .select(`
          id, 
          list_name, 
          candidate_of, 
          score_from_female,
          score_from_male,
          list_order,
          candidate_order,
          avp_voters!inner(full_name)
        `);

      if (fetchError) {
        throw fetchError;
      }

      // Transform data to include the full_name from joined table
      const transformedCandidates = data.map(item => ({
        id: item.id,
        list_name: item.list_name,
        candidate_of: item.candidate_of,
        score_from_female: item.score_from_female || 0,
        score_from_male: item.score_from_male || 0,
        list_order: item.list_order || 0,
        candidate_order: item.candidate_order || 0,
        full_name: (item.avp_voters as any)?.full_name || 'Unknown Candidate',
        isUpdating: false
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
      // Don't show toast for background updates
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

      // Create PDF document
      const pdf = new jsPDF('landscape');

      // Add the Amiri font
      pdf.addFileToVFS('Amiri-Regular.ttf', amiriRegularBase64);
      pdf.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');

      // Set default font for title and metadata
      pdf.setFont('Amiri');
      pdf.setFontSize(16);
      pdf.text('Candidate Scores Report', 14, 15);

      const now = new Date();
      pdf.setFontSize(10);
      pdf.text(`Generated on: ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`, 14, 22);

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
        <h2 className="text-4xl font-bold mb-2 text-blue-800 dark:text-blue-300">Live Scores</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Real-time vote counts updated automatically
          <span className="inline-block ml-2 w-2 h-2 bg-green-500 rounded-full animate-[ping_1.5s_ease-in-out_infinite]"></span>
        </p>
      </div>

      {/* Combined Total Scores Section */}
      <section className="mb-10">
        <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
          <i className="fas fa-chart-bar mr-2 text-blue-600 dark:text-blue-400"></i> Live Voting Board
        </h3>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-blue-100 dark:border-blue-900">
          <div className="space-y-6">
            {sortedCandidates.map((candidate, index) => {
              const totalScore = (candidate.score_from_female || 0) + (candidate.score_from_male || 0);
              // Calculate percentage based on total votes
              const votePercentage = totalVotes > 0 ? Math.round((totalScore / totalVotes) * 100) : 0;
              
              // For progress bar width
              const progressWidth = votePercentage || 0;
              
              // Position animation class
              let animationClass = '';
              
              if (positionsChanged && candidate.previousPosition !== undefined) {
                if (candidate.previousPosition > index) {
                  // Moved up in ranking
                  animationClass = 'animate-position-up';
                } else if (candidate.previousPosition < index) {
                  // Moved down in ranking
                  animationClass = 'animate-position-down';
                }
              }

              // Get colors for this list
              const colors = getListColor(candidate.list_name);
              
              // Enhanced animation for updated scores
              const isRecentlyUpdated = candidate.isUpdating || 
                (candidate.lastUpdatedTimestamp && (Date.now() - candidate.lastUpdatedTimestamp < 3000));

              return (
                <div 
                  key={candidate.id}
                  className={`relative transition-all duration-700 ease-in-out ${animationClass} ${
                    isRecentlyUpdated ? 'scale-[1.02] bg-yellow-50 dark:bg-yellow-900/10 rounded-lg' : 'scale-100'
                  }`}
                >
                  <div className="flex items-center">
                    {/* Rank indicator */}
                    <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full font-bold text-lg mr-4 text-white ${colors.rank} ${
                      isRecentlyUpdated ? 'ring-2 ring-yellow-400 dark:ring-yellow-500 ring-offset-1' : ''
                    }`}>
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
                          <span className={`text-2xl font-bold ${
                            isRecentlyUpdated 
                              ? 'text-blue-600 dark:text-blue-400 animate-pulse' 
                              : colors.score
                          }`}>
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
                          <span className={`${isRecentlyUpdated && candidate.score_from_female > 0 ? 'text-pink-600 dark:text-pink-500 font-bold' : 'text-pink-600 dark:text-pink-400'}`}>
                            F: {candidate.score_from_female || 0}
                          </span>
                          <span className="mx-2">|</span>
                          <span className={`${isRecentlyUpdated && candidate.score_from_male > 0 ? 'text-blue-600 dark:text-blue-500 font-bold' : 'text-blue-600 dark:text-blue-400'}`}>
                            M: {candidate.score_from_male || 0}
                          </span>
                        </div>
                      </div>
                      
                      {/* Score bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ease-out ${colors.bar} ${
                            isRecentlyUpdated ? 'animate-pulse' : ''
                          }`}
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
                        candidate.isUpdating 
                          ? 'bg-yellow-50 dark:bg-yellow-900/20' 
                          : index % 2 === 0 
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
                          <span className={`text-lg font-bold ${
                            candidate.isUpdating && candidate.score_from_female > 0
                              ? 'text-pink-600 dark:text-pink-400 animate-pulse'
                              : 'text-pink-500 dark:text-pink-300'
                          }`}>
                            {candidate.score_from_female || 0}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-center">
                          <span className={`text-lg font-bold ${
                            candidate.isUpdating && candidate.score_from_male > 0
                              ? 'text-blue-600 dark:text-blue-400 animate-pulse'
                              : 'text-blue-500 dark:text-blue-300'
                          }`}>
                            {candidate.score_from_male || 0}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-center">
                          <span className={`text-lg font-bold ${
                            candidate.isUpdating
                              ? 'text-purple-600 dark:text-purple-400 animate-pulse'
                              : 'text-purple-500 dark:text-purple-300'
                          }`}>
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
        <p className="mt-1">All vote counts update in real-time as scores change</p>
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