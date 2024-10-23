import React from "react";

function Header(){
    return(
        <header className="bg-gray-800 text-white">
        <div className="container mx-auto px-10 py-3 flex justify-between items-center">
          <div className="text-2xl font-bold">
            <a href="/">Logo</a>
          </div>
          <nav>
            <ul className="flex space-x-7">
              <li>
                <a href="/" className="nav-link">Home</a>
              </li>
              <li>
                <a href="/about" className="nav-link">About</a>
              </li>
              <li>
                <a href="/services" className="nav-link">Portfolio</a>
              </li>
              <li>
                <a href="/contact" className="nav-link">Contact</a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
    );
  };
  
  export default Header;