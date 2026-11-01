module.exports = {
  preset: '@react-native/jest-preset',
  haste: { defaultPlatform: 'android', platforms: ['android', 'native'] },
  testMatch: ['**/tests/**/*.test.[jt]s?(x)'],
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/artifacts/', '<rootDir>/.tools/'],
  transformIgnorePatterns: [
    'node_modules/(?!((?:@react-native[^/]*|@react-navigation)/|react-native[^/]*/))',
  ],
};
