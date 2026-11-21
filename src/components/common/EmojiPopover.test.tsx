import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import EmojiPopover from './EmojiPopover';

vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
vi.mock('emoji-picker-react', () => ({ Theme: { DARK: 'dark', LIGHT: 'light' }, default: () => <div>Sample emoji picker</div> }));
afterEach(cleanup);

it('escapes the editor clipping container and dismisses without closing the parent dialog', async () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const onClose = vi.fn(), parentEscape = vi.fn();
    document.addEventListener('keydown', parentEscape);
    const view = render(<div style={{ overflow: 'hidden' }}><EmojiPopover anchorRef={{ current: anchor }} onClose={onClose} onEmojiClick={vi.fn()} /></div>);
    const picker = screen.getByRole('dialog', { name: 'Emoji picker' });
    await screen.findByText('Sample emoji picker');
    expect(picker.parentElement).toBe(document.body);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(parentEscape).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(anchor);
    onClose.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Close emoji picker' }));
    expect(onClose).toHaveBeenCalledOnce();
    view.unmount();
    document.removeEventListener('keydown', parentEscape);
    anchor.remove();
});
