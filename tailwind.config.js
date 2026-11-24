/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/pages/**/*.html", "./src/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        ink: "#24231F",
        cream: "#F5EAC7",
        parchment: "#E8D0A8",
        gold: "#E6C95F",
        orange: "#F28C22",
        "champion-red": "#D9533F",
        olive: "#303A25",
        brown: "#754B3A",
      },
      fontFamily: {
        display: ['"Oswald"', "Impact", '"Arial Narrow"', "sans-serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
        script: ['"Yellowtail"', "cursive"],
      },
      boxShadow: {
        "varsity-sm": "2px 2px 0px #24231F",
        varsity: "4px 4px 0px #24231F",
        "varsity-lg": "6px 6px 0px #24231F",
      },
    },
  },
  plugins: [],
};
