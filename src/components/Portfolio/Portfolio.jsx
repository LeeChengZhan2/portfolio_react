import React from 'react';
import { motion } from 'framer-motion';
import './Portfolio.css';

function Portfolio() {
  return (
    <main id="portfolio" className="portfolio-container">
      <section className="portfolio-flex-container">
        {/* Personal Container */}
        <motion.div
          className="portfolio-1-container"
          initial={{ opacity: 0, y: -50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.8 }}
          whileHover={{ scale: 1.03 }}
        >
          <motion.h2
            className="portfolio-title"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.3 }}
          >
            Personal
          </motion.h2>
          <motion.p
            className="portfolio-text"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.6 }}
          >
            This section highlights my personal achievements and projects outside of academic and professional work. It includes hobbies, personal interests, and self-driven learning experiences.
          </motion.p>
        </motion.div>

        {/* GitHub Container */}
        <motion.div
          className="portfolio-2-container"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.8 }}
          whileHover={{ scale: 1.05 }}
        >
          <motion.h2 className="portfolio-title">GitHub</motion.h2>
          <motion.p className="portfolio-text">
            This section showcases my personal projects, including previous school assignments and independent work. All projects are uploaded to GitHub.
          </motion.p>
          <div className="mt-auto text-center">
            <motion.a
              href="https://github.com/LeeChengZhan2?tab=repositories"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.1, color: '#ff4500' }}
              transition={{ type: 'spring', stiffness: 250 }}
              className="portfolio-link"
            >
              View My GitHub Repositories
            </motion.a>
          </div>
        </motion.div>

        {/* FYP Project Container */}
        <motion.div
          className="portfolio-3-container"
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.8 }}
          whileHover={{ rotate: 2 }}
        >
          <motion.h2 className="portfolio-title">FYP Project</motion.h2>
          <motion.p className="portfolio-text">
            My Final Year Project (FYP) explores innovative solutions in my field of study. You can view the full report and download a copy below.
          </motion.p>
          <div className="mt-auto text-center flex flex-col gap-4">
            <motion.a
              href="https://eprints.tarc.edu.my/22481/"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.08 }}
              transition={{ type: 'spring', stiffness: 250 }}
              className="portfolio-link"
            >
              View Project
            </motion.a>
            <motion.a
              href="/assets/documents/LeeChengZhan_FYP.pdf"
              download
              whileHover={{ scale: 1.08, rotate: -2 }}
              transition={{ type: 'spring', stiffness: 250 }}
              className="portfolio-link"
            >
              Download Report
            </motion.a>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

export default Portfolio;
