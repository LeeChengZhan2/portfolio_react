import React, { useEffect } from 'react';
import Lenis from 'lenis';

function SmoothScroll({ children }) {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });

    let animationFrame;

    const raf = (time) => {
      lenis.raf(time);
      animationFrame = requestAnimationFrame(raf);
    };

    animationFrame = requestAnimationFrame(raf);

    const handleScroll = ({ scroll }) => {
      const homeEl = document.getElementById('home');
      const portfolioEl = document.getElementById('portfolio');

      if (!homeEl || !portfolioEl) {
        document.documentElement.style.setProperty('--home-bg-parallax', '0px');
        return;
      }

      const homeHeight = homeEl.offsetHeight || 1;
      const portfolioTop = portfolioEl.offsetTop;

      const startScroll = 0;
      const endScroll = Math.max(portfolioTop - homeHeight * 0.3, startScroll + 1);

      const clamped = Math.min(Math.max(scroll - startScroll, 0), endScroll - startScroll);
      const t = clamped / (endScroll - startScroll);

      const eased = 1 - Math.pow(1 - t, 2);

      const maxShift = 120;
      const offset = -maxShift * eased;

      document.documentElement.style.setProperty('--home-bg-parallax', `${offset}px`);
    };

    lenis.on('scroll', handleScroll);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      lenis.off('scroll', handleScroll);
      lenis.destroy();
      document.documentElement.style.removeProperty('--home-bg-parallax');
    };
  }, []);

  return children;
}

export default SmoothScroll;

