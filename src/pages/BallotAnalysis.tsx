import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';

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
  const { profile } = useAuthStore();

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

        // Then fetch all ballots
        const { data, error } = await supabase
          .from('avp_ballots')
          .select('*')
          .order('post_date', { ascending: false });

        if (error) {
          throw error;
        }

        setBallots(data || []);
        
        // Process the ballots to format them as required for the table
        const processed = processBallotsData(data, sortedCandidateIds);
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
        candidateVotes[ballot.candidate_id] = ballot.vote;
        
        // Check if this is a blank ballot
        if (ballot.vote !== 0) {
          isBlank = false;
        }
      }
      
      // Determine if valid or invalid
      // A ballot is valid if it has at least one vote of 1
      if (!isBlank) {
        isValid = Object.values(candidateVotes).some(vote => vote === 1);
      }

      // Get ballot type and date from the first ballot in the group
      const firstBallot = groupBallots[0];
      
      return {
        ballot_id: parseInt(ballotId),
        candidate_votes: candidateVotes,
        ballot_type: firstBallot.ballot_type,
        post_date: new Date(firstBallot.post_date).toLocaleString(),
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
        <h2 className="text-lg font-semibold">Error Loading Ballots</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Ballot Analysis</h1>
      
      <div className="stats-summary mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Total Ballots</h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formattedBallots.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Valid Ballots</h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {formattedBallots.filter(b => !b.is_blank && b.is_valid).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Invalid/Blank Ballots</h3>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">
            {formattedBallots.filter(b => b.is_blank || !b.is_valid).length}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <th className="py-3 px-4 text-left">Ballot #</th>
              {candidateIds.map(id => (
                <th key={`header-${id}`} className="py-3 px-4 text-left">
                  {candidates[id]?.full_name || `Candidate ${id}`}
                </th>
              ))}
              <th className="py-3 px-4 text-left">Timestamp</th>
              <th className="py-3 px-4 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {formattedBallots.map((ballot) => {
              const status = getBallotStatus(ballot);
              return (
                <tr 
                  key={`ballot-${ballot.ballot_id}`}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="py-3 px-4 text-gray-800 dark:text-gray-200">
                    {ballot.ballot_id}
                  </td>
                  {candidateIds.map(id => (
                    <td key={`ballot-${ballot.ballot_id}-candidate-${id}`} className="py-3 px-4 text-gray-800 dark:text-gray-200">
                      {ballot.candidate_votes[id]}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-gray-800 dark:text-gray-200">
                    {ballot.post_date}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBallotStatusClass(status)}`}>
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {formattedBallots.length === 0 && (
              <tr>
                <td 
                  colSpan={candidateIds.length + 3} 
                  className="py-6 px-4 text-center text-gray-500 dark:text-gray-400"
                >
                  No ballot data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BallotAnalysis;