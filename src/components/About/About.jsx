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
          <h1 className="about-sub-title">About Me</h1>
          <p className="about-occupation">Software Engineer</p>
          <p className="about-contain">
              My name is Lee Cheng Zhan, you can call me Zhan. I was born in the year 2000, currently 24 years old. Now I am working in Singapore as a software developer.
              <span className="spacing"></span>
              I have pursued my degree in Mathematics with Computing at Tun Abdul Rahman University College (TARUC) achieving a CGPA of 3.63 and graduated in 2022. 
              This multi-disciplinary program blended mathematics as the major and computer science as the minor.
              <span className="spacing"></span>
              After completing my degree, I started working as a Software Developer in the financial industry for over a year. My job responsibilities include debug, 
              develope, and maintain Java-based applications and collaborating with cross-functional teams to ensure timely and high-quality project delivery. 
              I have also developed expertise in various Java frameworks and technologies like SpringBoot, Hibernate, and Kafka.
              <span className="spacing"></span>
              Apart from work, I am an avid sports enthusiast and love playing basketball and football. These sports help me stay fit and mentally refreshed.
          </p>
        </div>
      </div>
    </section>
  );
};
  
  export default About;