import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { enter, delay, hoverSpring, viewportOnce } from '../../motionConfig';
import './Portfolio.css';

function Portfolio() {
  const [isHovered, setIsHovered] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });

  // Smooth custom auto-scroll that doesn't re-init Embla (prevents jumpiness)
  const defaultScrollBodyRef = useRef(null);
  const playingRef = useRef(false);
  const speedTargetRef = useRef(2.0); // desired speed
  const speedCurrentRef = useRef(2.0); // eased towards desired speed

  // Update desired speed on hover without re-initializing Embla
  useEffect(() => {
    speedTargetRef.current = isHovered ? 0.6 : 2.0;
  }, [isHovered]);

  useEffect(() => {
    if (!emblaApi) return;

    const engine = emblaApi.internalEngine();
    if (!defaultScrollBodyRef.current) {
      defaultScrollBodyRef.current = engine.scrollBody;
    }

    const directionSign = -1; // mimic AutoScroll forward direction

    const createAutoScrollBehaviour = (engineInstance) => {
      const {
        location,
        previousLocation,
        offsetLocation,
        target,
        scrollTarget,
        index,
        indexPrevious,
        limit: { reachedMin, reachedMax, constrain },
        options: { loop },
      } = engineInstance;

      let bodyVelocity = 0;
      let scrollDirection = 0;
      let rawLocation = location.get();
      let rawLocationPrevious = 0;
      let hasSettled = false;

      function seek() {
        // Ease current speed toward target for smooth hover transitions
        const targetSpeed = speedTargetRef.current;
        const currentSpeed = speedCurrentRef.current;
        const easedSpeed = currentSpeed + (targetSpeed - currentSpeed) * 0.08; // ease factor
        speedCurrentRef.current = easedSpeed;

        previousLocation.set(location);
        bodyVelocity = directionSign * easedSpeed;
        rawLocation += bodyVelocity;
        location.add(bodyVelocity);
        target.set(location);

        const directionDiff = rawLocation - rawLocationPrevious;
        scrollDirection = Math.sign(directionDiff);
        rawLocationPrevious = rawLocation;

        const currentIndex = scrollTarget.byDistance(0, false).index;
        if (index.get() !== currentIndex) {
          indexPrevious.set(index.get());
          index.set(currentIndex);
          emblaApi.emit('select');
        }

        const reachedEnd = directionSign === -1 ? reachedMin(offsetLocation.get()) : reachedMax(offsetLocation.get());
        if (!loop && reachedEnd) {
          hasSettled = true;
          const constrainedLocation = constrain(location.get());
          location.set(constrainedLocation);
          target.set(location);
        }
        return self;
      }

      const noop = () => self;
      const self = {
        direction: () => scrollDirection,
        duration: () => -1,
        velocity: () => bodyVelocity,
        settled: () => hasSettled,
        seek,
        useBaseFriction: noop,
        useBaseDuration: noop,
        useFriction: noop,
        useDuration: noop,
      };
      return self;
    };

    function startAutoScroll() {
      if (playingRef.current) return;
      const eng = emblaApi.internalEngine();
      eng.scrollBody = createAutoScrollBehaviour(eng);
      eng.animation.start();
      playingRef.current = true;
    }

    function stopAutoScroll() {
      if (!playingRef.current) return;
      const eng = emblaApi.internalEngine();
      // Restore default Embla behaviour so user interactions feel natural
      if (defaultScrollBodyRef.current) eng.scrollBody = defaultScrollBodyRef.current;
      playingRef.current = false;
    }

    // Start on init
    startAutoScroll();

    // Respect user interactions: stop while dragging, resume after settle
    const onPointerDown = () => stopAutoScroll();
    const onPointerUp = () => emblaApi.on('settle', onSettleOnce);
    const onSettleOnce = () => {
      emblaApi.off('settle', onSettleOnce);
      startAutoScroll();
    };

    emblaApi.on('pointerDown', onPointerDown);
    emblaApi.on('pointerUp', onPointerUp);

    return () => {
      emblaApi.off('pointerDown', onPointerDown);
      emblaApi.off('pointerUp', onPointerUp);
      stopAutoScroll();
    };
  }, [emblaApi]);

  return (
    <main id="portfolio" className="portfolio-container">
      <section className="embla">
        <div
          className="embla__viewport"
          ref={emblaRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="embla__container">
            {/* Personal */}
            <div className="embla__slide">
              <motion.div
                className="portfolio-card"
                initial={{ opacity: 0, y: -50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-200px' }}
                transition={enter.section}
                whileHover={{
                  scale: 1.02,
                  boxShadow: '0 24px 48px rgba(17, 24, 39, 0.18)',
                  transition: { type: 'spring', stiffness: 260, damping: 22, mass: 0.3 }
                }}
                whileTap={{ scale: 0.995 }}
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
                whileHover={{
                  scale: 1.02,
                  boxShadow: '0 24px 48px rgba(17, 24, 39, 0.18)',
                  transition: { type: 'spring', stiffness: 260, damping: 22, mass: 0.3 }
                }}
                whileTap={{ scale: 0.995 }}
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
                whileHover={{
                  scale: 1.02,
                  boxShadow: '0 24px 48px rgba(17, 24, 39, 0.18)',
                  transition: { type: 'spring', stiffness: 260, damping: 22, mass: 0.3 }
                }}
                whileTap={{ scale: 0.995 }}
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
                initial={{ opacity: 0, y: 40, rotate: 0.5 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true, margin: '-200px' }}
                transition={enter.section}
                whileHover={{
                  scale: 1.02,
                  boxShadow: '0 24px 48px rgba(17, 24, 39, 0.18)',
                  transition: { type: 'spring', stiffness: 260, damping: 22, mass: 0.3 }
                }}
                whileTap={{ scale: 0.995 }}
              >
                <motion.h3
                  className="portfolio-title"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={viewportOnce}
                  transition={{ ...enter.block, delay: delay.sm }}
                >
                  Investing
                </motion.h3>
                <motion.p
                  className="portfolio-text"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={viewportOnce}
                  transition={{ ...enter.text, delay: delay.md }}
                >
                  Coming soon.
                </motion.p>
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
                whileHover={{
                  scale: 1.02,
                  boxShadow: '0 24px 48px rgba(17, 24, 39, 0.18)',
                  transition: { type: 'spring', stiffness: 260, damping: 22, mass: 0.3 }
                }}
                whileTap={{ scale: 0.995 }}
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
