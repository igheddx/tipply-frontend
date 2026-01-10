{
  "testEnvironment": "jsdom",
  "roots": ["<rootDir>/src"],
  "testMatch": ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  "moduleFileExtensions": ["ts", "tsx", "js", "jsx"],
  "transform": {
    "^.+\\.tsx?$": ["@swc/jest"]
  },
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy"
  },
  "collectCoverageFrom": [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.tsx",
    "!src/main.tsx",
    "!src/index.tsx"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 60,
      "functions": 60,
      "lines": 60,
      "statements": 60
    }
  },
  "setupFilesAfterEnv": ["<rootDir>/src/setupTests.ts"],
  "testPathIgnorePatterns": ["e2e", "cypress"]
}
