import React, { useState, useEffect } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, UserProfile } from './store/authStore';
import { supabase } from './lib/supabaseClient';

import VoterList from './pages/VoterList';
import FamilySituation from './pages/FamilySituation';
import Statistics from './pages/Statistics';
import About from './pages/About';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import PrivateRoute from './components/PrivateRoute';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminPage from './pages/AdminPage';

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
          {canViewVoters && (
            <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Voter List</NavLink>
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
              <div className="text-gray-700 font-medium hidden sm:block">
                <span className="mr-2">Hello,</span>
                <span>{userName}</span>
              </div>
              {isAdmin && (
                <button
                  onClick={handleAdminClick}
                  className="text-gray-600 hover:text-red-700 transition duration-150 ease-in-out"
                  title="Admin Settings"
                  aria-label="Admin Settings"
                >
                  <i className="fas fa-user-cog fa-lg"></i>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="logout-btn px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition duration-150 ease-in-out"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => { navigate('/login'); setIsMenuOpen(false); }}
              className="login-btn px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-150 ease-in-out"
            >
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

const hasVoterAccess = (profile: UserProfile | null) => !!profile && profile.voters_list_access !== 'none';
const hasFamilyAccess = (profile: UserProfile | null) => !!profile && profile.family_situation_access !== 'none';
const hasStatsAccess = (profile: UserProfile | null) => !!profile && profile.statistics_access === 'view';
const isAdminUser = (profile: UserProfile | null) => !!profile && profile.role === 'admin';

export default function App() {
  const location = useLocation();
  const { loading: authLoading, profile } = useAuthStore();

  const isAuthPage = ['/login', '/forgot-password', '/reset-password'].includes(location.pathname);
  const hideNav = isAuthPage;

  if (authLoading && !isAuthPage) {
      return <div className="flex justify-center items-center h-screen">Loading Application...</div>;
  }

  const mainBaseClasses = 'flex-grow';
  const mainPageClasses = 'p-4 md:p-8 max-w-7xl mx-auto w-full';
  const mainAuthClasses = 'bg-gray-50';

  return (
    <div className="flex flex-col min-h-screen">
      <header className="shadow-md">
        <Banner />
        {!hideNav && !authLoading && <Nav />}
      </header>
      <main className={`${mainBaseClasses} ${isAuthPage ? mainAuthClasses : mainPageClasses}`}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
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
            path="/admin"
            element={
              <PrivateRoute permissionCheck={() => isAdminUser(profile)}>
                <AdminPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/about"
            element={
              <PrivateRoute>
                <About />
              </PrivateRoute>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
