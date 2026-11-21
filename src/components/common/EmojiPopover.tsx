import { lazy, Suspense, useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Theme, type EmojiClickData } from 'emoji-picker-react';
import { useTheme } from '@/contexts/ThemeContext';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

interface Props {
    anchorRef: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
    onEmojiClick: (emoji: EmojiClickData) => void;
}

export default function EmojiPopover({ anchorRef, onClose, onEmojiClick }: Props) {
    const { resolvedTheme } = useTheme();
    const [position, setPosition] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

    useLayoutEffect(() => {
        const updatePosition = () => {
            const anchor = anchorRef.current?.getBoundingClientRect();
            if (!anchor) return;
            const width = Math.min(350, window.innerWidth - 24);
            const height = Math.min(440, window.innerHeight - 24);
            const below = anchor.bottom + 8;
            const top = below + height <= window.innerHeight - 12 ? below : anchor.top - height - 8;
            setPosition({
                left: Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12)),
                top: Math.max(12, Math.min(top, window.innerHeight - height - 12)),
                width,
                height,
            });
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
                anchorRef.current?.focus();
            }
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [anchorRef, onClose]);

    if (!position) return null;
    return createPortal(<>
        <button type="button" aria-label="Dismiss emoji picker" className="fixed inset-0 z-[100] cursor-default" onClick={onClose} />
        <div role="dialog" aria-label="Emoji picker" style={position} className="fixed z-[101] overflow-hidden rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-elevated">
            <div className="h-10 px-3 flex items-center justify-between text-sm font-medium text-surface-700 dark:text-surface-300">
                <span>Choose an emoji</span>
                <button type="button" aria-label="Close emoji picker" onClick={onClose} className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800"><X className="w-4 h-4" /></button>
            </div>
            <Suspense fallback={<div className="h-full animate-pulse bg-surface-100 dark:bg-surface-800" />}>
                <EmojiPicker onEmojiClick={onEmojiClick} width="100%" height={position.height - 40} autoFocusSearch={false} theme={resolvedTheme === 'dark' ? Theme.DARK : Theme.LIGHT} />
            </Suspense>
        </div>
    </>, document.body);
}
