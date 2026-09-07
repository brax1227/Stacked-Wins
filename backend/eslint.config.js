// Why: ESLint is in devDependencies and `npm run lint` is wired up, but no
// config file existed — so the script exited 2 on every run. Flat config is
// the forward-compatible format and works on ESLint 8.57+.
export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      // Warn, don't error: there are 3 pre-existing unused vars in
      // coachService/planService (two are awaited DB calls whose results are
      // discarded). Deleting them could change behaviour, so surface them
      // without blocking CI. Promote to 'error' once they're triaged.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$' }],
      'no-undef': 'error',
      'no-console': 'warn',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];
