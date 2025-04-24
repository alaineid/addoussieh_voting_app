import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, UserProfile } from '../store/authStore'; // Adjust path as needed

type PermissionCheck = (profile: UserProfile) => boolean;

interface PrivateRouteProps {
  children: ReactNode;
  permissionCheck?: PermissionCheck; // Optional permission check function
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, permissionCheck }) => {
  const { session, profile, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    // Show a loading indicator while checking auth state
    // You can replace this with a more sophisticated loading spinner
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!session) {
    // User not logged in, redirect to login page
    // Pass the current location to redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permissionCheck) {
    if (!profile) {
        // Profile is still loading or doesn't exist, maybe show loading or redirect
        // Or, if profile is required for permission check, redirect to unauthorized
        console.warn("Profile not available for permission check.");
        // Depending on requirements, you might redirect to /unauthorized or show loading
        return <Navigate to="/unauthorized" replace />;
    }
    if (!permissionCheck(profile)) {
      // User logged in but doesn't have permission, redirect to unauthorized page
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // User is logged in and has permission (if check was provided)
  return <>{children}</>;
};

export default PrivateRoute;