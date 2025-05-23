import React, { useState, useEffect } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, UserProfile } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { supabase } from './lib/supabaseClient';

import RegisteredVoters from './pages/RegisteredVoters';
import FamilySituation from './pages/FamilySituation';
import Statistics from './pages/Statistics';
import About from './pages/About';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import PrivateRoute from './components/PrivateRoute';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminPage from './pages/AdminPage';
import VotingDay from './pages/VotingDay';
import VotingStatistics from './pages/VotingStatistics';
import Candidates from './pages/Candidates';
import VoteCounting from './pages/VoteCounting'; 
import LiveScores from './pages/LiveScores'; // Import the new LiveScores component
import BallotAnalysis from './pages/BallotAnalysis';
import RootRedirector from './components/RootRedirector'; // Import the new component

const Banner = () => {
  // Import images dynamically
  const logoPath = new URL('./assets/images/logo_cropped.png', import.meta.url).href;
  const flagPath = new URL('./assets/Flag_of_Lebanon.svg', import.meta.url).href;
  
  return (
    <div className="banner-container">
      <div className="top-banner flex justify-between items-center py-4 px-8">
        <div className="flag-container">
          <img src={flagPath} alt="Lebanese Flag" className="h-14" />
        </div>
        <div className="arabic-title-container text-center ali">
          <h1 className="text-white text-3xl">نظام إدارة التصويت</h1>
        </div>
        <div className="logo-container">
          <img src={logoPath} alt="Addoussieh Voting Portal Logo" className="h-20" />
        </div>
      </div>
    </div>
  );
};

