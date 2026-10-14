import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const themePreset = require('@so360/theme/src/preset.cjs');

/** @type {import('tailwindcss').Config} */
export default {
  presets: [themePreset],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Comb templates' responsive variants (wc-medium:, lg:) must be emitted in
    // this remote's CSS too; otherwise its later-loaded base utilities
    // (flex-col, grid-cols-1) override the shell's media-query variants.
    "./node_modules/@so360/design-system/dist/**/*.js",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
