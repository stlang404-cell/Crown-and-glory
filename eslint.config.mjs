// Hook-order guard only (dev tool, not bundled): a hook after an early return blanked the Analysis screen in v0.8 development.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
export default [
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } }, plugins: { 'react-hooks': reactHooks }, rules: { 'react-hooks/rules-of-hooks': 'error' } },
];
