import type { Config } from 'tailwindcss/types/config';

export default {
  theme: {
    extend: {
      colors: {
        'safe-green': 'var(--safe-green, #10b981)',
        'elevated-yellow': 'var(--elevated-yellow, #f59e0b)',
        'high-orange': 'var(--high-orange, #f97316)',
        'critical-red': 'var(--critical-red, #ef4444)',
        'guard-primary': 'var(--guard-primary, #6366f1)',
        'guard-muted': 'var(--guard-muted, #64748b)',
        'guard-surface': 'var(--guard-surface, #f8fafc)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} as Omit<Config, 'content'>;
