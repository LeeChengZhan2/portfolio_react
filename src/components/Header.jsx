import React from "react";

function Header(){
    return(
        <header className="bg-gray-800 text-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold">
            <a href="/">Logo</a>
          </div>
          <nav>
            <ul className="flex space-x-4">
              <li>
                <a href="/" className="hover:text-gray-400">Home</a>
              </li>
              <li>
                <a href="/about" className="hover:text-gray-400">About</a>
              </li>
              <li>
                <a href="/services" className="hover:text-gray-400">Services</a>
              </li>
              <li>
                <a href="/contact" className="hover:text-gray-400">Contact</a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
    );
  };
  
  export default Header;