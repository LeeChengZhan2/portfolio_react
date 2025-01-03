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
              My name is Lee Cheng Zhan, and I was born in 2000. I am currently 25 years old and working as a software engineer in Singapore's Building Management System (BMS) industry.
              <span className="spacing"></span>
              I hold a degree in Mathematics with Computing from Tun Abdul Rahman University College (TARUC), where I graduated in 2022 with a CGPA of 3.63.
              This program offered a unique blend of mathematics as the major and computer science as the minor, equipping me with strong analytical and technical skills.
              <span className="spacing"></span>
              After graduation, I began my career as a Software Developer in the financial industry, where I spent over a year debugging, developing, and maintaining Java-based applications.
              During this time, I collaborated with cross-functional teams to deliver high-quality projects and gained expertise in Java frameworks and technologies like Spring Boot, Hibernate, and Kafka.
              I then transitioned to the Building Management System (BMS) industry, where I currently develop and debug drivers for communication with systems such as HVAC, lighting, and fans.
              My role involves ensuring seamless system integration, collaborating with my team to enhance the BMS platform, and maintaining robust, reliable code.
              <span className="spacing"></span>
              Outside of work, I am passionate about staying active and developing my personal skills. I enjoy playing basketball, football, and going to the gym, which helps me stay physically fit and mentally refreshed.
              Additionally, I have a keen interest in photography and vlogging. Filming and creating vlogs not only allow me to capture meaningful moments but also improve my communication skills and boost my confidence.
              These hobbies help me achieve a well-rounded and fulfilling lifestyle.
            </p>
            <span className="spacing"></span>
            <div className="more-button-container">
                <button className="more-button">
                    More
                </button>
            </div>
        </div>
      </div>
    </section>
  );
};
  
  export default About;