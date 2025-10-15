// Shared motion configuration for consistent, snappy animations
export const enter = {
  section: { duration: 0.6, ease: 'easeOut' },
  block: { duration: 0.45, ease: 'easeOut' },
  text: { duration: 0.35, ease: 'easeOut' },
};

export const delay = {
  xs: 0.08,
  sm: 0.12,
  md: 0.16,
  lg: 0.18,
};

export const hoverSpring = {
  type: 'spring',
  stiffness: 250,
  damping: 22,
};

export const viewportOnce = { once: true };

