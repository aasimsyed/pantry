module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-native-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-native-a11y/all',
  ],
  env: { es2022: true },
  ignorePatterns: ['node_modules/', '.expo/', 'ios/', 'android/', 'dist/'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    'react-native-a11y/has-accessibility-props': [
      'error',
      { touchables: ['TouchableOpacity', 'Pressable', 'Button', 'FAB', 'IconButton', 'ListItem', 'Card', 'TouchableWithoutFeedback'] },
    ],
    'react-native-a11y/no-nested-touchables': [
      'error',
      { touchables: ['TouchableOpacity', 'Pressable', 'Button', 'FAB', 'IconButton', 'ListItem', 'Card', 'TouchableWithoutFeedback'] },
    ],
    'react-native-a11y/has-accessibility-hint': 'warn',
    'react-native-a11y/has-valid-accessibility-descriptors': 'warn',
  },
};
