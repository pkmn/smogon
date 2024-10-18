import pkmn from "@pkmn/eslint-config";

export default [...pkmn, {
  files: ["index.test.ts"],
  rules: {"jest/no-conditional-expect": "off"}
}];
