/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [require.resolve("./index.js")],
  env: { browser: true },
  rules: {}
}
