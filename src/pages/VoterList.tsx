import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';

interface Voter {
  id: number;
  full_name: string;
  has_voted: boolean;
  created_at: string;
}

const VoterList: React.FC = () => {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuthStore();

  useEffect(() => {
    if (profile?.voters_list_access === 'none') {
      setError('You do not have permission to view this page.');
      setLoading(false);
      return;
    }

    const fetchVoters = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('avp_voters')
          .select('*')
          .order('full_name', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        setVoters(data || []);

      } catch (err: any) {
        setError(err.message || 'Failed to fetch voters. Check RLS policies and network.');
      } finally {
        setLoading(false);
      }
    };

    fetchVoters();

    const channel = supabase
      .channel('voter-list-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'avp_voters' },
        (payload) => {
          fetchVoters(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [profile]);

  if (loading) {
    return <div className="p-6 text-center">Loading voter list...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Voter List</h2>
      {voters.length === 0 ? (
        <p>No voters found.</p>
      ) : (
        <div className="overflow-x-auto shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Has Voted</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {voters.map((voter) => (
                <tr key={voter.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{voter.full_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{voter.has_voted ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default VoterList;
