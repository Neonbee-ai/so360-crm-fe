import tseslint from 'typescript-eslint';
// eslint-plugin-comb is a file: link into so360-shell-fe, which the CI gate does not
// install; load it when present (local dev) and skip the Comb rules otherwise.
const comb = await import('eslint-plugin-comb').then((m) => m.default).catch(() => null);

const noop = { meta: { schema: [] }, create: () => ({}) };

// Comb page-standard enforcement (see so360-shell-fe/packages/eslint-plugin-comb).
// Test files and test fixtures are out of scope for the rules.
export default [
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.*', '**/*.bak'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    // Rule definitions are registered only so existing `eslint-disable` comments resolve;
    // the rules themselves are not enabled here (Comb rules are the enforced set).
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': { rules: { 'exhaustive-deps': noop } },
      react: { rules: { 'no-danger': noop } },
    },
  },
  ...(comb
    ? [
        {
          ...comb.configs.recommended,
          ignores: [
            '**/*.test.{ts,tsx}',
            '**/*.spec.{ts,tsx}',
            '**/*.bdd.test.{ts,tsx}',
            'src/test/**',
            '**/__tests__/**',
            '**/__mocks__/**',
          ],
        },
      ]
    : []),
];
