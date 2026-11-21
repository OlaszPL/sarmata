export default {
  '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix', 'prettier --write'],
  '*.{json,yml,yaml,css,md,mdx,html}': ['prettier --write'],
};
