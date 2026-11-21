/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // Skool-inspired color palette
            colors: {
                // Primary brand colors
                primary: {
                    50: 'rgb(var(--color-primary-50-rgb, 240 249 255) / <alpha-value>)',
                    100: 'rgb(var(--color-primary-100-rgb, 224 242 254) / <alpha-value>)',
                    200: 'rgb(var(--color-primary-200-rgb, 186 230 253) / <alpha-value>)',
                    300: 'rgb(var(--color-primary-300-rgb, 125 211 252) / <alpha-value>)',
                    400: 'rgb(var(--color-primary-400-rgb, 56 189 248) / <alpha-value>)',
                    500: 'rgb(var(--color-primary-500-rgb, 14 165 233) / <alpha-value>)',
                    600: 'rgb(var(--color-primary-600-rgb, 2 132 199) / <alpha-value>)',
                    700: 'rgb(var(--color-primary-700-rgb, 3 105 161) / <alpha-value>)',
                    800: 'rgb(var(--color-primary-800-rgb, 7 89 133) / <alpha-value>)',
                    900: 'rgb(var(--color-primary-900-rgb, 12 74 110) / <alpha-value>)',
                    950: 'rgb(var(--color-primary-950-rgb, 8 47 73) / <alpha-value>)',
                },
                // Neutral grays (matching Skool's clean aesthetic)
                surface: {
                    50: '#fafafa',
                    100: '#f5f5f5',
                    200: '#e5e5e5',
                    300: '#d4d4d4',
                    400: '#a3a3a3',
                    500: '#737373',
                    600: '#525252',
                    700: '#404040',
                    800: '#262626',
                    900: '#171717',
                    950: '#0a0a0a',
                },
                // Accent colors for reactions and badges
                accent: {
                    fire: '#f97316',
                    love: '#ef4444',
                    clap: '#eab308',
                    think: '#8b5cf6',
                },
                // Status colors
                success: '#22c55e',
                warning: '#f59e0b',
                error: '#ef4444',
                info: '#3b82f6',
            },
            // Typography
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            // Spacing scale extensions
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '128': '32rem',
            },
            // Border radius
            borderRadius: {
                '4xl': '2rem',
            },
            // Box shadows
            boxShadow: {
                'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
                'card': '0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
                'elevated': '0 10px 40px -10px rgba(0, 0, 0, 0.2)',
                'soft-dark': '0 2px 15px -3px rgba(0, 0, 0, 0.3), 0 10px 20px -2px rgba(0, 0, 0, 0.2)',
                'card-dark': '0 0 0 1px rgba(255, 255, 255, 0.05), 0 1px 3px rgba(0, 0, 0, 0.3)',
                'elevated-dark': '0 10px 40px -10px rgba(0, 0, 0, 0.5)',
            },
            // Custom animations
            animation: {
                'fade-in': 'fadeIn 0.2s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'slide-in-right': 'slideInRight 0.25s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
                slideInRight: {
                    '0%': { transform: 'translateX(100%)' },
                    '100%': { transform: 'translateX(0)' },
                },
            },
            // Container sizes
            maxWidth: {
                '8xl': '88rem',
                '9xl': '96rem',
            },
        },
    },
    plugins: [],
};
