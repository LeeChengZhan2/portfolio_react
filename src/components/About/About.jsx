import React from "react";
import './About.css';

function About(){
  return(
    // <main className="main-container">
    //     {/* Introduction Section */}
    //     <section className="about-container">
            
    //     </section>
    // </main>
    <section className="flex items-center justify-center min-h-screen px-4 py-12 bg-gray-100 text-gray-900" id="about">
      <div className="flex max-w-5xl w-full space-x-8">
        {/* Left Box - Profile Picture */}
        <div className="flex-shrink-0 w-48 h-48 rounded-lg overflow-hidden shadow-lg">
          <img
            src="your-profile-picture.jpg" // Replace with your actual image path
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Right Box - Introduction */}
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-bold mb-2">Hello! I'm Lee Cheng Zhan</h1>
          <p className="text-lg text-gray-600 mb-4">Software Engineer & BMS Specialist</p>
          <p className="text-gray-700">
            I specialize in developing and optimizing Building Management Systems, ensuring efficient communication between HVAC, lighting, and fan systems. With a focus on clean, maintainable code, I aim to create responsive and user-friendly solutions.
          </p>
        </div>
      </div>
    </section>
  );
};
  
  export default About;