const Nav = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { profile, session } = useAuthStore();
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin';
  const userName = profile?.name || profile?.full_name || session?.user?.email?.split('@')[0] || 'User';

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = async () => {
    setIsMenuOpen(false);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
    } else {
      navigate('/login');
    }
  };

  const handleAdminClick = () => {
    setIsMenuOpen(false);
    navigate('/admin');
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

  const canViewVoters = profile?.registered_voters_access !== 'none';
  const canViewFamily = profile?.family_situation_access !== 'none';
  const canViewStats = profile?.statistics_access === 'view';
  const canViewVotingDay = profile?.voting_day_access !== 'none';
  const canViewVotingStatistics = profile?.voting_statistics_access === 'view';
  const canVoteCounting = profile?.vote_counting === 'count female votes' || profile?.vote_counting === 'count male votes';
  const canViewLiveScores = profile?.live_score_access === 'view';
  const canAccessCandidates = !!profile && profile.candidate_access !== 'none';

  return (
    <div className="nav-menu">
      <button id="burger-menu" className={`md:hidden ${isMenuOpen ? 'active' : ''}`} onClick={toggleMenu}>
        <span></span>
        <span></span>
        <span></span>
      </button>
      
      {/* Dark Mode Toggle Button - Mobile (outside menu) */}
      <button
        onClick={toggleDarkMode}
        className="md:hidden text-gray-600 dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-300 transition duration-150 ease-in-out absolute right-16"
        title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'} fa-lg`}></i>
      </button>
      
      <div className={`nav-links-container ${isMenuOpen ? 'active' : ''}`}>
        <div className="menu-items">
          {canAccessCandidates && (
            <NavLink to="/candidates" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Candidates</NavLink>
          )}          
          {canViewVotingDay && (
            <NavLink to="/voting-day" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Voting Day</NavLink>
          )}
          {canVoteCounting && (
            <NavLink to="/vote-counting" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Vote Counting</NavLink>
          )}
          {canViewLiveScores && (
            <NavLink to="/live-scores" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Live Scores</NavLink>
          )}
          {isAdmin && (
            <NavLink to="/ballot-analysis" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Ballot Analysis</NavLink>
          )}
          {canViewVotingStatistics && (
            <NavLink to="/voting-statistics" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Voting Statistics</NavLink>
          )}  
          {canViewVoters && (
            <NavLink to="/registered-voters" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Registered Voters</NavLink>
          )}
          {canViewFamily && (
            <NavLink to="/family-situation" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Family Situation</NavLink>
          )}
          {canViewStats && (
            <NavLink to="/statistics" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Statistics</NavLink>
          )}
          <NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>About</NavLink>
        </div>
        <div className="user-actions flex items-center gap-4">
          {session ? (
            <>
              <div className="text-gray-700 dark:text-gray-300 font-medium hidden sm:block">
                <span className="mr-2">Hello,</span>
                <span>{userName}</span>
              </div>
              {isAdmin && (
                <button
                  onClick={handleAdminClick}
                  className="text-gray-600 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-400"
                  title="Admin Settings"
                >
                  <i className="fas fa-user-cog fa-lg"></i>
                </button>
              )}
              <button
                onClick={toggleDarkMode}
                className="hidden md:block text-gray-600 dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-300 transition duration-150 ease-in-out px-2 py-2 rounded"
                title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'} fa-lg`}></i>
              </button>
              <button
                onClick={handleLogout}
                className="logout-btn text-gray-600 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-400 px-2 py-2 rounded"
                title="Logout"
                aria-label="Logout"
              >
                <i className="fas fa-sign-out-alt fa-lg"></i>
              </button>
            </>
          ) : (
            <button
              onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
              className="login-btn px-4 py-2 bg-blue-600 text-white dark:bg-blue-700 dark:hover:bg-blue-800 rounded hover:bg-blue-700"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Footer = () => {
  const { isDarkMode } = useThemeStore();
  
  return (
    <footer className="bg-gray-800 dark:bg-gray-900 text-white py-6 border-t border-gray-700 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-gray-300 dark:text-gray-200">&copy; {new Date().getFullYear()} Addoussieh Voting Portal. All rights reserved.</p>
          </div>
          <div className="flex space-x-4">
            <a href="https://www.facebook.com/Adoussieh" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-gray-300 hover:text-white dark:text-blue-300 dark:hover:text-blue-200 transition duration-150 ease-in-out">
              <i className="fab fa-facebook fa-lg"></i>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

const hasVoterAccess = (profile: UserProfile | null) => !!profile && profile.registered_voters_access !== 'none';
const hasFamilyAccess = (profile: UserProfile | null) => !!profile && profile.family_situation_access !== 'none';
const hasStatsAccess = (profile: UserProfile | null) => !!profile && profile.statistics_access === 'view';
const hasVotingDayAccess = (profile: UserProfile | null) => !!profile && profile.voting_day_access !== 'none';
const hasVotingStatisticsAccess = (profile: UserProfile | null) => !!profile && profile.voting_statistics_access === 'view';
const isAdminUser = (profile: UserProfile | null) => !!profile && profile.role === 'admin';
const hasVoteCountingAccess = (profile: UserProfile | null) => !!profile && (profile.vote_counting === 'count female votes' || profile.vote_counting === 'count male votes');
const hasLiveScoreAccess = (profile: UserProfile | null) => !!profile && profile.live_score_access === 'view';
const hasCandidateAccess = (profile: UserProfile | null) => !!profile && profile.candidate_access !== 'none';

export default function App() {
  const location = useLocation();
  const { loading: authLoading, profile, session } = useAuthStore(); // Added session
  const { isDarkMode } = useThemeStore();
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const navigate = useNavigate();

  const isAuthPage = ['/login', '/forgot-password', '/reset-password'].includes(location.pathname);
  const hideNav = isAuthPage;

  // Apply dark mode to document body
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark', 'bg-gray-900', 'text-white');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark', 'bg-gray-900', 'text-white');
      document.body.classList.add('bg-white');
    }
    
    return () => {
      document.body.classList.remove('bg-white', 'bg-gray-900', 'text-white');
    };
  }, [isDarkMode]);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    if (authLoading) {
      const timeoutId = setTimeout(() => {
        console.warn("Loading timed out - redirecting to login");
        setHasTimedOut(true);
      }, 12000); // 12 seconds timeout

      return () => clearTimeout(timeoutId);
    }
  }, [authLoading]);

  // Redirect to login page if loading times out
  useEffect(() => {
    if (hasTimedOut && !isAuthPage) {
      navigate('/login');
    }
  }, [hasTimedOut, isAuthPage, navigate]);

  if (authLoading && !isAuthPage && !hasTimedOut) {
    return <div className="flex justify-center items-center h-screen dark:bg-gray-900 dark:text-white">Loading Application...</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Create a fixed position header - Now showing Banner for all pages, but Nav only for non-auth pages */}
      <header className={`fixed top-0 left-0 right-0 z-50 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'} shadow-lg`}>
        <Banner />
        {!isAuthPage && !authLoading && <Nav />}
      </header>
      
      {/* Main content with proper spacing */}
      <main className={`flex-grow w-full transition-colors duration-300 ${
        isAuthPage 
          ? isDarkMode ? 'bg-gray-800' : 'bg-gray-50'
          : isDarkMode ? 'bg-gray-900' : 'bg-white'
      }`}>
        {/* Add spacer div for all pages now that banner is always shown */}
        <div className="w-full h-[170px]"></div>
        
        <div className={isAuthPage ? '' : 'p-4 md:p-8'}>
          <Routes>
            {/* Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Root Path Logic */}
            {/* Use RootRedirector for '/' path, wrapped in a basic PrivateRoute (checks login) */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <RootRedirector />
                </PrivateRoute>
              }
            />

            {/* Specific Protected Routes */}
            {/* Voting Day route should be first as requested */}
            <Route
              path="/voting-day"
              element={
                <PrivateRoute permissionCheck={() => hasVotingDayAccess(profile)}>
                  <VotingDay />
                </PrivateRoute>
              }
            />
            
            {/* VotingStatistics route uses its own permission check */}
            <Route
              path="/voting-statistics"
              element={
                <PrivateRoute permissionCheck={() => hasVotingStatisticsAccess(profile)}>
                  <VotingStatistics />
                </PrivateRoute>
              }
            />
            
            {/* Define the actual component for '/registered-voters' */}
             <Route
              path="/registered-voters" // Changed path from "/"
              element={
                <PrivateRoute permissionCheck={() => hasVoterAccess(profile)}>
                  <RegisteredVoters />
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
              path="/admin"
              element={
                <PrivateRoute permissionCheck={() => isAdminUser(profile)}>
                  <AdminPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/candidates"
              element={
                <PrivateRoute permissionCheck={() => hasCandidateAccess(profile)}>
                  <Candidates />
                </PrivateRoute>
              }
            />
            <Route
              path="/vote-counting"
              element={
                <PrivateRoute permissionCheck={() => hasVoteCountingAccess(profile)}>
                  <VoteCounting />
                </PrivateRoute>
              }
            />
            <Route
              path="/live-scores"
              element={
                <PrivateRoute permissionCheck={() => hasLiveScoreAccess(profile)}>
                  <LiveScores />
                </PrivateRoute>
              }
            />
            <Route
              path="/ballot-analysis"
              element={
                <PrivateRoute permissionCheck={() => isAdminUser(profile)}>
                  <BallotAnalysis />
                </PrivateRoute>
              }
            />
            {/* About page is accessible to all logged-in users */}
            <Route
              path="/about"
              element={
                <PrivateRoute>
                  <About />
                </PrivateRoute>
              }
            />
            {/* Add a catch-all or redirect for unknown paths if needed */}
            {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
}
