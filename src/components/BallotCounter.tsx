import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRealtime } from '../lib/useRealtime';

interface BallotCountProps {
  className?: string; // Optional styling class
}

// BallotCount interface for the component state
interface BallotCounts {
  total_valid: number;
  male_valid: number;
  female_valid: number;
  total_blank: number;
  male_blank: number;
  female_blank: number;
  total_invalid: number;
  male_invalid: number;
  female_invalid: number;
}

const BallotCounter: React.FC<BallotCountProps> = ({ className = '' }) => {
  // Ballot count state
  const [ballotCount, setBallotCount] = useState<BallotCounts>({
    total_valid: 0,
    male_valid: 0,
    female_valid: 0,
    total_blank: 0,
    male_blank: 0,
    female_blank: 0,
    total_invalid: 0,
    male_invalid: 0,
    female_invalid: 0
  });

  // Memoize the fetchBallotCount function with useCallback
  const fetchBallotCount = useCallback(async () => {
    try {
      // Query distinct ballot_ids from avp_ballots table
      const { data, error } = await supabase
        .from('avp_ballots')
        .select('ballot_id, ballot_type, ballot_source')
        .limit(1000000) // High limit to get all records
        .order('ballot_id', { ascending: false });

      if (error) {
        console.error('Error fetching ballot count:', error);
        return;
      }

      if (data) {
        // Initialize counters using Sets for distinct ballot IDs
        let valid_ballots = new Set();
        let male_valid_ballots = new Set();
        let female_valid_ballots = new Set();
        
        let blank_ballots = new Set();
        let male_blank_ballots = new Set();
        let female_blank_ballots = new Set();
        
        let invalid_ballots = new Set();
        let male_invalid_ballots = new Set();
        let female_invalid_ballots = new Set();

        // Count each type of ballot by distinct ballot_id
        data.forEach(ballot => {
          if (ballot.ballot_type === 'valid') {
            valid_ballots.add(ballot.ballot_id);
            if (ballot.ballot_source === 'male') male_valid_ballots.add(ballot.ballot_id);
            else if (ballot.ballot_source === 'female') female_valid_ballots.add(ballot.ballot_id);
          } 
          else if (ballot.ballot_type === 'blank') {
            blank_ballots.add(ballot.ballot_id);
            if (ballot.ballot_source === 'male') male_blank_ballots.add(ballot.ballot_id);
            else if (ballot.ballot_source === 'female') female_blank_ballots.add(ballot.ballot_id);
          }
          else if (ballot.ballot_type === 'invalid') {
            invalid_ballots.add(ballot.ballot_id);
            if (ballot.ballot_source === 'male') male_invalid_ballots.add(ballot.ballot_id);
            else if (ballot.ballot_source === 'female') female_invalid_ballots.add(ballot.ballot_id);
          }
        });

        // Use the size of each Set to get distinct counts
        setBallotCount({
          total_valid: valid_ballots.size,
          male_valid: male_valid_ballots.size,
          female_valid: female_valid_ballots.size,
          total_blank: blank_ballots.size,
          male_blank: male_blank_ballots.size,
          female_blank: female_blank_ballots.size,
          total_invalid: invalid_ballots.size,
          male_invalid: male_invalid_ballots.size,
          female_invalid: female_invalid_ballots.size
        });
      }
    } catch (err) {
      console.error('Error in fetchBallotCount:', err);
    }
  }, []);

  // Fetch ballot counts when component mounts
  useEffect(() => {
    fetchBallotCount();
  }, [fetchBallotCount]);

  // Subscribe to real-time changes in avp_ballots table
  useRealtime({
    table: 'avp_ballots',
    event: 'INSERT', // Only listen for new ballots
    onChange: (payload) => {
      console.log('Real-time ballot update:', payload);
      fetchBallotCount(); // Refetch counts when a new ballot is added
    }
  });

  // Function to refresh the ballot count (can be called externally)
  const refreshBallotCount = () => {
    fetchBallotCount();
  };

  return (
    <div className={`mb-6 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Valid Ballots Card */}
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border-t-4 border-purple-500">
          <h4 className="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-2">Valid Ballots</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total:</span>
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{ballotCount.total_valid}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Male:</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{ballotCount.male_valid}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Female:</span>
              <span className="text-lg font-bold text-pink-600 dark:text-pink-400">{ballotCount.female_valid}</span>
            </div>
          </div>
        </div>
        
        {/* Blank Ballots Card */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border-t-4 border-yellow-500">
          <h4 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300 mb-2">Blank Ballots</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total:</span>
              <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{ballotCount.total_blank}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Male:</span>
              <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{ballotCount.male_blank}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Female:</span>
              <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{ballotCount.female_blank}</span>
            </div>
          </div>
        </div>
        
        {/* Invalid Ballots Card */}
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border-t-4 border-red-500">
          <h4 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">Invalid Ballots</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total:</span>
              <span className="text-lg font-bold text-red-600 dark:text-red-400">{ballotCount.total_invalid}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Male:</span>
              <span className="text-lg font-bold text-red-600 dark:text-red-400">{ballotCount.male_invalid}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Female:</span>
              <span className="text-lg font-bold text-red-600 dark:text-red-400">{ballotCount.female_invalid}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BallotCounter;