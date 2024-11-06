import React from "react";
import './About.css';

function About(){
  return(
    <section className="about-container" id="about">
      <div className="about-flex-container">
        <div className="about-picture-container">
          <img
            src="your-profile-picture.jpg" // Replace with your actual image path
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Right Box - Introduction */}
        <div className="about-content-container">
          <h1 className="text-4xl font-bold mb-2">About Me</h1>
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