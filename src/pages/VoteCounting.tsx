import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import Toast from '../components/Toast'; // Import shared Toast component
import { useNavigate } from 'react-router-dom'; // Added import
import BallotCounter, { BallotCounterRef } from '../components/BallotCounter'; // Import the BallotCounter component with ref type

// Candidate interface with the new database structure
interface Candidate {
  id: number;
  list_id: number;
  list_name: string; // Now from the joined table
  candidate_of: string;
  full_name: string;
  score_from_female: number;
  score_from_male: number;
  list_order: number;
  candidate_order: number;
  isUpdating?: boolean;
}

// Simple candidate vote state
interface CandidateVoteState {
  checked: boolean;
}

// Confirmation modal for manually posting votes
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (e?: React.MouseEvent) => void;  // Updated to accept an event parameter
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
              onClick={(e) => {
                onConfirm(e);
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

const VoteCounting: React.FC = () => {
  const { profile, session } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const navigate = useNavigate(); // For redirection
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Candidates data state
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // Create ref for the ballot counter
  const ballotCounterRef = useRef<BallotCounterRef>(null);

  const userVoteCountingRight = profile?.vote_counting; 

  // Handle ballot updates from the BallotCounter component
  const handleBallotUpdate = useCallback(() => {
    console.log("Ballot update detected, refreshing candidate scores");
    fetchCandidateScores();
  }, []);

  // No need for separate useRealtime for avp_ballots since BallotCounter
  // is already handling that and will notify us via the callback

  // Removed the ballotCount state and fetchBallotCount function as they are now in the BallotCounter component
  // We'll now use the BallotCounter component directly in the render

  // Simplified fetchBallotCount function that uses the ref
  const fetchBallotCount = async () => {
    if (ballotCounterRef.current) {
      await ballotCounterRef.current.fetchBallotCount();
    }
  };

  useEffect(() => {
    fetchBallotCount();
  }, []);

  // Effect for access control
  useEffect(() => {
    if (profile && session) { // Ensure profile and session are loaded
      console.log("Vote counting permission:", userVoteCountingRight);
      if (userVoteCountingRight !== 'count female votes' && userVoteCountingRight !== 'count male votes') {
        showToast('Access Denied: You do not have permission to view this page.', 'error');
        navigate('/unauthorized'); // Or your preferred unauthorized/home route
      }
    } else if (session === null && profile === null && loading === false) { 
      // If no session and profile (not just initially loading), redirect to login.
      // This condition attempts to avoid redirecting while auth state is still loading.
      // It assumes `loading` becomes false after initial auth check.
      showToast('Please log in to access this page.', 'info');
      navigate('/login');
    }
  }, [profile, session, userVoteCountingRight, navigate, loading]);

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
    candidatesByList[listName].candidatesByScore.sort((a, b) => {
      const scoreA = userVoteCountingRight === 'count female votes' ? (a.score_from_female || 0) : (a.score_from_male || 0);
      const scoreB = userVoteCountingRight === 'count female votes' ? (b.score_from_female || 0) : (b.score_from_male || 0);
      return scoreB - scoreA;
    });
    
    // Sort the main candidates array by candidate_order (used in Vote Counting section)
    candidatesByList[listName].candidates.sort((a, b) => (a.candidate_order || 0) - (b.candidate_order || 0));
  });
  
  // Get sorted list names based on list_order
  const sortedListNames = Object.keys(candidatesByList).sort((a, b) => 
    candidatesByList[a].order - candidatesByList[b].order
  );

  // Checkbox tracking state for each candidate
  const [checkedVotes, setCheckedVotes] = useState<{ [candidateId: number]: CandidateVoteState }>({});
  
  // Confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  
  // Toast state - modified to use an ID for tracking
  const [toastId, setToastId] = useState<number>(0);
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    visible: boolean;
  } | null>(null);

  // Initialize checked votes state when candidates are loaded
  useEffect(() => {
    // Initialize checkedVotes for all candidates
    const initialCheckedVotes: { [candidateId: number]: CandidateVoteState } = {};
    candidates.forEach(candidate => {
      initialCheckedVotes[candidate.id] = { checked: false };
    });
    setCheckedVotes(initialCheckedVotes);
  }, [candidates.length]); // Only run when candidates length changes

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Add visibility change handler to refresh data when tab becomes active
  useEffect(() => {
    // Function to handle tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refreshing candidate data...');
        fetchCandidates();
      }
    };

    // Add event listener for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Fetch candidates data
  const fetchCandidates = async () => {
    try {
      setLoading(true);
      
      // Query candidates with voter information and list information
      const { data, error: fetchError } = await supabase
        .from('avp_candiate_votes')
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

      // Transform the data to include the full_name from avp_voters and list name from avp_candidate_lists
      const transformedCandidates = data.map(item => ({
        id: item.id,
        list_id: item.list_id,
        list_name: (item.avp_candidate_lists as any)?.name || 'Unknown List',
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
    console.log('Fetching candidate scores...');
    try {
      // Query only the necessary data for scores
      const { data, error: fetchError } = await supabase // Renamed error
        .from('avp_candiate_votes')
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
      // Don't show toast for background updates to avoid UI noise
    }
  };

  // Handle checkbox change
  const handleCheckboxChange = (candidateId: number) => {
    setCheckedVotes(prev => {
      const updatedVotes = { ...prev };
      
      // Toggle the checkbox
      if (updatedVotes[candidateId]) {
        updatedVotes[candidateId] = { checked: !updatedVotes[candidateId].checked };
      }
      
      return updatedVotes;
    });
  };

  // Handle posting scores for ALL candidates and reset ALL checkboxes
  const handlePostAllScores = async (updatedVotes: { [candidateId: number]: CandidateVoteState }) => {
    try {
      // Array to hold all update promises
      const updatePromises = [];
      const userVoteCountingRight = profile?.vote_counting; // Changed from profile?.app_metadata?.vote_counting

      if (!userVoteCountingRight || (userVoteCountingRight !== 'count female votes' && userVoteCountingRight !== 'count male votes')) {
        showToast('Permission denied: Cannot determine which scores to update.', 'error');
        return;
      }
      
      // Process each candidate
      for (const candidateId of Object.keys(updatedVotes).map(Number)) {
        // Calculate checked count directly from updatedVotes
        const candidateVotes = updatedVotes[candidateId];
        
        // Only update candidates with at least one checked vote
        if (candidateVotes.checked) {
          const candidate = candidates.find(c => c.id === candidateId);
          if (candidate) {
            const updatePayload: { score_from_female?: number; score_from_male?: number } = {};
            let currentRelevantScore = 0;

            if (userVoteCountingRight === 'count female votes') {
              currentRelevantScore = candidate.score_from_female || 0;
              updatePayload.score_from_female = currentRelevantScore + 1;
            } else if (userVoteCountingRight === 'count male votes') {
              currentRelevantScore = candidate.score_from_male || 0;
              updatePayload.score_from_male = currentRelevantScore + 1;
            }
            
            console.log(`Updating candidate ${candidate.full_name}: current relevant score=${currentRelevantScore}, new score=${currentRelevantScore + 1} for ${userVoteCountingRight}`);
            
            // Add update promise to array
            updatePromises.push(
              supabase
                .from('avp_candiate_votes')
                .update(updatePayload)
                .eq('id', candidateId)
            );
          }
        }
      }
      
      // Execute all updates in parallel
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        
        // Reset all checkboxes
        const resetCheckedVotes: { [candidateId: number]: CandidateVoteState } = {};
        
        candidates.forEach(candidate => {
          resetCheckedVotes[candidate.id] = { checked: false };
        });
        
        setCheckedVotes(resetCheckedVotes);
        
        // Use the non-blinking score update instead of full page refresh
        fetchCandidateScores();
        
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

      const userVoteCountingRight = profile?.vote_counting; // Changed from profile?.app_metadata?.vote_counting
      const updatePayload: { score_from_female?: number; score_from_male?: number } = {};
      let currentRelevantScore = 0;
      let scoreTypeMessage = '';

      if (userVoteCountingRight === 'count female votes') {
        currentRelevantScore = candidate.score_from_female || 0;
        updatePayload.score_from_female = currentRelevantScore + additionalScore;
        scoreTypeMessage = 'female votes';
      } else if (userVoteCountingRight === 'count male votes') {
        currentRelevantScore = candidate.score_from_male || 0;
        updatePayload.score_from_male = currentRelevantScore + additionalScore;
        scoreTypeMessage = 'male votes';
      } else {
        showToast('Permission denied: Cannot determine which score to update.', 'error');
        return;
      }
      
      // Update the score in the database
      const { error: updateError } = await supabase // Renamed error
        .from('avp_candiate_votes')
        .update(updatePayload)
        .eq('id', candidateId);
      
      if (updateError) throw updateError;
      
      // Reset checkboxes for this candidate
      setCheckedVotes(prev => ({
        ...prev,
        [candidateId]: { checked: false }
      }));
      
      showToast(`Score updated for ${candidate.full_name} (${scoreTypeMessage})`, 'success');
    } catch (err: any) {
      console.error('Error updating score:', err);
      showToast(`Failed to update score: ${err.message}`, 'error');
    }
  };

  // Handle "Post Manually" button click
  const handlePostManually = () => {
    // Removed setting modal open
    // Just directly call the post function
    handleConfirmPost();
  };

  // Handle confirmation of manual posting
  const handleConfirmPost = async (e?: React.MouseEvent) => {
    try {
      // Prevent default behavior that might cause refresh
      e?.preventDefault();
      
      const userVoteCountingRight = profile?.vote_counting;
      if (!userVoteCountingRight || (userVoteCountingRight !== 'count female votes' && userVoteCountingRight !== 'count male votes')) {
        showToast('Permission denied: Cannot determine which scores to update.', 'error');
        return;
      }

      // Check if any checkboxes are checked
      const hasVotes = isAnyCheckboxChecked();
      if (!hasVotes) {
        showToast('No votes to post', 'info');
        return;
      }

      // Generate timestamp-based ballot ID (Unix timestamp)
      const ballotId = Math.floor(Date.now() / 1000);
      const ballotSource = userVoteCountingRight === 'count female votes' ? 'female' : 'male';
      const currentTime = new Date().toISOString();
      
      // Array to hold ballot inserts
      const ballotInserts = [];
      
      // Process each candidate
      for (const candidateId of Object.keys(checkedVotes).map(Number)) {
        const candidateVotes = checkedVotes[candidateId];
        const vote = candidateVotes.checked ? 1 : 0;
        
        // Add each candidate to the ballot inserts array
        ballotInserts.push({
          ballot_id: ballotId,
          candidate_id: candidateId,
          vote: vote,
          ballot_type: 'valid',
          ballot_source: ballotSource,
          post_date: currentTime
        });
      }
      
      // Insert all records into avp_ballots
      const { error: ballotsError } = await supabase
        .from('avp_ballots')
        .insert(ballotInserts);
      
      if (ballotsError) {
        console.error('Error inserting ballot records:', ballotsError);
        showToast(`Failed to record ballot: ${ballotsError.message}`, 'error');
        return;
      }
      
      // Reset all checkboxes
      const resetCheckedVotes: { [candidateId: number]: CandidateVoteState } = {};
      
      candidates.forEach(candidate => {
        resetCheckedVotes[candidate.id] = { checked: false };
      });
      
      setCheckedVotes(resetCheckedVotes);
      
      showToast('Ballot posted successfully', 'success');
      
      // Directly update the ballot counter state without waiting for realtime events
      if (ballotCounterRef.current) {
        ballotCounterRef.current.updateLocalCount('valid', ballotSource as 'male' | 'female');
      }
      
      // Fetch the updated candidate scores from the view
      fetchCandidateScores();
    } catch (err: any) {
      console.error('Error posting scores manually:', err);
      showToast(`Failed to update scores: ${err.message}`, 'error');
    }
  };

  // Handle blank ballot submission
  const handleBlankBallot = async () => {
    try {
      const userVoteCountingRight = profile?.vote_counting;
      if (!userVoteCountingRight || (userVoteCountingRight !== 'count female votes' && userVoteCountingRight !== 'count male votes')) {
        showToast('Permission denied: Cannot determine ballot source.', 'error');
        return;
      }

      // Generate timestamp-based ballot ID
      const ballotId = Math.floor(Date.now() / 1000);
      const ballotSource = userVoteCountingRight === 'count female votes' ? 'female' : 'male';
      const currentTime = new Date().toISOString();
      
      // Array to hold ballot inserts
      const ballotInserts = [];
      
      // Create a record for each candidate with vote=0 and ballot_type='blank'
      for (const candidate of candidates) {
        ballotInserts.push({
          ballot_id: ballotId,
          candidate_id: candidate.id,
          vote: 0,
          ballot_type: 'blank',
          ballot_source: ballotSource,
          post_date: currentTime
        });
      }
      
      // Insert all records into avp_ballots
      const { error: ballotsError } = await supabase
        .from('avp_ballots')
        .insert(ballotInserts);
      
      if (ballotsError) {
        console.error('Error inserting blank ballot records:', ballotsError);
        showToast(`Failed to record blank ballot: ${ballotsError.message}`, 'error');
        return;
      }
      
      // Reset all checkboxes
      const resetCheckedVotes: { [candidateId: number]: CandidateVoteState } = {};
      
      candidates.forEach(candidate => {
        resetCheckedVotes[candidate.id] = { checked: false };
      });
      
      setCheckedVotes(resetCheckedVotes);
      
      showToast('Blank ballot recorded successfully', 'success');
      
      // Directly update the ballot counter state without waiting for realtime events
      if (ballotCounterRef.current) {
        ballotCounterRef.current.updateLocalCount('blank', ballotSource as 'male' | 'female');
      }
      
    } catch (err: any) {
      console.error('Error recording blank ballot:', err);
      showToast(`Failed to record blank ballot: ${err.message}`, 'error');
    }
  };

  // Handle invalid ballot submission
  const handleInvalidBallot = async () => {
    try {
      const userVoteCountingRight = profile?.vote_counting;
      if (!userVoteCountingRight || (userVoteCountingRight !== 'count female votes' && userVoteCountingRight !== 'count male votes')) {
        showToast('Permission denied: Cannot determine ballot source.', 'error');
        return;
      }

      // Generate timestamp-based ballot ID
      const ballotId = Math.floor(Date.now() / 1000);
      const ballotSource = userVoteCountingRight === 'count female votes' ? 'female' : 'male';
      const currentTime = new Date().toISOString();
      
      // Array to hold ballot inserts
      const ballotInserts = [];
      
      // Create a record for each candidate with actual vote values (1 for checked, 0 for unchecked) but ballot_type='invalid'
      for (const candidateId of Object.keys(checkedVotes).map(Number)) {
        const candidateVotes = checkedVotes[candidateId];
        const vote = candidateVotes.checked ? 1 : 0;
        
        ballotInserts.push({
          ballot_id: ballotId,
          candidate_id: candidateId,
          vote: vote,
          ballot_type: 'invalid',
          ballot_source: ballotSource,
          post_date: currentTime
        });
      }
      
      // Insert all records into avp_ballots
      const { error: ballotsError } = await supabase
        .from('avp_ballots')
        .insert(ballotInserts);
      
      if (ballotsError) {
        console.error('Error inserting invalid ballot records:', ballotsError);
        showToast(`Failed to record invalid ballot: ${ballotsError.message}`, 'error');
        return;
      }
      
      // Reset all checkboxes
      const resetCheckedVotes: { [candidateId: number]: CandidateVoteState } = {};
      
      candidates.forEach(candidate => {
        resetCheckedVotes[candidate.id] = { checked: false };
      });
      
      setCheckedVotes(resetCheckedVotes);
      
      showToast('Invalid ballot recorded successfully', 'success');
      
      // Directly update the ballot counter state without waiting for realtime events
      if (ballotCounterRef.current) {
        ballotCounterRef.current.updateLocalCount('invalid', ballotSource as 'male' | 'female');
      }
      
    } catch (err: any) {
      console.error('Error recording invalid ballot:', err);
      showToast(`Failed to record invalid ballot: ${err.message}`, 'error');
    }
  };

  // Reset all checkboxes
  const handleResetAll = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = () => {
    // Reset checked votes
    const resetCheckedVotes: { [candidateId: number]: CandidateVoteState } = {};
    
    candidates.forEach(candidate => {
      resetCheckedVotes[candidate.id] = { checked: false };
    });
    
    setCheckedVotes(resetCheckedVotes);
    
    showToast('All checkboxes reset', 'info');
  };

  // Add effect to handle auto-dismiss backup for Toast component
  useEffect(() => {
    if (toast && toast.visible) {
      const timer = setTimeout(() => {
        closeToast();
      }, 3500); // Slightly longer than Toast component's own timer as a backup
      
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    // Increment toast ID to ensure React sees it as a new toast
    const newId = toastId + 1;
    setToastId(newId);
    setToast({ id: newId, message, type, visible: true });
  };

  // Close toast notification
  const closeToast = () => {
    if (toast) {
      setToast(null);
    }
  };

  // Add a function to check if any checkbox is checked
  const isAnyCheckboxChecked = (): boolean => {
    return Object.values(checkedVotes).some(vote => vote.checked);
  };
  
  // Check if all checkboxes in a specific list are checked
  const areAllListCheckboxesChecked = (listName: string): boolean => {
    const listCandidates = candidatesByList[listName]?.candidates || [];
    return listCandidates.length > 0 && listCandidates.every(candidate => 
      checkedVotes[candidate.id]?.checked === true
    );
  };
  
  // Handle check all for a specific list
  const handleCheckAllForList = (listName: string, checked: boolean) => {
    const listCandidates = candidatesByList[listName]?.candidates || [];
    const updatedVotes = { ...checkedVotes };
    
    listCandidates.forEach(candidate => {
      if (updatedVotes[candidate.id]) {
        updatedVotes[candidate.id] = { checked };
      }
    });
    
    setCheckedVotes(updatedVotes);
  };

  // Loading state
  if (loading || !profile) { // Also wait for profile to be available for permission checks
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

  // Conditional rendering if access rights are not met (after profile is loaded)
  // This is a fallback, useEffect should handle redirection.
  if (profile && userVoteCountingRight !== 'count female votes' && userVoteCountingRight !== 'count male votes') {
    return (
      <div className="p-6 text-center bg-white dark:bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 dark:border-yellow-700 p-6 rounded-lg shadow-sm max-w-lg">
          <p className="text-yellow-700 dark:text-yellow-200 text-lg font-medium">Access Denied</p>
          <p className="mt-3 text-yellow-600 dark:text-yellow-300 text-sm">You do not have the necessary permissions to view this page. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-white dark:bg-gray-900 min-h-screen">
      {/* Toast notification */}
      {toast && toast.visible && (
        <Toast
          key={toast.id}
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
        <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">Vote Counting</h2>
        <p className="text-gray-600 dark:text-gray-400">Track and update candidate votes in real-time</p>
      </div>
      
      <BallotCounter ref={ballotCounterRef} onBallotUpdate={handleBallotUpdate} />

      {/* Live Scores Section */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-4">Live Scores</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedListNames.map(listName => {
            const listData = candidatesByList[listName];
            // Ensure candidatesByScore exists before mapping
            if (!listData || !listData.candidatesByScore) {
              return null; 
            }
            return (
            <div 
              key={listName}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-blue-100 dark:border-gray-700"
            >
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{listName}</h4>
              <div className="space-y-3">
                {listData.candidatesByScore.map(candidate => {
                  const liveScoreDisplay = userVoteCountingRight === 'count female votes'
                    ? candidate.score_from_female
                    : userVoteCountingRight === 'count male votes'
                      ? candidate.score_from_male
                      : (candidate.score_from_female || 0) + (candidate.score_from_male || 0); // Fallback if rights are somehow bypassed/mixed

                  return (
                    <div 
                      key={candidate.id} 
                      className={`flex items-center p-3 rounded-lg transition-all ${
                        candidate.isUpdating 
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 animate-pulse' 
                          : 'bg-blue-50 dark:bg-blue-900/20'
                      }`}
                    >
                      <div className="flex-grow truncate mr-3">
                        <span className="font-medium text-gray-900 dark:text-white">{candidate.full_name}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2"> ({candidate.candidate_of})</span>
                      </div>
                      <div className="flex items-center flex-shrink-0">
                        <div className="flex flex-col items-end mr-4 w-20">
                          <div className="flex items-center w-full">
                            <span className="text-sm text-pink-500 dark:text-pink-400 w-6 text-center">F</span>
                            <span className="text-sm font-medium text-pink-600 dark:text-pink-400 w-6 text-center">{candidate.score_from_female || 0}</span>
                          </div>
                          <div className="flex items-center w-full">
                            <span className="text-sm text-blue-500 dark:text-blue-400 w-6 text-center">M</span>
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400 w-6 text-center">{candidate.score_from_male || 0}</span>
                          </div>
                        </div>
                        <div className="pl-3 border-l border-gray-200 dark:border-gray-700 w-12 text-center">
                          <span className="text-lg font-bold text-purple-700 dark:text-purple-400">{(candidate.score_from_female || 0) + (candidate.score_from_male || 0)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )})}
        </div>

        {/* Repositioned Buttons */}
        <div className="mt-6 flex flex-wrap gap-4">
          <button
            onClick={handlePostManually}
            disabled={!isAnyCheckboxChecked()}
            className={`px-5 py-2.5 ${isAnyCheckboxChecked() ? 'bg-green-600 hover:bg-green-700' : 'bg-green-300 cursor-not-allowed'} text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 shadow-md flex items-center`}
          >
            <i className="fas fa-upload mr-2"></i>
            Post Ballot
          </button>
          <button
            onClick={handleBlankBallot}
            className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50 shadow-md flex items-center"
          >
            <i className="fas fa-file-alt mr-2"></i>
            Blank Ballot
          </button>
          <button
            onClick={handleInvalidBallot}
            className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50 shadow-md flex items-center"
          >
            <i className="fas fa-times-circle mr-2"></i>
            Invalid Ballot
          </button>
          <button
            onClick={handleResetAll}
            className="px-5 py-2.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 shadow-md flex items-center"
          >
            <i className="fas fa-undo mr-2"></i>
            Reset All Checkboxes
          </button>
        </div>
      </div>
      {/* End of Live Scores Section */}

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
                    <th className="px-6 py-3 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Checkbox</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <td colSpan={2} className="px-6 py-2 text-sm text-gray-500 dark:text-gray-400 text-right font-medium">
                      Check all candidates in this list:
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={areAllListCheckboxesChecked(listName)}
                            onChange={(e) => handleCheckAllForList(listName, e.target.checked)}
                            className="form-checkbox h-5 w-5 transition duration-150 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 text-blue-600 dark:text-blue-500"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                  {candidatesByList[listName].candidates.map(candidate => (
                    <tr key={candidate.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {candidate.full_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {candidate.candidate_of}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <label 
                            className={`inline-flex items-center ${checkedVotes[candidate.id]?.checked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checkedVotes[candidate.id]?.checked || false}
                              onChange={() => handleCheckboxChange(candidate.id)}
                              className={`form-checkbox h-5 w-5 transition duration-150 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 ${
                                checkedVotes[candidate.id]?.checked ? 'opacity-70 bg-gray-200 dark:bg-gray-700' : 'text-blue-600 dark:text-blue-500'
                              }`}
                            />
                          </label>
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

      {/* Buttons duplicated for easier access */}
      <div className="mt-6 flex flex-wrap gap-4">
        <button
          onClick={handlePostManually}
          disabled={!isAnyCheckboxChecked()}
          className={`px-5 py-2.5 ${isAnyCheckboxChecked() ? 'bg-green-600 hover:bg-green-700' : 'bg-green-300 cursor-not-allowed'} text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 shadow-md flex items-center`}
        >
          <i className="fas fa-upload mr-2"></i>
          Post Ballot
        </button>
        <button
          onClick={handleBlankBallot}
          className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50 shadow-md flex items-center"
        >
          <i className="fas fa-file-alt mr-2"></i>
          Blank Ballot
        </button>
        <button
          onClick={handleInvalidBallot}
          className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50 shadow-md flex items-center"
        >
          <i className="fas fa-times-circle mr-2"></i>
          Invalid Ballot
        </button>
        <button
          onClick={handleResetAll}
          className="px-5 py-2.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 shadow-md flex items-center"
        >
          <i className="fas fa-undo mr-2"></i>
          Reset All Checkboxes
        </button>
      </div>
    </div>
  );
};

export default VoteCounting;