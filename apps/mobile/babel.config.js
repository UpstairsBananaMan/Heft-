// babel-preset-expo only adds the Expo Router inliner when it can resolve
// `expo-router` from the hoisted preset. In this npm workspace the package
// lives under apps/mobile, so the web bundle never sees a string app root.
const { expoRouterBabelPlugin } = require("babel-preset-expo/build/expo-router-plugin");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins: [expoRouterBabelPlugin],
  };
};
