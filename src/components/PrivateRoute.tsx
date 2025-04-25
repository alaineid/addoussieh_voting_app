import React, { ReactNode, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, UserProfile } from '../store/authStore';

type PermissionCheck = (profile: UserProfile) => boolean;

interface PrivateRouteProps {
  children: ReactNode;
  permissionCheck?: PermissionCheck;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, permissionCheck }) => {
  const { session, profile, loading } = useAuthStore();
  const location = useLocation();
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [profileTimeout, setProfileTimeout] = useState(false);
  
  // Add timeout for component-level loading
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn("PrivateRoute loading timed out");
        setLoadingTimeout(true);
      }, 8000); // 8 seconds timeout
      
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Add timeout for profile loading if session exists
  useEffect(() => {
    if (session && !profile && !profileTimeout) {
      const timer = setTimeout(() => {
        console.warn("Profile loading timed out, continuing with session only");
        setProfileTimeout(true);
      }, 5000); // 5 seconds timeout for profile
      
      return () => clearTimeout(timer);
    }
  }, [session, profile, profileTimeout]);

  // If we're still waiting for authentication but haven't timed out yet
  if (loading && !loadingTimeout) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated or timed out
  if (!session || loadingTimeout) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If session exists but we're still waiting for profile data
  if (permissionCheck && !profile && !profileTimeout) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent"></div>
          <p className="mt-4">Loading user profile...</p>
        </div>
      </div>
    );
  }

  // CRITICAL CHANGE: If profile timed out but we have a session,
  // allow access to the protected route even without permissions check
  // This prevents unnecessary redirects to unauthorized page when profile loading is slow
  if (profileTimeout && session && permissionCheck) {
    console.log("Allowing access with session only (profile timed out)");
    return <>{children}</>;
  }

  // Check permissions if required and profile is available
  if (permissionCheck && profile) {
    if (!permissionCheck(profile)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Allow access
  return <>{children}</>;
};

export default PrivateRoute;