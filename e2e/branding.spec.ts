import { test, expect } from '@playwright/test';
import { createPrimaryPalette } from '../src/lib/branding';

test('dark selected controls preserve opacity with saved brand colors', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme-preference', 'dark'));
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    for (const hex of ['#0ea5e9', '#ed2345']) {
        const palette = createPrimaryPalette(hex)!;
        await page.evaluate(palette => {
            for (const [shade, { color, rgb }] of Object.entries(palette)) {
                document.documentElement.style.setProperty(`--color-primary-${shade}`, color);
                document.documentElement.style.setProperty(`--color-primary-${shade}-rgb`, rgb);
            }
            document.getElementById('brand-sample')?.remove();
            const button = document.createElement('button');
            button.id = 'brand-sample';
            button.textContent = 'Selected brand sample';
            button.className = 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400';
            document.body.appendChild(button);
        }, palette);
        await expect(page.getByRole('button', { name: 'Selected brand sample' })).toHaveCSS('background-color', `rgba(${palette['900'].rgb.split(' ').join(', ')}, 0.3)`);
    }
});
