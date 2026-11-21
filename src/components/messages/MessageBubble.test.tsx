import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import MessageBubble from './MessageBubble';
import type { MessageWithSender } from '@/services/message';

vi.mock('@/hooks/useAssetUrl', () => ({ useAssetUrl: () => ({ url: '/sample.png', error: null, isLoading: false }) }));
afterEach(cleanup);

it('closes a message attachment preview with its button and Escape', () => {
    const message = {
        id: 'sample-message', content: '', created_at: '2026-11-21T10:00:00Z', is_read: true,
        assets: [{ id: 'sample-image', asset_type: 'image', file_url: '/sample.png', filename: 'Sample attachment' }],
    } as MessageWithSender;
    render(<MessageBubble message={message} isSent={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sample attachment' }));
    expect(screen.getByRole('dialog', { name: 'Image preview' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close image preview' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sample attachment' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
});
