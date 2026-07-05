const variableColor = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: variableColor('--color-app'),
        surface: variableColor('--color-surface'),
        panel: variableColor('--color-panel'),
        elevated: variableColor('--color-elevated'),
        muted: variableColor('--color-muted'),
        border: variableColor('--color-border'),
        'border-subtle': variableColor('--color-border-subtle'),
        'text-primary': variableColor('--color-text-primary'),
        'text-secondary': variableColor('--color-text-secondary'),
        'text-muted': variableColor('--color-text-muted'),
        'text-inverted': variableColor('--color-text-inverted'),
        accent: variableColor('--color-accent'),
        'accent-hover': variableColor('--color-accent-hover'),
        'accent-soft': variableColor('--color-accent-soft'),
        success: variableColor('--color-success'),
        'success-soft': variableColor('--color-success-soft'),
        danger: variableColor('--color-danger'),
        'danger-soft': variableColor('--color-danger-soft'),
        warning: variableColor('--color-warning'),
        'warning-soft': variableColor('--color-warning-soft'),
      },
    },
  },
  plugins: [],
};
