import React from "react";
import { motion } from "framer-motion";
import "./Home.css";

function Home() {
  return (
    <main className="home-container" id="home">
      <motion.section
        className="content-container"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.8 }}
      >
        <motion.div
          className="text-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.6 }}
        >
          <p className="personalities">INFJ</p>
          <p className="occupation">Software Engineer</p>
          <h1 className="introduction">Hi, I'm Lee Cheng Zhan from Malaysia</h1>
        </motion.div>
      </motion.section>
    </main>
  );
}

export default Home;