import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { RealtimeChannel } from '@supabase/supabase-js';

// Define interface for candidate data
interface Candidate {
  id: number;
  list_name: string;
  candidate_of: string;
  score: number;
  list_order?: number; // Added to support list ordering
  candidate_order?: number; // Added to support ordering candidates within a list
  full_name?: string; // From joined avp_voters table
  isUpdating?: boolean; // UI state for highlighting updated rows
}

// Toast notification component
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getBgColor = () => {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <i className="fas fa-check-circle w-5 h-5"></i>;
      case 'error':
        return <i className="fas fa-times-circle w-5 h-5"></i>;
      case 'warning':
        return <i className="fas fa-exclamation-triangle w-5 h-5"></i>;
      case 'info':
      default:
        return <i className="fas fa-info-circle w-5 h-5"></i>;
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center p-4 text-white rounded-md shadow-lg transform transition-all duration-300 ${getBgColor()}`}>
      <div className="mr-3">
        {getIcon()}
      </div>
      <div>{message}</div>
      <button 
        onClick={onClose} 
        className="ml-6 text-white hover:text-gray-200"
        aria-label="Close"
      >
        <i className="fas fa-times w-4 h-4"></i>
      </button>
    </div>
  );
};

// Confirmation modal for manually posting votes
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75 dark:bg-gray-900 dark:opacity-75"></div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
            <p className="text-gray-700 dark:text-gray-300">{message}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Scoring: React.FC = () => {
  const { profile, session } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Candidates data state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  
  // Group candidates by list_name, keeping track of list order
  const candidatesByList = candidates.reduce((acc: { 
    [key: string]: { 
      candidates: Candidate[], 
      candidatesByScore?: Candidate[], 
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
  
  // Sort candidates by score for Live Scores section
  // and by candidate_order for Vote Counting section
  Object.keys(candidatesByList).forEach(listName => {
    // Create a copy for score sorting (used in Live Scores section)
    candidatesByList[listName].candidatesByScore = [...candidatesByList[listName].candidates];
    candidatesByList[listName].candidatesByScore.sort((a, b) => b.score - a.score);
    
    // Sort the main candidates array by candidate_order (used in Vote Counting section)
    candidatesByList[listName].candidates.sort((a, b) => (a.candidate_order || 0) - (b.candidate_order || 0));
  });
  
  // Get sorted list names based on list_order
  const sortedListNames = Object.keys(candidatesByList).sort((a, b) => 
    candidatesByList[a].order - candidatesByList[b].order
  );

  // Checkbox tracking state for each candidate
  const [checkedVotes, setCheckedVotes] = useState<{ [candidateId: number]: boolean[] }>({});
  
  // Confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  
  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);

  // Initialize checked votes state when candidates are loaded
  useEffect(() => {
    // Initialize checkedVotes for all candidates
    const initialCheckedVotes: { [candidateId: number]: boolean[] } = {};
    candidates.forEach(candidate => {
      initialCheckedVotes[candidate.id] = Array(20).fill(false);
    });
    setCheckedVotes(initialCheckedVotes);
  }, [candidates.length]); // Only run when candidates length changes

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

  // Setup realtime subscription
  const setupRealtimeSubscription = () => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel('candidates-scoring-' + Date.now())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'avp_candidates' },
        (payload) => {
          console.log('Candidate change detected!', payload);
          
          // For ALL change events, refresh the entire candidates data
          // This ensures scores are always up-to-date across all users
          fetchCandidates();
          
          // If this is an update, also highlight the updated row
          if (payload.eventType === 'UPDATE' && payload.new) {
            // After fetching, highlight the updated row temporarily
            setTimeout(() => {
              setCandidates(prev => prev.map(cand => 
                cand.id === payload.new.id 
                  ? { ...cand, isUpdating: true } 
                  : cand
              ));
              
              // Remove the highlight after 1.5 seconds
              setTimeout(() => {
                setCandidates(prev => prev.map(cand => 
                  cand.id === payload.new.id 
                    ? { ...cand, isUpdating: false } 
                    : cand
                ));
              }, 1500);
            }, 200); // Small delay to ensure fetchCandidates has completed
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to candidate scoring changes!');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error:', err);
          
          // Try to reestablish connection after a delay
          setTimeout(() => {
            setupRealtimeSubscription();
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

    realtimeChannelRef.current = channel;
  };

  // Fetch candidates data
  const fetchCandidates = async () => {
    try {
      setLoading(true);
      
      // Query candidates with voter information
      const { data, error } = await supabase
        .from('avp_candidates')
        .select(`
          id, 
          list_name, 
          candidate_of, 
          score,
          list_order,
          candidate_order,
          avp_voters!inner(full_name)
        `);

      if (error) {
        throw error;
      }

      // Transform the data to include the full_name from avp_voters
      const transformedCandidates = data.map(item => ({
        id: item.id,
        list_name: item.list_name,
        candidate_of: item.candidate_of,
        score: item.score || 0,
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

  // Handle checkbox change
  const handleCheckboxChange = (candidateId: number, checkboxIndex: number) => {
    setCheckedVotes(prev => {
      const updatedVotes = { ...prev };
      
      // Toggle the checkbox
      if (updatedVotes[candidateId]) {
        updatedVotes[candidateId] = [...updatedVotes[candidateId]];
        updatedVotes[candidateId][checkboxIndex] = !updatedVotes[candidateId][checkboxIndex];
      }
      
      // Check if this update results in any candidate having exactly 20 checked boxes
      // Count the updated votes directly from the updated state we just created
      const newCount = updatedVotes[candidateId]?.filter(checked => checked).length || 0;
      if (newCount === 20) {
        // Important: Pass the updated votes state to handlePostAllScores
        // This ensures we're using the latest state with all 20 votes counted
        setTimeout(() => {
          handlePostAllScores(updatedVotes);
        }, 100);
      }
      
      return updatedVotes;
    });
  };

  // Get the count of checked boxes for a candidate
  const getCheckedCount = (candidateId: number): number => {
    const candidateVotes = checkedVotes[candidateId] || [];
    return candidateVotes.filter(checked => checked).length;
  };

  // Handle posting scores for ALL candidates and reset ALL checkboxes
  const handlePostAllScores = async (updatedVotes: { [candidateId: number]: boolean[] }) => {
    try {
      // Array to hold all update promises
      const updatePromises = [];
      
      // Process each candidate
      for (const candidateId of Object.keys(updatedVotes).map(Number)) {
        // Calculate checked count directly from updatedVotes
        const candidateVotes = updatedVotes[candidateId] || [];
        const checkedCount = candidateVotes.filter(checked => checked).length;
        
        // Only update candidates with at least one checked vote
        if (checkedCount > 0) {
          const candidate = candidates.find(c => c.id === candidateId);
          if (candidate) {
            const currentScore = candidate.score || 0;
            const newScore = currentScore + checkedCount;
            
            console.log(`Updating candidate ${candidate.full_name}: current=${currentScore}, checked=${checkedCount}, new=${newScore}`);
            
            // Add update promise to array
            updatePromises.push(
              supabase
                .from('avp_candidates')
                .update({ score: newScore })
                .eq('id', candidateId)
            );
          }
        }
      }
      
      // Execute all updates in parallel
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        
        // Reset all checkboxes
        const resetCheckedVotes: { [candidateId: number]: boolean[] } = {};
        candidates.forEach(candidate => {
          resetCheckedVotes[candidate.id] = Array(20).fill(false);
        });
        setCheckedVotes(resetCheckedVotes);
        
        // Refresh the candidates data to update the live scores
        fetchCandidates();
        
        showToast('All scores updated successfully', 'success');
      }
    } catch (err: any) {
      console.error('Error posting scores for all candidates:', err);
      showToast(`Failed to update scores: ${err.message}`, 'error');
    }
  };

  // Handle posting score for a specific candidate
  const handlePostScore = async (candidateId: number, additionalScore: number) => {
    try {
      // Find the candidate to get its current score
      const candidate = candidates.find(c => c.id === candidateId);
      if (!candidate) return;
      
      const currentScore = candidate.score || 0;
      const newScore = currentScore + additionalScore;
      
      // Update the score in the database
      const { error } = await supabase
        .from('avp_candidates')
        .update({ score: newScore })
        .eq('id', candidateId);
      
      if (error) throw error;
      
      // Reset checkboxes for this candidate
      setCheckedVotes(prev => ({
        ...prev,
        [candidateId]: Array(20).fill(false)
      }));
      
      showToast(`Score updated for ${candidate.full_name}`, 'success');
    } catch (err: any) {
      console.error('Error updating score:', err);
      showToast(`Failed to update score: ${err.message}`, 'error');
    }
  };

  // Handle "Post Manually" button click
  const handlePostManually = () => {
    setIsConfirmModalOpen(true);
  };

  // Handle confirmation of manual posting
  const handleConfirmPost = async () => {
    try {
      // Array to hold all update promises
      const updatePromises = [];
      
      // Process each candidate
      for (const candidateId of Object.keys(checkedVotes).map(Number)) {
        const checkedCount = getCheckedCount(candidateId);
        
        // Only update candidates with at least one checked vote
        if (checkedCount > 0) {
          const candidate = candidates.find(c => c.id === candidateId);
          if (candidate) {
            const currentScore = candidate.score || 0;
            const newScore = currentScore + checkedCount;
            
            // Add update promise to array
            updatePromises.push(
              supabase
                .from('avp_candidates')
                .update({ score: newScore })
                .eq('id', candidateId)
            );
          }
        }
      }
      
      // Execute all updates in parallel
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        
        // Reset all checkboxes
        const resetCheckedVotes: { [candidateId: number]: boolean[] } = {};
        candidates.forEach(candidate => {
          resetCheckedVotes[candidate.id] = Array(20).fill(false);
        });
        setCheckedVotes(resetCheckedVotes);
        
        showToast('All scores updated successfully. Refreshing page...', 'success');
        
        // Refresh the page after a brief delay to allow the toast to be seen
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else {
        showToast('No votes to post', 'info');
      }
    } catch (err: any) {
      console.error('Error posting scores manually:', err);
      showToast(`Failed to update scores: ${err.message}`, 'error');
    }
  };

  // Reset all checkboxes
  const handleResetAll = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = () => {
    const resetCheckedVotes: { [candidateId: number]: boolean[] } = {};
    candidates.forEach(candidate => {
      resetCheckedVotes[candidate.id] = Array(20).fill(false);
    });
    setCheckedVotes(resetCheckedVotes);
    showToast('All checkboxes reset', 'info');
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
        <div className="space-y-6">
          {[1, 2].map(i => (
            <div key={i} className="border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
              <div className="animate-pulse p-6">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3 mb-6"></div>
                <div className="space-y-4">
                  {[1, 2, 3].map(j => (
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
      
      {/* Confirmation Modal for Post Votes */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmPost}
        title="Post Votes"
        message="Are you sure you want to post all current votes to the candidates' scores?"
      />
      
      {/* Confirmation Modal for Reset */}
      <ConfirmationModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmReset}
        title="Reset All Checkboxes"
        message="Are you sure you want to reset all checkboxes? This action cannot be undone."
      />
      
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">Candidate Scoring</h2>
        <p className="text-gray-600 dark:text-gray-400">Track and update candidate votes in real-time</p>
      </div>
      
      {/* Manual Post & Reset Buttons */}
      <div className="mb-6 flex flex-wrap gap-4">
        <button
          onClick={handlePostManually}
          className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 shadow-md flex items-center"
        >
          <i className="fas fa-upload mr-2"></i>
          Post Votes Manually
        </button>
        <button
          onClick={handleResetAll}
          className="px-5 py-2.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 shadow-md flex items-center"
        >
          <i className="fas fa-undo mr-2"></i>
          Reset All Checkboxes
        </button>
      </div>

      {/* Live Scores Section */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-4">Live Scores</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedListNames.map(listName => (
            <div 
              key={listName}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-blue-100 dark:border-gray-700"
            >
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{listName}</h4>
              <div className="space-y-3">
                {candidatesByList[listName].candidatesByScore.map(candidate => (
                  <div 
                    key={candidate.id} 
                    className={`flex justify-between items-center p-3 rounded-lg transition-all ${
                      candidate.isUpdating 
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 animate-pulse' 
                        : 'bg-blue-50 dark:bg-blue-900/20'
                    }`}
                  >
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{candidate.full_name}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2"> ({candidate.candidate_of})</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{candidate.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vote Counting Section */}
      <div>
        <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-4">Vote Counting</h3>
        
        {sortedListNames.map(listName => (
          <div 
            key={listName}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-blue-100 dark:border-gray-700 mb-6"
          >
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{listName}</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-blue-50 dark:bg-blue-900/20">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Candidate</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Vote Count</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Checkboxes (20)</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {candidatesByList[listName].candidates.map(candidate => (
                    <tr key={candidate.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {candidate.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {candidate.candidate_of}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 inline-flex text-sm leading-5 font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          {getCheckedCount(candidate.id)} / 20
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {Array(20).fill(0).map((_, index) => (
                            <label 
                              key={index} 
                              className="inline-flex items-center cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checkedVotes[candidate.id]?.[index] || false}
                                onChange={() => handleCheckboxChange(candidate.id, index)}
                                className="form-checkbox h-5 w-5 text-blue-600 dark:text-blue-500 transition duration-150 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                              />
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Scoring;