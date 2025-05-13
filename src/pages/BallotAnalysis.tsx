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

  // Count statistics
  const validBallots = formattedBallots.filter(b => !b.is_blank && b.is_valid).length;
  const invalidBallots = formattedBallots.filter(b => !b.is_blank && !b.is_valid).length;
  const blankBallots = formattedBallots.filter(b => b.is_blank).length;
  const totalBallots = formattedBallots.length;

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
        <div className="p-4 border-b border-blue-100 dark:border-gray-700 bg-blue-50 dark:bg-gray-750">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300">Detailed Ballot Analysis</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                  Ballot #
                </th>
                {candidateIds.map(id => (
                  <th key={`header-${id}`} className="px-6 py-3.5 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                    {candidates[id]?.full_name || `Candidate ${id}`}
                  </th>
                ))}
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {formattedBallots.length === 0 && (
                <tr>
                  <td colSpan={candidateIds.length + 3} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No ballots found. Ballots will appear here once they are submitted.
                  </td>
                </tr>
              )}
              
              {formattedBallots.map((ballot) => {
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {ballot.ballot_id}
                    </td>
                    {candidateIds.map(id => (
                      <td key={`ballot-${ballot.ballot_id}-candidate-${id}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                        <span className={`${
                          ballot.candidate_votes[id] === 1 ? 'text-green-600 dark:text-green-400 font-bold' : 
                          ballot.candidate_votes[id] === 0 ? 'text-gray-500 dark:text-gray-400' :
                          ballot.candidate_votes[id] === -1 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {ballot.candidate_votes[id]}
                        </span>
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                      {ballot.post_date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getBallotStatusClass(status)}`}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BallotAnalysis;