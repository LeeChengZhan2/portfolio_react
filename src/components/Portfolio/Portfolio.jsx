import React from 'react';
import { motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll from 'embla-carousel-auto-scroll';
import { enter, delay, hoverSpring, viewportOnce } from '../../motionConfig';
import './Portfolio.css';

function Portfolio() {
  const [emblaRef] = useEmblaCarousel(
    { loop: true, align: 'start' },
    [
      AutoScroll({
        speed: 1.5,
        stopOnInteraction: false,
        stopOnMouseEnter: false,
      }),
    ]
  );

  return (
    <main id="portfolio" className="portfolio-container">
      <section className="embla">
        <div className="embla__viewport" ref={emblaRef}>
          <div className="embla__container">
            {/* Personal */}
            <div className="embla__slide">
              <motion.div
                className="portfolio-card"
                initial={{ opacity: 0, y: -50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-200px' }}
                transition={enter.section}
                whileHover={{ scale: 1.03, rotate: -1 }}
              >
                <motion.h2
                  className="portfolio-title"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={viewportOnce}
                  transition={{ ...enter.block, delay: delay.sm }}
                >
                  Personal
                </motion.h2>
                <motion.p
                  className="portfolio-text"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={viewportOnce}
                  transition={{ ...enter.text, delay: delay.md }}
                >
                  This section highlights my personal achievements and projects outside of academic and professional work. It includes hobbies, personal interests, and self-driven learning experiences.
                </motion.p>
              </motion.div>
            </div>

            {/* GitHub */}
            <div className="embla__slide">
              <motion.div
                className="portfolio-card"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-200px' }}
                transition={enter.section}
                whileHover={{ scale: 1.03 }}
              >
                <motion.h2
                  className="portfolio-title"
                  initial={{ opacity: 0, y: -20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={viewportOnce}
                  transition={{ ...enter.block, delay: delay.md }}
                >
                  GitHub
                </motion.h2>
                <motion.p
                  className="portfolio-text"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={viewportOnce}
                  transition={{ ...enter.text, delay: delay.lg }}
                >
                  This section showcases my personal projects, including previous school assignments and independent work. All projects are uploaded to GitHub.
                </motion.p>
                <motion.div
                  className="mt-auto text-center"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={viewportOnce}
                  transition={{ ...enter.text, delay: delay.lg }}
                >
                  <motion.a
                    className="portfolio-link"
                    href="https://github.com/LeeChengZhan2?tab=repositories"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={hoverSpring}
                  >
                    View My GitHub Repositories
                  </motion.a>
                </motion.div>
              </motion.div>
            </div>

            {/* School FYP Project */}
            <div className="embla__slide">
              <motion.div
                className="portfolio-card"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-200px' }}
                transition={enter.section}
                whileHover={{ scale: 1.03, rotate: 1 }}
              >
                <motion.h2
                  className="portfolio-title"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={viewportOnce}
                  transition={{ ...enter.block, delay: delay.lg }}
                >
                  School FYP Project
                </motion.h2>
                <motion.p
                  className="portfolio-text"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={viewportOnce}
                  transition={{ ...enter.text, delay: delay.lg }}
                >
                  My Final Year Project (FYP) explores innovative solutions in my field of study. You can view the full report and download a copy below.
                </motion.p>
                <motion.div
                  className="mt-auto text-center flex flex-col gap-4"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={viewportOnce}
                  transition={{ ...enter.text, delay: delay.lg }}
                >
                  <motion.a
                    className="portfolio-link"
                    href="https://eprints.tarc.edu.my/22481/"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={hoverSpring}
                  >
                    View Project
                  </motion.a>
                  <motion.a
                    className="portfolio-link"
                    href="/assets/documents/leechengzhan-fyp.pdf"
                    download
                    whileHover={{ scale: 1.05, rotate: -1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={hoverSpring}
                  >
                    Download Report
                  </motion.a>
                </motion.div>
              </motion.div>
            </div>

            {/* Investing */}
            <div className="embla__slide">
              <motion.div
                className="portfolio-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-200px' }}
                transition={enter.section}
              >
                <h3 className="portfolio-title">Investing</h3>
                <p className="portfolio-text">Coming soon.</p>
              </motion.div>
            </div>

            {/* Photography */}
            <div className="embla__slide">
              <motion.div
                className="portfolio-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-200px' }}
                transition={enter.section}
              >
                <h3 className="portfolio-title">Photography</h3>
                <p className="portfolio-text">Coming soon.</p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Portfolio;
