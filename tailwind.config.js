import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const withComb = require('@so360/theme/src/withComb.cjs');

/** @type {import('tailwindcss').Config} */
export default withComb({
  // Scope utilities to the CRM subtree — see src/utils/crmScope.tsx.
  important: '.crm-scope',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
});
