import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const themePreset = require('../../so360-shell-fe/packages/theme/src/preset.cjs');

/** @type {import('tailwindcss').Config} */
export default {
  presets: [themePreset],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
