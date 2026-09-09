import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'docs/**', 'public/audio/**', 'ul/**']
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'warn'
    }
  },
  {
    files: ['src/util/audio.js'],
    rules: {
      // ZzFX 파라미터는 생략 위치 자체가 음색 데이터다.
      'no-sparse-arrays': 'off'
    }
  }
];
