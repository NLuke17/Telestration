module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom', // Simulates a browser
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy', // Fixes CSS imports
  },
};