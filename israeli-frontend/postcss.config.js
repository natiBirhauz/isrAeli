// postcss.config.js
/** @type {import('postcss').ProcessOptions} */
export default {
  plugins: {
    "@tailwindcss/postcss": {},  // החלק הקריטי ל-V4
    autoprefixer: {},            // ניתן להשאיר או להסיר לפי גרסה
  },
}
