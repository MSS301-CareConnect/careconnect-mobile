const { FlatCompat } = require('@eslint/eslintrc');
const { fixupConfigRules } = require('@eslint/compat');
const js = require('@eslint/js');
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});
module.exports = [
  { ignores: ['artifacts/**', '.tools/**', 'android/**', 'ios/**', 'coverage/**'] },
  ...fixupConfigRules(compat.extends('@react-native')),
];
