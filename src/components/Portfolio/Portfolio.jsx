import React from 'react';
import { motion } from 'motion/react';
import './Portfolio.css';

function Portfolio() {
  return (
    <main id="portfolio" className="portfolio-container">
      <section className="portfolio-flex-container">
        {/* First Container */}
        <motion.div
          className="portfolio-1-container"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
          whileHover={{ scale: 1.02 }}
        >
          <motion.h2
            className="portfolio-title"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Personal Projects
          </motion.h2>
          <motion.p
            className="portfolio-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            This section showcases my personal projects, including previous school assignments and independent work. All projects are uploaded to GitHub.
          </motion.p>
          <div className="mt-auto text-center">
            <motion.a
              href="https://github.com/LeeChengZhan2?tab=repositories"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05, color: '#ff4500' }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="portfolio-link"
            >
              View My GitHub Repositories
            </motion.a>
          </div>
        </motion.div>

        {/* Second Container */}
        <div className="portfolio-2-container">
          <h2 className="portfolio-title">Container 2</h2>
          <p className="portfolio-text">
            This is a placeholder for your second container. You can add additional details or projects here.
          </p>
        </div>

        {/* Third Container */}
        <div className="portfolio-3-container">
          <h2 className="portfolio-title">Container 3</h2>
          <p className="portfolio-text">
            This is a placeholder for your third container. Customize this section with your desired content.
          </p>
        </div>
      </section>
    </main>
  );
}
  
  export default Portfolio;