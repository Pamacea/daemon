// daemon.config.js
export default {
  scoring: {
    weights: {
      coverage: 0.30,
      quality: 0.25,
      performance: 0.20,
      security: 0.15,
      documentation: 0.10,
    },
    thresholds: {
      coverage: {
        excellent: 80,
        good: 60,
        average: 40,
      },
      complexity: {
        max: 10,
        warning: 7,
      },
    },
    exclude: [
      'node_modules/**',
      'dist/**',
    ],
  },
};
