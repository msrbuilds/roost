import { describe, expect, it } from 'vitest';
import { getNavigationItems } from './items';

describe('shared desktop and mobile navigation', () => {
    it('includes every enabled feature with access for all members', () => {
        const items = getNavigationItems(() => 'all');
        expect(items.find(item => item.href === '/roadmap')?.name).toBe('Roadmap & Issues');
        expect(items.find(item => item.href === '/live')?.premiumOnly).toBe(false);
        expect(items.find(item => item.href === '/activations')?.premiumOnly).toBe(false);
        expect(items.find(item => item.href === '/calendar')?.premiumOnly).toBe(true);
    });

    it('omits disabled feature modules from both menus', () => {
        const items = getNavigationItems(() => 'disabled');
        expect(items.some(item => item.featureKey)).toBe(false);
        expect(items.some(item => item.href === '/messages')).toBe(true);
    });

    it('does not retain access rules from a previous settings lookup', () => {
        const open = getNavigationItems(() => 'all');
        const premium = getNavigationItems(() => 'premium_only');
        expect(premium.filter(item => item.featureKey).every(item => item.premiumOnly)).toBe(true);
        expect(open.filter(item => item.featureKey).every(item => !item.premiumOnly)).toBe(true);
    });
});
