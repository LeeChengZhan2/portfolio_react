import React from "react";

function Home(){
    return(
        <main className="bg-gray-100 text-gray-800 p-4">
        {/* Introduction Section */}
        <section className="intro-section text-center py-12 bg-blue-500 text-white">
          <h1 className="text-4xl font-bold mb-4">Hi, I'm Lee Cheng Zhan from Malaysia</h1>
          <p className="text-lg mb-6">
            Software Developer
          </p>
          <button className="bg-white text-blue-500 px-6 py-2 rounded-lg font-semibold hover:bg-blue-600 hover:text-white">
            Learn More
          </button>
        </section>
  
        {/* Skills Section */}
        <section className="skills-section py-12">
          <h2 className="text-3xl font-semibold text-center mb-8">My Skills</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="skill-card p-4 bg-white rounded-lg shadow hover:bg-blue-100 text-center">
              <p className="text-xl font-bold">React</p>
            </div>
            <div className="skill-card p-4 bg-white rounded-lg shadow hover:bg-blue-100 text-center">
              <p className="text-xl font-bold">JavaScript</p>
            </div>
            <div className="skill-card p-4 bg-white rounded-lg shadow hover:bg-blue-100 text-center">
              <p className="text-xl font-bold">CSS</p>
            </div>
            {/* Add more skills */}
          </div>
        </section>
  
        {/* Projects Section */}
        <section className="projects-section py-12 bg-gray-200">
          <h2 className="text-3xl font-semibold text-center mb-8">My Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="project-card bg-white p-6 rounded-lg shadow">
              <h3 className="text-2xl font-bold mb-2">Project Name</h3>
              <p className="text-gray-700 mb-4">Description of the project goes here.</p>
              <span className="text-sm text-gray-500 block mb-4">Technologies: React, JavaScript</span>
              <a href="https://github.com/your-project" className="text-blue-500 hover:underline mr-4">GitHub</a>
              <a href="https://live-demo.com" className="text-blue-500 hover:underline">Live Demo</a>
            </div>
            {/* Add more projects */}
          </div>
        </section>
  
        {/* Contact Section */}
        <section className="contact-section py-12 bg-blue-500 text-white">
          <h2 className="text-3xl font-semibold text-center mb-8">Contact Me</h2>
          <form className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
            <input
              type="text"
              placeholder="Your Name"
              className="w-full p-3 mb-4 border border-gray-300 rounded-lg"
            />
            <input
              type="email"
              placeholder="Your Email"
              className="w-full p-3 mb-4 border border-gray-300 rounded-lg"
            />
            <textarea
              placeholder="Your Message"
              className="w-full p-3 mb-4 border border-gray-300 rounded-lg"
              rows="4"
            ></textarea>
            <button
              type="submit"
              className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 font-semibold"
            >
              Send Message
            </button>
          </form>
        </section>
      </main>
    );
  };
  
  export default Home;