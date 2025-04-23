import React, { useState, useEffect } from "react";
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';

import VoterList from './pages/VoterList';
import FamilySituation from './pages/FamilySituation';
import Statistics from './pages/Statistics';
import About from './pages/About';
import Login from './pages/Login';

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

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
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


  return (
    <div className="nav-menu">
      <button id="burger-menu" className={isMenuOpen ? 'active' : ''} onClick={toggleMenu}>
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div className={`nav-links-container ${isMenuOpen ? 'active' : ''}`}>
        <div className="menu-items">
          <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Voter List</NavLink>
          <NavLink to="/family-situation" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Family Situation</NavLink>
          <NavLink to="/statistics" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>Statistics</NavLink>
          <NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''} onClick={() => setIsMenuOpen(false)}>About</NavLink>
        </div>
        <div className="user-actions">
          <div className="language-selector">
            <span>EN</span>
            <span> | </span>
            <span>عربي</span>
          </div>
          <button className="login-btn">Login</button>
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

export default function App() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const hideNav = isLoginPage;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="shadow-md">
        <Banner />
        {!hideNav && <Nav />}
      </header>

      <main className={`flex-grow ${!hideNav ? 'p-4 md:p-8 max-w-7xl mx-auto w-full' : ''}`}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<VoterList />} />
          <Route path="/family-situation" element={<FamilySituation />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
