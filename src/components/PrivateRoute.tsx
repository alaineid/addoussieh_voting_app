import React, { ReactNode } from 'react';
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

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permissionCheck) {
    if (!profile) {
        console.warn("Profile not available for permission check.");
        return <Navigate to="/unauthorized" replace />;
    }
    if (!permissionCheck(profile)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

export default PrivateRoute;