/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/test"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  /**
   * Strip the `.js` extension from relative imports so ts-jest resolves them
   * to the actual `.ts` source files (the project uses NodeNext imports).
   * Also redirect ESM-only packages to CJS-compatible manual mocks.
   */
  moduleNameMapper: {
    "^chalk$": "<rootDir>/src/test/__mocks__/chalk.ts",
    "^ora$": "<rootDir>/src/test/__mocks__/ora.ts",
    "^zx$": "<rootDir>/src/test/__mocks__/zx.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
};
