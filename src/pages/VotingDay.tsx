import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';

// Define interfaces for voting day data
interface VotingDayData {
  id: string;
  total_eligible_voters: number;
  votes_cast: number;
  last_updated: string;
}

// Toast notification component for success/error messages
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

const VotingDay: React.FC = () => {
  const { profile, session } = useAuthStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [votingDayData, setVotingDayData] = useState<VotingDayData | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editData, setEditData] = useState<Partial<VotingDayData>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    visible: boolean;
  } | null>(null);

  // Calculate derived values
  const turnoutRate = votingDayData && votingDayData.total_eligible_voters > 0 
    ? Math.round((votingDayData.votes_cast / votingDayData.total_eligible_voters) * 100) 
    : 0;

  // Check if user has edit permission
  const canEdit = profile?.voting_day_access === 'edit';

  useEffect(() => {
    // Check permission first
    if (profile?.voting_day_access === 'none') {
      setError('You do not have permission to view this page.');
      setLoading(false);
      return;
    }

    // Initialize page data
    const fetchVotingDayData = async () => {
      try {
        // Fetch voting day data from the database
        const { data, error } = await supabase
          .from('voting_day')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (error) {
          throw error;
        }

        if (data) {
          setVotingDayData(data);
          setEditData({
            total_eligible_voters: data.total_eligible_voters,
            votes_cast: data.votes_cast
          });
        } else {
          // If no data exists yet, create initial record
          const initialData = {
            total_eligible_voters: 0,
            votes_cast: 0,
            last_updated: new Date().toISOString()
          };
          
          const { data: newData, error: createError } = await supabase
            .from('voting_day')
            .insert([initialData])
            .select()
            .single();
            
          if (createError) throw createError;
          
          setVotingDayData(newData);
          setEditData({
            total_eligible_voters: newData.total_eligible_voters,
            votes_cast: newData.votes_cast
          });
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading voting day data:', err);
        setError(err.message || 'Failed to load voting day data');
        setLoading(false);
      }
    };

    fetchVotingDayData();
  }, [profile]);

  // Handle edit form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Ensure we're only accepting positive numbers
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 0) return;
    
    setEditData({
      ...editData,
      [name]: numValue
    });
  };

  // Start editing mode
  const handleEditClick = () => {
    if (!canEdit) return;
    
    setIsEditing(true);
    // Initialize edit form with current data
    if (votingDayData) {
      setEditData({
        total_eligible_voters: votingDayData.total_eligible_voters,
        votes_cast: votingDayData.votes_cast
      });
    }
  };

  // Cancel editing and revert changes
  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset edit data to current values
    if (votingDayData) {
      setEditData({
        total_eligible_voters: votingDayData.total_eligible_voters,
        votes_cast: votingDayData.votes_cast
      });
    }
  };

  // Save changes to database
  const handleSaveChanges = async () => {
    if (!votingDayData || !canEdit) return;
    
    setIsSaving(true);
    
    try {
      // Validate data
      if (editData.votes_cast! > editData.total_eligible_voters!) {
        throw new Error("Votes cast cannot exceed total eligible voters");
      }
      
      const updates = {
        ...editData,
        last_updated: new Date().toISOString()
      };
      
      // Update the database
      const { data, error } = await supabase
        .from('voting_day')
        .update(updates)
        .eq('id', votingDayData.id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update local state with saved data
      setVotingDayData(data);
      setIsEditing(false);
      
      // Show success message
      setToast({
        message: 'Changes saved successfully',
        type: 'success',
        visible: true
      });
    } catch (err: any) {
      console.error('Error saving voting day data:', err);
      // Show error message
      setToast({
        message: err.message || 'Failed to save changes',
        type: 'error',
        visible: true
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Close toast notification
  const handleCloseToast = () => {
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
        <div className="border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          <div className="animate-pulse p-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3 mb-6"></div>
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-md mb-6"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-1/2 mb-4"></div>
          </div>
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

  // Main content
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
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold mb-2 text-blue-800 dark:text-blue-300">Voting Day</h2>
          <p className="text-gray-600 dark:text-gray-400">Monitor and manage election day activities</p>
        </div>
        
        {/* Edit button - only show if user has edit permission */}
        {canEdit && !isEditing && (
          <button
            onClick={handleEditClick}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            Edit Data
          </button>
        )}
        
        {/* Save/Cancel buttons - only show when editing */}
        {isEditing && (
          <div className="flex space-x-3">
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-sm transition-colors flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Stats Cards */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-blue-100 dark:border-blue-900">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-3 mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="w-full">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white">Total Eligible Voters</h3>
              {isEditing ? (
                <div className="mt-2">
                  <input
                    type="number"
                    name="total_eligible_voters"
                    value={editData.total_eligible_voters}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>
              ) : (
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-300">
                  {votingDayData?.total_eligible_voters || 0}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-green-100 dark:border-green-900">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900 p-3 mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="w-full">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white">Votes Cast</h3>
              {isEditing ? (
                <div className="mt-2">
                  <input
                    type="number"
                    name="votes_cast"
                    value={editData.votes_cast}
                    onChange={handleInputChange}
                    min="0"
                    max={editData.total_eligible_voters}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  {editData.votes_cast! > editData.total_eligible_voters! && (
                    <p className="text-xs text-red-500 mt-1">Votes cannot exceed eligible voters</p>
                  )}
                </div>
              ) : (
                <p className="text-3xl font-bold text-green-600 dark:text-green-300">
                  {votingDayData?.votes_cast || 0}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-blue-100 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">Turnout Rate</h3>
          <p className="text-3xl font-bold text-gray-800 dark:text-white mb-2">{turnoutRate}%</p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
            <div 
              className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full" 
              style={{ width: `${turnoutRate}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {votingDayData?.votes_cast || 0} of {votingDayData?.total_eligible_voters || 0} voters
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-blue-100 dark:border-gray-700 mb-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Recent Activity</h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No recent voting activity to display</p>
          <p className="mt-2 text-sm">Activity will appear here as voters cast their ballots</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-blue-100 dark:border-gray-700">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Voting Progress</h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>Voting data will be displayed here</p>
          {votingDayData?.last_updated && (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Last updated: {new Date(votingDayData.last_updated).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VotingDay;