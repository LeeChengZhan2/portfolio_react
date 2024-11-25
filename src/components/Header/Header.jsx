import React from "react";
import './Header.css';

function Header(){
    return(
      <header className="navbar">
      <nav className="nav-container">
        <a href="#home" className="nav-link">Home</a>
        <a href="#about" className="nav-link">About</a>
        <a href="#portfolio" className="nav-link">Portfolio</a>
        <a href="#contact" className="nav-link">Contact</a>
      </nav>
    </header>
    );
  };
  
  export default Header;