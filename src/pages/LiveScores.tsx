import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { RealtimeChannel } from '@supabase/supabase-js';
import Toast from '../components/Toast';

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
}

const LiveScores: React.FC = () => {
  const { profile, session } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  
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

  // Fetch candidates data and setup real-time subscription
  useEffect(() => {
    fetchCandidates();
    setupRealtimeSubscription();

    // Cleanup function
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
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

  // Setup realtime subscription
  const setupRealtimeSubscription = () => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel('live-scores-channel-' + Date.now(), {
        config: {
          broadcast: {
            self: true
          }
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
          
          // For score-related changes, update scores without full refresh
          if (payload.eventType === 'UPDATE' && payload.new && payload.old) {
            if (payload.new.score_from_female !== payload.old.score_from_female || 
                payload.new.score_from_male !== payload.old.score_from_male) {
              
              fetchCandidateScores();
              
              // Highlight the updated row
              setTimeout(() => {
                setCandidates(prev => prev.map(cand => 
                  cand.id === payload.new.id 
                    ? { ...cand, isUpdating: true } 
                    : cand
                ));
                
                // Remove highlight after 2 seconds
                setTimeout(() => {
                  setCandidates(prev => prev.map(cand => 
                    cand.id === payload.new.id 
                      ? { ...cand, isUpdating: false } 
                      : cand
                  ));
                }, 2000);
              }, 200);
            } else {
              // For other changes, refresh all data
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
          
          // Set up periodic refresh (every 30 seconds)
          const intervalId = setInterval(() => {
            fetchCandidateScores();
          }, 30000);
          
          return () => clearInterval(intervalId);
        }
        
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error:', err);
          
          // Try to reconnect after delay
          setTimeout(() => {
            setupRealtimeSubscription();
          }, 5000);
        }
      });

    realtimeChannelRef.current = channel;
  };

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
          <span className="inline-block ml-2 w-2 h-2 bg-green-500 rounded-full animate-[ping_3s_ease-in-out_infinite]"></span>
        </p>
      </div>

      {/* Combined Total Scores Section */}
      <section className="mb-10">
        <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
          <i className="fas fa-chart-bar mr-2 text-blue-600 dark:text-blue-400"></i> Total Combined Scores
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedListNames.map(listName => {
            const listData = candidatesByList[listName];
            
            return (
              <div 
                key={listName}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-blue-100 dark:border-blue-900 overflow-hidden"
              >
                <div className="mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <h4 className="text-xl font-bold text-blue-700 dark:text-blue-400">{listName}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total vote count: {listData.candidates.reduce((sum, c) => sum + (c.score_from_female || 0) + (c.score_from_male || 0), 0)}</p>
                </div>
                
                <div className="space-y-4">
                  {listData.candidates.map((candidate, index) => {
                    const totalScore = (candidate.score_from_female || 0) + (candidate.score_from_male || 0);
                    
                    return (
                      <div 
                        key={candidate.id} 
                        className={`flex justify-between items-center p-4 rounded-lg transition-all ${
                          candidate.isUpdating 
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 animate-pulse' 
                            : index % 2 === 0 
                              ? 'bg-blue-50 dark:bg-blue-900/20' 
                              : 'bg-indigo-50 dark:bg-indigo-900/10'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 dark:bg-blue-700 text-white font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900 dark:text-white">{candidate.full_name}</h5>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{candidate.candidate_of}</p>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">{totalScore}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">votes</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Split Scores Section */}
      <section className="mb-8">
        <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6 flex items-center">
          <i className="fas fa-search mr-2 text-blue-600 dark:text-blue-400"></i> Scores by Gender
        </h3>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-800 rounded-xl shadow-md border border-blue-100 dark:border-blue-900">
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
        <p className="mt-1">All vote counts update automatically in real-time</p>
      </div>
    </div>
  );
};

export default LiveScores;