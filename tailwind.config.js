/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    darkMode: "class",
    theme: {
        extend: {
            colors: { djDark: {
                ...require('./src/theme/darkPalette.json'),
                primary: 'rgb(var(--dj-primary) / <alpha-value>)',
                tint: 'rgb(var(--dj-tint) / <alpha-value>)',
            } },
        },
    },
    plugins: [],
}
