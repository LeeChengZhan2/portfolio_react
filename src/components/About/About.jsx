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

        <div className="about-content-container">
          <h1 className="text-4xl font-bold mb-2">About Me</h1>
          <p className="text-lg text-gray-600 mb-4">Software Engineer</p>
          <p className="text-gray-700">
              My name is Lee Cheng Zhan, but you can call me Zhan. I was born in the year 2000, which means I am currently 24 years old. Now I live in Johor with my family. 
              I have pursued my degree in Mathematics with computing at Tun Abdul Rahman University College (TARUC) achieving a CGPA of 3.63 and graduated in 2022. 
              This multi-disciplinary program blended mathematics as the major and computing as the minor.
              The program also provided me with knowledge of several programming languages such as Java, C++, SQL and Python.
              <br></br>
              After completing my degree, I started working as a Software Developer in the financial industry for over a year. My job responsibilities include debug, 
              develope, and maintain Java-based applications and collaborating with cross-functional teams to ensure timely and high-quality project delivery. 
              I have also developed expertise in various Java frameworks and technologies like SpringBoot, Hibernate, and Kafka.
              <br></br>
              Apart from work, I am an avid sports enthusiast and love playing basketball and football. These sports help me stay fit and mentally refreshed.
          </p>
        </div>
      </div>
    </section>
  );
};
  
  export default About;