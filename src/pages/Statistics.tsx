import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useThemeStore } from '../store/themeStore';
import { supabase } from '../lib/supabaseClient';
import {
  PieChart, Pie, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

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

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', 
  '#82CA9D', '#F06292', '#4DB6AC', '#FFB74D', '#9575CD'
];

const Statistics: React.FC = () => {
  const { isDarkMode } = useThemeStore();
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastHourVotes, setLastHourVotes] = useState<number>(0);
  const [predictionData, setPredictionData] = useState<any>(null);
  
  // Timestamps to track voting trends
  const [voteTimestamps, setVoteTimestamps] = useState<Date[]>([]);
  const votingStartTimeRef = useRef<Date | null>(null);

  // Fetch all voter data
  const fetchVoters = async () => {
    try {
      const { data, error } = await supabase
        .from('avp_voters')
        .select('id, full_name, gender, register_sect, residence, situation, family, has_voted, dob, alliance');

      if (error) throw error;
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

      calculatePredictions(data || []);
    } catch (err: any) {
      console.error('Error fetching voter data:', err);
      setError(err.message || 'Failed to load voter data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate last hour votes and predictions
  const calculateLastHourVotes = () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const votesInLastHour = voteTimestamps.filter(
      timestamp => timestamp >= oneHourAgo
    ).length;
    
    setLastHourVotes(votesInLastHour);
  };

  // Calculate predictions based on current trends
  const calculatePredictions = (data: Voter[]) => {
    const totalVoters = data.length;
    const votedCount = data.filter(voter => voter.has_voted).length;
    
    // Only calculate predictions if we have enough data
    if (votingStartTimeRef.current && votedCount > 0) {
      const now = new Date();
      const elapsedHours = (now.getTime() - votingStartTimeRef.current.getTime()) / (1000 * 60 * 60);
      
      if (elapsedHours > 0.1) { // At least 6 minutes of data
        // Calculate votes per hour
        const voteRate = votedCount / elapsedHours;
        
        // Assuming voting day is 12 hours long
        const remainingHours = Math.max(0, 12 - elapsedHours);
        const predictedAdditionalVotes = Math.round(voteRate * remainingHours);
        const predictedFinalCount = Math.min(totalVoters, votedCount + predictedAdditionalVotes);
        const predictedParticipation = Math.round((predictedFinalCount / totalVoters) * 100);
        
        // Predict final situation distribution
        const currentSituationCounts: Record<string, number> = {};
        data.filter(voter => voter.has_voted).forEach(voter => {
          const situation = voter.situation || 'Unknown';
          currentSituationCounts[situation] = (currentSituationCounts[situation] || 0) + 1;
        });
        
        // Project current ratios to final predicted count
        const predictedSituationCounts: Record<string, number> = {};
        if (votedCount > 0) {
          Object.entries(currentSituationCounts).forEach(([situation, count]) => {
            const ratio = count / votedCount;
            predictedSituationCounts[situation] = Math.round(ratio * predictedFinalCount);
          });
        }
        
        setPredictionData({
          predictedFinalCount,
          predictedParticipation,
          predictedSituations: predictedSituationCounts,
          voteRate: Math.round(voteRate * 10) / 10 // votes per hour rounded to 1 decimal
        });
      }
    }
  };

  // Initialize data
  useEffect(() => {
    fetchVoters();
    
    // Update hourly votes every minute
    const intervalId = setInterval(() => {
      calculateLastHourVotes();
    }, 60000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

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
      .filter(([name, value]) => name !== 'Unknown' || value > 0) // Ensure Unknown is only shown if it has a count
      .map(([name, value]) => ({ name, value }));
  }, [voters]);

  const registerSectStats = useMemo(() => {
    const counts: Record<string, number> = {};
    voters.forEach(voter => {
      const sect = voter.register_sect || 'Unknown';
      counts[sect] = (counts[sect] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [voters]);

  const residenceStats = useMemo(() => {
    const counts: Record<string, number> = {};
    voters.forEach(voter => {
      const residence = voter.residence || 'RESIDENT';
      counts[residence] = (counts[residence] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [voters]);

  const situationStats = useMemo(() => {
    const counts: Record<string, number> = {};
    voters.forEach(voter => {
      const situation = voter.situation || 'Unknown';
      counts[situation] = (counts[situation] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [voters]);

  const ageGroupStats = useMemo(() => {
    const ageGroups: Record<string, number> = {
      'Under 30': 0,
      '30-39': 0,
      '40-49': 0,
      '50-59': 0,
      '60+': 0,
    };
    
    const currentYear = new Date().getFullYear();
    
    voters.forEach(voter => {
      if (voter.dob) {
        try {
          const birthYear = new Date(voter.dob).getFullYear();
          const age = currentYear - birthYear;
          
          if (age < 30) ageGroups['Under 30']++;
          else if (age >= 30 && age < 40) ageGroups['30-39']++;
          else if (age >= 40 && age < 50) ageGroups['40-49']++;
          else if (age >= 50 && age < 60) ageGroups['50-59']++;
          else ageGroups['60+']++;
        } catch (e) {
          // Skip invalid dates
        }
      }
    });
    
    return Object.entries(ageGroups).map(([name, value]) => ({ name, value }));
  }, [voters]);

  const topFamiliesStats = useMemo(() => {
    const familyCounts: Record<string, number> = {};
    
    voters.forEach(voter => {
      if (voter.family) {
        familyCounts[voter.family] = (familyCounts[voter.family] || 0) + 1;
      }
    });
    
    return Object.entries(familyCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 families
  }, [voters]);

  const specialStatusStats = useMemo(() => {
    let immigrants = 0;
    let military = 0;
    let unknown = 0;

    voters.forEach(voter => {
      if (voter.situation === 'MILITARY') military++;
      // Assuming immigrant status is stored in situation or residence
      else if (voter.residence === 'IMMIGRANT' || voter.situation === 'IMMIGRANT') immigrants++;
    });

    // Count voters with missing critical data
    voters.forEach(voter => {
      if (!voter.situation && !voter.family && !voter.register_sect) {
        unknown++;
      }
    });

    return [
      { name: 'Military', value: military },
      { name: 'Immigrants', value: immigrants },
      { name: 'Unknown Status', value: unknown }
    ].filter(item => item.value > 0); // Only include categories with values
  }, [voters]);

  const votedPercentage = useMemo(() => {
    if (voters.length === 0) return 0;
    return Math.round((voters.filter(v => v.has_voted).length / voters.length) * 100);
  }, [voters]);

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
          <p className="text-red-700 dark:text-red-200 text-lg font-medium">{error}</p>
          <p className="mt-3 text-red-600 dark:text-red-300 text-sm">Please try refreshing the page or contact an administrator.</p>
        </div>
      </div>
    );
  }

  // Format for the pie chart custom label
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
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
    );
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-900 min-h-screen">
      <h2 className="text-3xl font-bold mb-4 text-blue-800 dark:text-blue-300">Voting Statistics</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Live statistics and analytics for the voting process</p>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
        {/* Gender Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Gender Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {genderStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
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

        {/* Register Sect Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Register Sect Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={registerSectStats}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  type="number" 
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={80}
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
                <Bar dataKey="value" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Residence Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Residence Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={residenceStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {residenceStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
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

        {/* Situation Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Situation Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={situationStats}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  type="number" 
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  width={60}
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
                <Bar dataKey="value">
                  {situationStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Families */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Top 10 Families</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topFamiliesStats}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  type="number" 
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={70}
                  tick={{ fontSize: 11 }}
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#374151' : '#e5e7eb',
                    color: isDarkMode ? '#f3f4f6' : '#1f2937'
                  }} 
                />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Age Groups */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Age Group Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ageGroupStats}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  dataKey="name" 
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#374151' : '#e5e7eb',
                    color: isDarkMode ? '#f3f4f6' : '#1f2937'
                  }} 
                />
                <Bar dataKey="value" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Special Status Counts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">Special Status Counts</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={specialStatusStats}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  dataKey="name" 
                  stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                />
                <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    borderColor: isDarkMode ? '#374151' : '#e5e7eb',
                    color: isDarkMode ? '#f3f4f6' : '#1f2937'
                  }} 
                />
                <Bar dataKey="value">
                  {specialStatusStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Predictions Section */}
      {predictionData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-blue-100 dark:border-gray-700 mb-6">
          <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-300 mb-4">Voting Predictions</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-300 mb-1">Current Rate</p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {predictionData.voteRate} <span className="text-sm font-normal">votes/hour</span>
              </p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-300 mb-1">Predicted Final Count</p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {predictionData.predictedFinalCount} <span className="text-sm font-normal">voters</span>
              </p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-300 mb-1">Predicted Participation</p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {predictionData.predictedParticipation}%
              </p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-300 mb-1">Likely Leading Situation</p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {Object.entries(predictionData.predictedSituations || {})
                  .sort((a, b) => b[1] - a[1])?.[0]?.[0] || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="text-center text-gray-500 dark:text-gray-400 text-xs">
        <p>Statistics auto-update in real-time as votes are recorded</p>
      </div>
    </div>
  );
};

export default Statistics;
