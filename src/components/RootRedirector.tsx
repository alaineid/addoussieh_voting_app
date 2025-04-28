import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, UserProfile } from '../store/authStore';

const hasVoterAccess = (profile: UserProfile | null) => !!profile && profile.registered_voters_access !== 'none';
const hasFamilyAccess = (profile: UserProfile | null) => !!profile && profile.family_situation_access !== 'none';
const hasStatsAccess = (profile: UserProfile | null) => !!profile && profile.statistics_access === 'view';

const RootRedirector = () => {
  const navigate = useNavigate();
  const { profile, loading } = useAuthStore();

  useEffect(() => {
    // Wait until auth loading is finished and profile is available
    if (!loading && profile) {
      const canViewVoters = hasVoterAccess(profile);
      const canViewFamily = hasFamilyAccess(profile);
      const canViewStats = hasStatsAccess(profile);

      // Determine the target path based on permissions
      if (canViewVoters) {
        // Navigate to the dedicated route for voters
        console.log("Redirecting from RootRedirector to /registered-voters");
        navigate('/registered-voters', { replace: true });
      } else if (canViewFamily) {
        console.log("Redirecting from RootRedirector to /family-situation");
        navigate('/family-situation', { replace: true });
      } else if (canViewStats) {
        console.log("Redirecting from RootRedirector to /statistics");
        navigate('/statistics', { replace: true });
      } else {
        // Default to 'About' if no other main sections are accessible
        console.log("Redirecting from RootRedirector to /about");
        navigate('/about', { replace: true });
      }
    } else if (!loading && !profile) {
        // If not loading and no profile, redirect to login
        navigate('/login', { replace: true });
    }
    // Dependencies: run when auth state or profile changes
  }, [loading, profile, navigate]);

  // Render nothing or a loading indicator while redirecting
  return <div className="flex justify-center items-center h-screen dark:bg-gray-900 dark:text-white">Checking permissions...</div>;
};

export default RootRedirector;
