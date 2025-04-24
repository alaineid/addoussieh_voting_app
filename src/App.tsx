import React, { useState, useEffect } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, UserProfile } from './store/authStore'; // Adjust path
import { supabase } from './lib/supabaseClient'; // Adjust path

import VoterList from './pages/VoterList';
import FamilySituation from './pages/FamilySituation';
import Statistics from './pages/Statistics';
import About from './pages/About';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized'; // Import Unauthorized
import PrivateRoute from './components/PrivateRoute'; // Import PrivateRoute
import ForgotPassword from './pages/ForgotPassword'; // Import ForgotPassword
import ResetPassword from './pages/ResetPassword'; // Import ResetPassword

const Banner = () => (
  <div className="banner-container">
    <div className="top-banner">
      <div className="logo-area">
        <div className="logo">
          <div className="logo-text">AVP</div>
        </div>
      </div>
      <div className="title-area">
        <h1 className="portal-title">Addoussieh Voting Portal</h1>
        <p className="portal-subtitle">Comprehensive voter management and analysis system</p>
      </div>
    </div>
  </div>
);

const Nav = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { profile, session } = useAuthStore();
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = async () => {
    setIsMenuOpen(false); // Close menu on logout
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
    } else {
      // Auth listener will clear the store state
      navigate('/login'); // Redirect to login after logout
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const burgerMenu = document.getElementById('burger-menu');
      const navLinksContainer = document.querySelector('.nav-links-container');

      if (
        burgerMenu &&
        !burgerMenu.contains(event.target as Node) &&
        navLinksContainer &&
        !navLinksContainer.contains(event.target as Node) &&
        isMenuOpen
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Permission checks based on profile
  const canViewVoters = profile?.voters_list_access !== 'none';
  const canViewFamily = profile?.family_situation_access !== 'none';
  const canViewStats = profile?.statistics_access === 'view';

  return (
    <div className="nav-menu">
      <button id="burger-menu" className={`md:hidden ${isMenuOpen ? 'active' : ''}`} onClick={toggleMenu}>
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div className={`nav-links-container ${isMenuOpen ? 'active' : ''}`}>
        <div className="menu-items">
          {/* Conditionally render links based on permissions */}
          {canViewVoters && (
            <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Voter List</NavLink>
          )}
          {canViewFamily && (
            <NavLink to="/family-situation" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Family Situation</NavLink>
          )}
          {canViewStats && (
            <NavLink to="/statistics" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Statistics</NavLink>
          )}
          {/* About tab is always visible in the menu */}
          <NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>About</NavLink>
        </div>
        <div className="user-actions">
          {/* Language selector (optional) */}
          {/* <div className="language-selector">...</div> */}

          {session ? (
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          ) : (
            <button onClick={() => { navigate('/login'); setIsMenuOpen(false); }} className="login-btn">
              Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Footer = () => (
  <footer className="bg-gray-800 text-white py-6">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row justify-between items-center">
        <div className="mb-4 md:mb-0">
          <p className="text-sm">&copy; {new Date().getFullYear()} Addoussieh Voting Portal. All rights reserved.</p>
        </div>
        <div className="flex space-x-4">
          <a href="#" aria-label="Facebook" className="text-gray-300 hover:text-white transition duration-150 ease-in-out">
            <i className="fab fa-facebook"></i>
          </a>
          <a href="#" aria-label="Twitter" className="text-gray-300 hover:text-white transition duration-150 ease-in-out">
            <i className="fab fa-twitter"></i>
          </a>
          <a href="#" aria-label="Instagram" className="text-gray-300 hover:text-white transition duration-150 ease-in-out">
            <i className="fab fa-instagram"></i>
          </a>
        </div>
      </div>
    </div>
  </footer>
);

// Permission check functions
const hasVoterAccess = (profile: UserProfile | null) => !!profile && profile.voters_list_access !== 'none';
const hasFamilyAccess = (profile: UserProfile | null) => !!profile && profile.family_situation_access !== 'none';
const hasStatsAccess = (profile: UserProfile | null) => !!profile && profile.statistics_access === 'view';

export default function App() {
  const location = useLocation();
  const { loading: authLoading, profile } = useAuthStore(); // Get loading state and profile

  // Determine if the Nav should be hidden (Login, ForgotPassword, ResetPassword pages)
  const isAuthPage = ['/login', '/forgot-password', '/reset-password'].includes(location.pathname);
  const hideNav = isAuthPage; // Only hide Nav on auth pages

  // Show a global loading indicator if auth is still loading and not on an auth page
  if (authLoading && !isAuthPage) {
      return <div className="flex justify-center items-center h-screen">Loading Application...</div>;
  }

  // Define base classes for main
  const mainBaseClasses = 'flex-grow';
  // Define classes for non-auth pages (with padding)
  const mainPageClasses = 'p-4 md:p-8 max-w-7xl mx-auto w-full';
  // Define classes for the auth pages (full width, gray background)
  const mainAuthClasses = 'bg-gray-50';

  return (
    <div className="flex flex-col min-h-screen">
      {/* Always show Header (Banner + Nav) */}
      <header className="shadow-md">
        <Banner />
        {/* Only hide Nav on auth pages and when auth is loading */}
        {!hideNav && !authLoading && <Nav />}
      </header>

      {/* Apply classes conditionally based on whether it's an auth page */}
      <main className={`${mainBaseClasses} ${isAuthPage ? mainAuthClasses : mainPageClasses}`}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <PrivateRoute permissionCheck={() => hasVoterAccess(profile)}>
                <VoterList />
              </PrivateRoute>
            }
          />
          <Route
            path="/family-situation"
            element={
              <PrivateRoute permissionCheck={() => hasFamilyAccess(profile)}>
                <FamilySituation />
              </PrivateRoute>
            }
          />
          <Route
            path="/statistics"
            element={
              <PrivateRoute permissionCheck={() => hasStatsAccess(profile)}>
                <Statistics />
              </PrivateRoute>
            }
          />
          <Route
            path="/about"
            element={
              <PrivateRoute> {/* No specific permission needed, just login */}
                <About />
              </PrivateRoute>
            }
          />

          {/* Add a catch-all or redirect for unknown routes if needed */}
          {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
        </Routes>
      </main>

      {/* Always show Footer */}
      <Footer />
    </div>
  );
}
