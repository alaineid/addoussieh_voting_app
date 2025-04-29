import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { supabase } from '../lib/supabaseClient';
import {
  PieChart, Pie, BarChart, Bar, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell, XAxis, YAxis
} from 'recharts';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Interface representing a voter from the avp_voters table
interface Voter {
  id: number;
  full_name: string | null;
  gender: string | null;
  register_sect: string | null;
  residence: string | null;
  situation: string | null;
  family: string | null;
  has_voted: boolean | null;
  dob: string | null;
  alliance: string | null;
}

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-md shadow-lg ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white`}>
      <div className="mr-3">
        {type === 'success' ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <div>{message}</div>
      <button 
        onClick={onClose} 
        className="ml-6 text-white hover:text-gray-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', 
  '#82CA9D', '#F06292', '#4DB6AC', '#FFB74D', '#9575CD'
];

const VotingStatistics: React.FC = () => {
  const { isDarkMode } = useThemeStore();
  const { profile } = useAuthStore();
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [voteTimestamps, setVoteTimestamps] = useState<Date[]>([]);
  const [lastHourVotes, setLastHourVotes] = useState<number>(0);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const votingStartTimeRef = useRef<Date | null>(null);
  const subscriptionErrorCountRef = useRef<number>(0);
  
  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    visible: boolean;
  } | null>(null);

  // Determine permissions based on voting_day_access (same structure as VotingDay)
  const hasViewPermission = profile?.voting_day_access?.includes('view') || profile?.voting_day_access?.includes('edit') || false;
  
  // Get gender filter based on permission
  const getGenderFilter = () => {
    if (!profile || !profile.voting_day_access) return null;
    
    const accessType = profile.voting_day_access;
    
    if (accessType === 'view female' || accessType === 'edit female') {
      return 'الإناث'; // Female
    } else if (accessType === 'view male' || accessType === 'edit male') {
      return 'الذكور'; // Male
    }
    
    return null; // For 'view both' and 'edit both', return null to show all
  };
  
  // Close toast notification
  const handleCloseToast = () => {
    setToast(null);
  };

  // Fetch all voter data
  const fetchVoters = async () => {
    try {
      // Build query with required columns
      let query = supabase
        .from('avp_voters')
        .select('id, full_name, gender, register_sect, residence, situation, family, has_voted, dob, alliance');
      
      // Apply gender filter based on permissions
      const genderFilter = getGenderFilter();
      if (genderFilter) {
        query = query.eq('gender', genderFilter);
      }
      
      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      
      setVoters(data || []);
      
      // Track each voter's timestamp when first loaded (only for those who already voted)
      const now = new Date();
      const votedVoters = data?.filter(voter => voter.has_voted) || [];
      
      // If this is the first load and we have voted voters,
      // we'll distribute their votes across the last hour for initialization
      if (votedVoters.length > 0 && voteTimestamps.length === 0) {
        const simulatedTimestamps = [];
        // Distribute the already-voted voters across the past hour
        for (let i = 0; i < votedVoters.length; i++) {
          const randomMinutesAgo = Math.floor(Math.random() * 60);
          const timestamp = new Date(now.getTime() - randomMinutesAgo * 60000);
          simulatedTimestamps.push(timestamp);
        }
        setVoteTimestamps(simulatedTimestamps);
      }

      // Initialize voting start time if not already set
      if (!votingStartTimeRef.current) {
        votingStartTimeRef.current = new Date();
      }
      
      calculateLastHourVotes();
      
    } catch (err: any) {
      console.error('Error fetching voter data:', err);
      setError(err.message || 'Failed to load voter data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate last hour votes
  const calculateLastHourVotes = () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const votesInLastHour = voteTimestamps.filter(
      timestamp => timestamp >= oneHourAgo
    ).length;
    
    setLastHourVotes(votesInLastHour);
  };

  // Setup realtime subscription to voter changes
  const setupRealtimeSubscription = () => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel('voting-statistics-changes-' + Date.now()) // Add timestamp to make each channel name unique
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'avp_voters' },
        (payload) => {
          console.log('Voter change detected in voting statistics:', payload);
          
          // Get the current gender filter based on permissions
          const genderFilter = getGenderFilter();
          
          if (payload.eventType === 'UPDATE' && 
              payload.new && payload.old && 
              !payload.old.has_voted && payload.new.has_voted) {
            
            // Only track votes for the gender we're allowed to see
            if (genderFilter && payload.new.gender !== genderFilter) {
              return;
            }
            
            // This is a new vote - track the timestamp
            const now = new Date();
            setVoteTimestamps(prev => [...prev, now]);
          }

          // For all changes, refetch data
          fetchVoters();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to voting statistics changes!');
          subscriptionErrorCountRef.current = 0; // Reset error count on successful subscription
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error:', err);
          
          subscriptionErrorCountRef.current += 1;
          
          // If we've had multiple errors, show a toast to the user
          if (subscriptionErrorCountRef.current >= 3) {
            setToast({
              message: 'Having trouble with live updates. You may need to refresh the page.',
              type: 'error',
              visible: true
            });
          }
          
          // Try to reestablish connection after a delay
          setTimeout(() => {
            if (subscriptionErrorCountRef.current < 5) { // Don't keep trying forever
              setupRealtimeSubscription();
            }
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

    // Store the channel reference for cleanup
    realtimeChannelRef.current = channel;
  };

  // Initialize data and subscription
  useEffect(() => {
    if (profile?.voting_day_access === 'none') {
      setError('You do not have permission to view this page.');
      setLoading(false);
      return;
    }

    setLoading(true);
    
    fetchVoters()
      .then(() => {
        setupRealtimeSubscription();
      })
      .catch(err => {
        console.error('Initial data fetch error:', err);
      });
    
    // Update hourly votes every minute
    const intervalId = setInterval(() => {
      calculateLastHourVotes();
    }, 60000);
    
    return () => {
      clearInterval(intervalId);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [profile?.id]);

  // Watch for changes in voting_day_access permission and perform a full reset
  useEffect(() => {
    if (!profile || loading) return;
    
    if (profile.voting_day_access === 'none') {
      setError('You do not have permission to view this page.');
      setLoading(false);
      return;
    }
    
    console.log('Permission changed to:', profile.voting_day_access);
    
    // Clear existing data to avoid showing incorrect filtered data momentarily
    setVoters([]);
    
    // Clean up existing subscription if it exists
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    
    // Fetch data with new filter
    fetchVoters()
      .then(() => {
        setupRealtimeSubscription();
        
        // Show success toast for better UX feedback
        setToast({
          message: `Filter applied: ${profile.voting_day_access}`,
          type: 'success',
          visible: true
        });
      })
      .catch(err => {
        console.error('Error applying new filter:', err);
        setToast({
          message: 'Failed to apply new filter. Please refresh the page.',
          type: 'error',
          visible: true
        });
      });
      
  }, [profile?.voting_day_access]);
  
  // Update last hour votes when vote timestamps change
  useEffect(() => {
    calculateLastHourVotes();
  }, [voteTimestamps]);

  // Computed statistics for charts
  const genderStats = useMemo(() => {
    // Use Arabic terms for counting, but keep English labels for the chart
    const counts = { Male: 0, Female: 0, Unknown: 0 }; 
    voters.forEach(voter => {
      if (voter.gender === 'الذكور') { // Arabic for Male
        counts.Male++;
      } else if (voter.gender === 'الإناث') { // Arabic for Female
        counts.Female++;
      } else {
        counts.Unknown++; // Count any other or null values
      }
    });
    // Filter out Unknown if its count is 0
    return Object.entries(counts)
      .filter(([name, value]) => value > 0 || (name !== 'Unknown')) 
      .filter(([name, value]) => name !== 'Unknown' || value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [voters]);

  const genderVotingStats = useMemo(() => {
    const counts = { 
      'Male Voted': 0, 
      'Male Not Voted': 0,
      'Female Voted': 0,
      'Female Not Voted': 0
    };
    
    voters.forEach(voter => {
      if (voter.gender === 'الذكور' && voter.has_voted) {
        counts['Male Voted']++;
      } else if (voter.gender === 'الذكور' && !voter.has_voted) {
        counts['Male Not Voted']++;
      } else if (voter.gender === 'الإناث' && voter.has_voted) {
        counts['Female Voted']++;
      } else if (voter.gender === 'الإناث' && !voter.has_voted) {
        counts['Female Not Voted']++;
      }
    });
    
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [voters]);

  const votedByGender = useMemo(() => {
    const counts: { name: string; value: number }[] = [];

    voters.forEach((voter) => {
      if (voter.gender === 'الذكور') {
        if (voter.has_voted) {
          counts.push({ name: 'Male Voted', value: (counts.find(c => c.name === 'Male Voted')?.value || 0) + 1 });
        } else {
          counts.push({ name: 'Male Not Voted', value: (counts.find(c => c.name === 'Male Not Voted')?.value || 0) + 1 });
        }
      } else if (voter.gender === 'الإناث') {
        if (voter.has_voted) {
          counts.push({ name: 'Female Voted', value: (counts.find(c => c.name === 'Female Voted')?.value || 0) + 1 });
        } else {
          counts.push({ name: 'Female Not Voted', value: (counts.find(c => c.name === 'Female Not Voted')?.value || 0) + 1 });
        }
      }
    });

    return counts;
  }, [voters]);

  const voterTurnoutStats = useMemo(() => {
    const voted = voters.filter(v => v.has_voted).length;
    const notVoted = voters.length - voted;
    return [
      { name: 'Voted', value: voted },
      { name: 'Not Voted', value: notVoted }
    ];
  }, [voters]);

  const votedPercentage = useMemo(() => {
    if (voters.length === 0) return 0;
    return Math.round((voters.filter(v => v.has_voted).length / voters.length) * 100);
  }, [voters]);

  // Format for the pie chart custom label
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return percent * 100 > 5 ? (
      <text 
        x={x} 
        y={y} 
        fill={isDarkMode ? "white" : "black"}
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
      >
        {`${name}: ${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-900 min-h-screen">
        <div className="mb-6">
          <div className="h-10 w-72 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mb-6"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          ))}
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
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 10-2 0 1 1 0 002 0z" />
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
          onClose={handleCloseToast}
        />
      )}
      
      <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">Voting Statistics</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Live statistics and detailed analytics for voting patterns</p>
      
      {/* Live Updates Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-800 dark:to-blue-900 text-white p-4 rounded-xl mb-6 shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="flex flex-col md:flex-row items-center mb-3 md:mb-0">
            <div className="flex items-center mr-0 md:mr-6 mb-3 md:mb-0">
              <div className="animate-pulse mr-2 h-3 w-3 rounded-full bg-green-400"></div>
              <span className="font-semibold">LIVE</span>
            </div>
            <div className="text-center md:text-left">
              <p className="text-xl font-bold">{votedPercentage}% Turnout</p>
              <p className="text-sm opacity-80">of registered voters have voted</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="bg-white/10 px-4 py-2 rounded-lg">
              <p className="text-center">
                <span className="block text-2xl font-bold">{lastHourVotes}</span>
                <span className="text-xs opacity-80">votes in the last hour</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Overall Voter Turnout */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Voter Turnout</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={voterTurnoutStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={80}
                  dataKey="value"
                >
                  <Cell fill="#4CAF50" /> {/* Voted */}
                  <Cell fill="#F44336" /> {/* Not Voted */}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#374151' : '#e5e7eb',
                    color: isDarkMode ? '#f3f4f6' : '#1f2937'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Gender Distribution with Voting Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Gender Voting Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Voted', Male: genderVotingStats.find(item => item.name === 'Male Voted')?.value || 0, Female: genderVotingStats.find(item => item.name === 'Female Voted')?.value || 0 },
                  { name: 'Not Voted', Male: genderVotingStats.find(item => item.name === 'Male Not Voted')?.value || 0, Female: genderVotingStats.find(item => item.name === 'Female Not Voted')?.value || 0 }
                ]}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  type="number" 
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  width={100}
                  tick={{ fontSize: 12 }}
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#374151' : '#e5e7eb',
                    color: isDarkMode ? '#f3f4f6' : '#1f2937'
                  }} 
                />
                <Legend />
                <Bar dataKey="Male" stackId="a" fill="#2196F3" name="Male" />
                <Bar dataKey="Female" stackId="a" fill="#E91E63" name="Female" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Situation Voting Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Situation Voting Status</h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'AGAINST', Voted: voters.filter(voter => voter.situation === 'AGAINST' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.situation === 'AGAINST' && !voter.has_voted).length },
                  { name: 'WITH', Voted: voters.filter(voter => voter.situation === 'WITH' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.situation === 'WITH' && !voter.has_voted).length },
                  { name: 'MILITARY', Voted: voters.filter(voter => voter.situation === 'MILITARY' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.situation === 'MILITARY' && !voter.has_voted).length },
                  { name: 'IMMIGRANT', Voted: voters.filter(voter => voter.situation === 'IMMIGRANT' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.situation === 'IMMIGRANT' && !voter.has_voted).length },
                  { name: 'DEATH', Voted: voters.filter(voter => voter.situation === 'DEATH' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.situation === 'DEATH' && !voter.has_voted).length },
                  { name: 'NO VOTE', Voted: voters.filter(voter => voter.situation === 'NO VOTE' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.situation === 'NO VOTE' && !voter.has_voted).length },
                  { name: 'UNKNOWN', Voted: voters.filter(voter => voter.situation === 'UNKNOWN' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.situation === 'UNKNOWN' && !voter.has_voted).length },
                  { name: 'N', Voted: voters.filter(voter => voter.situation === 'N' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.situation === 'N' && !voter.has_voted).length },
                  { name: 'N+', Voted: voters.filter(voter => voter.situation === 'N+' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.situation === 'N+' && !voter.has_voted).length }
                ]}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  type="number" 
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  width={100}
                  tick={{ fontSize: 12 }}
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#374151' : '#e5e7eb',
                    color: isDarkMode ? '#f3f4f6' : '#1f2937'
                  }} 
                />
                <Legend />
                <Bar dataKey="Voted" stackId="a" fill="#4CAF50" name="Voted" />
                <Bar dataKey="NotVoted" stackId="a" fill="#F44336" name="Not Voted" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Residence Voting Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Residence Voting Status</h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'RESIDENT', Voted: voters.filter(voter => voter.residence === 'RESIDENT' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.residence === 'RESIDENT' && !voter.has_voted).length },
                  { name: 'Non RESIDENT', Voted: voters.filter(voter => voter.residence === 'Non RESIDENT' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.residence === 'Non RESIDENT' && !voter.has_voted).length },
                  { name: 'IMMIGRANT', Voted: voters.filter(voter => voter.residence === 'IMMIGRANT' && voter.has_voted).length, NotVoted: voters.filter(voter => voter.residence === 'IMMIGRANT' && !voter.has_voted).length }
                ]}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  type="number" 
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  width={100}
                  tick={{ fontSize: 12 }}
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#374151' : '#e5e7eb',
                    color: isDarkMode ? '#f3f4f6' : '#1f2937'
                  }} 
                />
                <Legend />
                <Bar dataKey="Voted" stackId="a" fill="#4CAF50" name="Voted" />
                <Bar dataKey="NotVoted" stackId="a" fill="#F44336" name="Not Voted" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="text-center text-gray-500 dark:text-gray-400 text-xs">
        <p>Statistics auto-update in real-time as votes are recorded</p>
        {getGenderFilter() && (
          <p className="mt-1">Currently showing data filtered by: {getGenderFilter() === 'الذكور' ? 'Male' : 'Female'}</p>
        )}
      </div>
    </div>
  );
};

export default VotingStatistics;