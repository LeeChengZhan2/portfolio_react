import { useEffect } from 'react';
import Lenis from 'lenis';

function SmoothScroll({ children }) {
  useEffect(() => {
    const sections = [
      { id: 'home', cssVar: '--home-bg-parallax', maxShift: 80 },
      { id: 'portfolio', cssVar: '--portfolio-bg-parallax', maxShift: 60 },
    ];

    const prefersReducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    )?.matches;

    if (prefersReducedMotion) {
      sections.forEach(({ cssVar }) => {
        document.documentElement.style.setProperty(cssVar, '0px');
      });
      return undefined;
    }

    const lenis = new Lenis({
      lerp: 0.16,
      smoothWheel: true,
      smoothTouch: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.2,
    });

    const targetOffsets = {};
    const currentOffsets = {};

    sections.forEach(({ id }) => {
      targetOffsets[id] = 0;
      currentOffsets[id] = 0;
    });

    let animationFrame;

    const raf = (time) => {
      lenis.raf(time);

      const damping = 0.08;

      sections.forEach(({ id, cssVar }) => {
        const current = currentOffsets[id];
        const target = targetOffsets[id];
        const next = current + (target - current) * damping;
        currentOffsets[id] = next;

        document.documentElement.style.setProperty(cssVar, `${next}px`);
      });

      animationFrame = requestAnimationFrame(raf);
    };

    animationFrame = requestAnimationFrame(raf);

    const handleScroll = ({ scroll }) => {
      const viewportHeight = window.innerHeight || 1;

      sections.forEach(({ id, maxShift }) => {
        const el = document.getElementById(id);

        if (!el) {
          targetOffsets[id] = 0;
          return;
        }

        const sectionTop = el.offsetTop || 0;
        const sectionHeight = el.offsetHeight || viewportHeight;
        const maxShiftPx = maxShift; // max px the background will move

        const startScroll = sectionTop;
        const distance = sectionHeight || 1;

        const clamped = Math.min(
          Math.max(scroll - startScroll, 0),
          distance
        );
        const t = clamped / distance;

        const eased = t * (2 - t); // ease-out

        targetOffsets[id] = -maxShiftPx * eased;
      });
    };

    lenis.on('scroll', handleScroll);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      lenis.off('scroll', handleScroll);
      lenis.destroy();
      sections.forEach(({ cssVar }) => {
        document.documentElement.style.removeProperty(cssVar);
      });
    };
  }, []);

  return children;
}

export default SmoothScroll;
