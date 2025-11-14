import React from 'react';
import { motion } from 'framer-motion';
import { enter, delay, viewportOnce } from '../../motionConfig';
import './Home.css';

function Home() {
  return (
    <motion.main
      className="home-container"
      id="home"
      initial={{ opacity: 0, y: 80 }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter.section}
    >
      <section className="content-container">
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
      </section>
    </motion.main>
  );
}

export default Home;
