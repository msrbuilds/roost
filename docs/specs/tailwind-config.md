# TailwindCSS Configuration Specification

## Overview

This document describes the TailwindCSS configuration for the Commune platform, including the custom theme, color palette, typography, and component classes.

---

## Configuration File

**Location:** `/tailwind.config.js`

The configuration extends Tailwind's default theme with custom values inspired by a clean, minimal aesthetic.

---

## Color Palette

### Primary Colors (Brand)

```javascript
primary: {
  50: '#f0f9ff',
  100: '#e0f2fe',
  200: '#bae6fd',
  300: '#7dd3fc',
  400: '#38bdf8',
  500: '#0ea5e9',   // Main brand color
  600: '#0284c7',   // Hover state
  700: '#0369a1',   // Active state
  800: '#075985',
  900: '#0c4a6e',
  950: '#082f49',
}
```

**Usage:**
- Buttons: `bg-primary-600` / `hover:bg-primary-700`
- Links: `text-primary-600` / `hover:text-primary-700`
- Focus rings: `ring-primary-500`
- Badges: `bg-primary-100 text-primary-700`

### Surface Colors (Neutrals)

```javascript
surface: {
  50: '#fafafa',    // Page background
  100: '#f5f5f5',   // Input background
  200: '#e5e5e5',   // Borders
  300: '#d4d4d4',   // Hover borders
  400: '#a3a3a3',   // Placeholder text
  500: '#737373',   // Secondary text
  600: '#525252',   // Body text
  700: '#404040',   // Labels
  800: '#262626',   // Headings
  900: '#171717',   // Primary text
}
```

**Usage:**
- Background: `bg-surface-50`
- Cards: `bg-white border-surface-200`
- Text: `text-surface-900` (primary), `text-surface-500` (secondary)
- Borders: `border-surface-200`

### Accent Colors (Reactions)

```javascript
accent: {
  fire: '#f97316',   // 🔥 Fire reaction
  love: '#ef4444',   // ❤️ Love reaction
  clap: '#eab308',   // 👏 Clap reaction
  think: '#8b5cf6',  // 🤔 Think reaction
}
```

### Status Colors

```javascript
success: '#22c55e',  // Green
warning: '#f59e0b',  // Amber
error: '#ef4444',    // Red
info: '#3b82f6',     // Blue
```

---

## Typography

### Font Family

```javascript
fontFamily: {
  sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
  mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
}
```

**Google Fonts Import (in `index.html`):**

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Font Weights Used

| Weight | Class | Usage |
|--------|-------|-------|
| 400 | `font-normal` | Body text |
| 500 | `font-medium` | Labels, buttons |
| 600 | `font-semibold` | Headings, card titles |
| 700 | `font-bold` | Page titles |

---

## Spacing

### Extended Spacing Scale

```javascript
spacing: {
  '18': '4.5rem',   // 72px
  '88': '22rem',    // 352px (sidebar width)
  '128': '32rem',   // 512px
}
```

---

## Shadows

### Custom Shadows

```javascript
boxShadow: {
  'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
  'card': '0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
  'elevated': '0 10px 40px -10px rgba(0, 0, 0, 0.2)',
}
```

**Usage:**
- Cards: `shadow-card`
- Hover states: `hover:shadow-soft`
- Modals/dropdowns: `shadow-elevated`

---

## Animations

### Custom Animations

```javascript
animation: {
  'fade-in': 'fadeIn 0.2s ease-out',
  'slide-up': 'slideUp 0.3s ease-out',
  'slide-down': 'slideDown 0.3s ease-out',
  'scale-in': 'scaleIn 0.2s ease-out',
  'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
}
```

**Keyframes:**

```javascript
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
}
```

**Usage:**
- Page transitions: `animate-fade-in`
- Modal entry: `animate-scale-in`
- Toast notifications: `animate-slide-up`
- Loading indicators: `animate-pulse-soft`

---

## Component Classes

Defined in `/src/index.css` using `@layer components`:

### Buttons

```css
.btn {
  @apply inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150;
  @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2;
  @apply disabled:opacity-50 disabled:pointer-events-none;
}

.btn-primary {
  @apply btn bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500;
}

.btn-secondary {
  @apply btn bg-surface-100 text-surface-900 hover:bg-surface-200 focus-visible:ring-surface-400;
}

.btn-ghost {
  @apply btn bg-transparent text-surface-600 hover:bg-surface-100 hover:text-surface-900;
}

.btn-danger {
  @apply btn bg-error text-white hover:bg-red-600 focus-visible:ring-red-500;
}
```

### Cards

```css
.card {
  @apply bg-white rounded-xl border border-surface-200 shadow-card;
}

.card-hover {
  @apply card transition-shadow duration-200 hover:shadow-soft;
}
```

### Inputs

```css
.input {
  @apply w-full rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm;
  @apply placeholder:text-surface-400;
  @apply focus:border-primary-500 focus:ring-1 focus:ring-primary-500;
  @apply disabled:bg-surface-50 disabled:text-surface-500;
}

.input-error {
  @apply input border-error focus:border-error focus:ring-error;
}

.label {
  @apply block text-sm font-medium text-surface-700 mb-1;
}
```

### Avatars

```css
.avatar {
  @apply relative inline-flex items-center justify-center rounded-full bg-surface-200 overflow-hidden;
}

.avatar-sm { @apply avatar w-8 h-8 text-xs; }
.avatar-md { @apply avatar w-10 h-10 text-sm; }
.avatar-lg { @apply avatar w-12 h-12 text-base; }
.avatar-xl { @apply avatar w-16 h-16 text-lg; }
```

### Badges

```css
.badge {
  @apply inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium;
}

.badge-primary { @apply badge bg-primary-100 text-primary-700; }
.badge-success { @apply badge bg-green-100 text-green-700; }
.badge-warning { @apply badge bg-yellow-100 text-yellow-700; }
.badge-error { @apply badge bg-red-100 text-red-700; }
```

### Dropdowns

```css
.dropdown-menu {
  @apply absolute z-50 min-w-[180px] rounded-lg border border-surface-200 bg-white p-1 shadow-elevated;
  @apply animate-scale-in origin-top-right;
}

.dropdown-item {
  @apply flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-surface-700;
  @apply hover:bg-surface-100 hover:text-surface-900;
  @apply cursor-pointer transition-colors;
}
```

---

## Utility Classes

### Scrollbar Styling

```css
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: theme('colors.surface.300') transparent;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

### Line Clamping

```css
.line-clamp-1 { /* Single line truncation */ }
.line-clamp-2 { /* Two line truncation */ }
.line-clamp-3 { /* Three line truncation */ }
```

---

## Responsive Breakpoints

Standard Tailwind breakpoints:

| Breakpoint | Pixels | Class Prefix |
|------------|--------|--------------|
| sm | 640px | `sm:` |
| md | 768px | `md:` |
| lg | 1024px | `lg:` |
| xl | 1280px | `xl:` |
| 2xl | 1536px | `2xl:` |

---

## Best Practices

1. **Use semantic color names** - `bg-primary-600` not `bg-blue-600`
2. **Use component classes** - `.btn-primary` not individual utilities
3. **Mobile-first** - Default styles for mobile, add `md:` for larger screens
4. **Consistent spacing** - Use Tailwind's spacing scale (`p-4`, `m-2`, etc.)
5. **Dark mode ready** - Use `dark:` prefix when implementing dark mode
