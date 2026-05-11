/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['eslint:recommended'],
  plugins: ['boundaries'],
  env: { node: true, es2022: true },
  settings: {
    'boundaries/elements': [
      { type: 'package', pattern: 'packages/*', mode: 'folder' },
      { type: 'app', pattern: 'apps/*', mode: 'folder' },
    ],
  },
  rules: {
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          { from: 'app', allow: ['package'] },
          { from: 'package', allow: [] },
        ],
      },
    ],
  },
}
