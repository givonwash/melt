/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        astTransformers: {
          before: ["<rootDir>/tests/utils/transformers/replace-import-meta-dirname.ts"],
        },
        diagnostics: {
          ignoreCodes: [1343],
        },
        useESM: true,
      },
    ],
  },
};

export default config;
