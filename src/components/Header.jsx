import React from "react";

function Header(){
    return(
      <header className="bg-white p-4 shadow-md">
      <nav className="flex justify-center space-x-8">
        <a href="#home" className="nav-link">Home</a>
        <a href="#about" className="nav-link">About</a>
        <a href="#portfolio" className="nav-link">Portfolio</a>
        <a href="#contact" className="nav-link">Contact</a>
      </nav>
    </header>
    );
  };
  
  export default Header;