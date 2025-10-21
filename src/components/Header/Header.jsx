import React from 'react';
import './Header.css';

function Header() {
  return (
    <header className="navbar">
      <nav className="nav-container">
        <a href="#home" className="nav-link">Home</a>

        <div className="dropdown">
          <a href="#about" className="nav-link">About Me</a>
          <div className="dropdown-menu">
            <a href="#about-intro" className="submenu-link">intro</a>
            <a href="#about-work" className="submenu-link">work experience</a>
            <a href="#about-hobby" className="submenu-link">hobby</a>
            <a href="#about-travel" className="submenu-link">travel</a>
          </div>
        </div>

        <div className="dropdown">
          <a href="#portfolio" className="nav-link">Portfolio</a>
          <div className="dropdown-menu">
            <a href="#portfolio-school" className="submenu-link">school</a>
            <a href="#portfolio-investing" className="submenu-link">investing</a>
            <a href="#portfolio-photography" className="submenu-link">photography</a>
          </div>
        </div>

        <a href="#contact" className="nav-link">Contact</a>
      </nav>
    </header>
  );
}

export default Header;
