import React from "react";
import { motion } from "framer-motion";
import { enter, delay, viewportOnce } from "../../motionConfig";
import "./Home.css";

function Home() {
  return (
    <main className="home-container" id="home">
      <motion.section
        className="content-container"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        viewport={viewportOnce}
        transition={enter.section}
      >
        <motion.div
          className="text-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ ...enter.block, delay: delay.md }}
        >
          <p className="occupation">Software Engineer</p>
          <h1 className="introduction">Hi, I'm Lee Cheng Zhan from Malaysia</h1>
        </motion.div>
      </motion.section>
    </main>
  );
}

export default Home;
