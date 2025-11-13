import React from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import {
  UserCircleIcon,
  BriefcaseIcon,
  HeartIcon,
  GlobeAmericasIcon,
  AcademicCapIcon,
  ChartBarIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import './Header.css';

function Header() {
  return (
    <header className="navbar">
      <nav className="nav-container">
        <a href="#home" className="nav-link">Home</a>

        <div className="group relative inline-block text-left">
          <a href="#about" className="nav-link inline-flex items-center gap-1">
            About Me
            <ChevronDownIcon className="h-4 w-4 text-gray-500" aria-hidden="true" />
          </a>
          <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-60 origin-top rounded-xl bg-white/80 backdrop-blur-md shadow-xl ring-1 ring-black/5 p-2 z-50 invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-150">
            <div className="flex flex-col gap-1">
              <a href="#about-intro" className="group/item flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:bg-gray-50 focus:text-blue-600 focus:outline-none">
                <UserCircleIcon className="h-5 w-5 text-gray-400 group-hover/item:text-blue-600" aria-hidden="true" />
                <span>intro</span>
              </a>
              <a href="#about-work" className="group/item flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:bg-gray-50 focus:text-blue-600 focus:outline-none">
                <BriefcaseIcon className="h-5 w-5 text-gray-400 group-hover/item:text-blue-600" aria-hidden="true" />
                <span>work experience</span>
              </a>
              <a href="#about-hobby" className="group/item flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:bg-gray-50 focus:text-blue-600 focus:outline-none">
                <HeartIcon className="h-5 w-5 text-gray-400 group-hover/item:text-blue-600" aria-hidden="true" />
                <span>hobby</span>
              </a>
              <a href="#about-travel" className="group/item flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:bg-gray-50 focus:text-blue-600 focus:outline-none">
                <GlobeAmericasIcon className="h-5 w-5 text-gray-400 group-hover/item:text-blue-600" aria-hidden="true" />
                <span>travel</span>
              </a>
            </div>
          </div>
        </div>

        <div className="group relative inline-block text-left">
          <a href="#portfolio" className="nav-link inline-flex items-center gap-1">
            Portfolio
            <ChevronDownIcon className="h-4 w-4 text-gray-500" aria-hidden="true" />
          </a>
          <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-60 origin-top rounded-xl bg-white/80 backdrop-blur-md shadow-xl ring-1 ring-black/5 p-2 z-50 invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-150">
            <div className="flex flex-col gap-1">
              <a href="#portfolio-school" className="group/item flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:bg-gray-50 focus:text-blue-600 focus:outline-none">
                <AcademicCapIcon className="h-5 w-5 text-gray-400 group-hover/item:text-blue-600" aria-hidden="true" />
                <span>school</span>
              </a>
              <a href="#portfolio-investing" className="group/item flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:bg-gray-50 focus:text-blue-600 focus:outline-none">
                <ChartBarIcon className="h-5 w-5 text-gray-400 group-hover/item:text-blue-600" aria-hidden="true" />
                <span>investing</span>
              </a>
              <a href="#portfolio-photography" className="group/item flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:bg-gray-50 focus:text-blue-600 focus:outline-none">
                <CameraIcon className="h-5 w-5 text-gray-400 group-hover/item:text-blue-600" aria-hidden="true" />
                <span>photography</span>
              </a>
            </div>
          </div>
        </div>

        <a href="#contact" className="nav-link">Contact</a>
      </nav>
    </header>
  );
}

export default Header;
