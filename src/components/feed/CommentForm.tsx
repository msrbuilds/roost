import { useState, useRef, useCallback, lazy, Suspense } from 'react';
import { Send, Loader2, Smile } from 'lucide-react';
import type { EmojiClickData } from 'emoji-picker-react';
import { Theme } from 'emoji-picker-react';

const EmojiPicker = lazy(() => import('emoji-picker-react'));
import MentionDropdown from './MentionDropdown';
import type { SearchResultUser } from '@/services/search';

interface CommentFormProps {
    onSubmit: (content: string) => Promise<void>;
    placeholder?: string;
    autoFocus?: boolean;
    initialValue?: string;
    submitLabel?: string;
    onCancel?: () => void;
    isReply?: boolean;
}

export default function CommentForm({
    onSubmit,
    placeholder = 'Write a comment...',
    autoFocus = false,
    initialValue = '',
    submitLabel = 'Post',
    onCancel,
    isReply = false,
}: CommentFormProps) {
    const [content, setContent] = useState(initialValue);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Detect @mention trigger from textarea content
    const detectMention = useCallback((text: string, cursorPos: number) => {
        const textBeforeCursor = text.slice(0, cursorPos);
        // Find the last @ that's either at start or preceded by a space/newline
        const match = textBeforeCursor.match(/(?:^|[\s])@(\w*)$/);
        if (match) {
            setMentionQuery(match[1]);
        } else {
            setMentionQuery(null);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        detectMention(newContent, e.target.selectionStart);
    };

    const handleMentionSelect = (user: SearchResultUser) => {
        if (!textareaRef.current) return;

        const textarea = textareaRef.current;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = content.slice(0, cursorPos);
        const textAfterCursor = content.slice(cursorPos);

        // Replace the @query with @username
        const mentionStart = textBeforeCursor.lastIndexOf('@');
        const before = content.slice(0, mentionStart);
        const newContent = `${before}@${user.username} ${textAfterCursor}`;

        setContent(newContent);
        setMentionQuery(null);

        // Focus and set cursor position after the inserted mention
        setTimeout(() => {
            const newCursorPos = mentionStart + user.username.length + 2; // +2 for @ and space
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onSubmit(content.trim());
            setContent('');
            setMentionQuery(null);
        } catch (error) {
            console.error('Error submitting comment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Let MentionDropdown handle navigation keys when open
        if (mentionQuery !== null && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
            // Don't submit on Enter when mention dropdown is open
            if (e.key === 'Enter') {
                e.preventDefault();
            }
            return;
        }

        // Submit on Ctrl+Enter or Cmd+Enter
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit(e);
        }
        // Cancel on Escape
        if (e.key === 'Escape' && onCancel) {
            onCancel();
        }
    };

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            const cursorPos = textarea.selectionStart;
            const before = content.slice(0, cursorPos);
            const after = content.slice(cursorPos);
            const newContent = before + emojiData.emoji + after;
            setContent(newContent);
            setShowEmojiPicker(false);

            // Set cursor position after the inserted emoji
            setTimeout(() => {
                const newCursorPos = cursorPos + emojiData.emoji.length;
                textarea.focus();
                textarea.setSelectionRange(newCursorPos, newCursorPos);
            }, 0);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={`${isReply ? 'pl-12' : ''}`}>
            <div className="flex gap-3">
                <div className="flex-1">
                    <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            autoFocus={autoFocus}
                            rows={isReply ? 2 : 3}
                            className="w-full px-4 py-3 pr-12 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl
                                       text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500
                                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                                       resize-none transition-all"
                        />
                        {/* Emoji Picker Button */}
                        <button
                            type="button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                            title="Add emoji"
                        >
                            <Smile className="w-5 h-5 text-surface-500 dark:text-surface-400" />
                        </button>

                        {/* Emoji Picker Popup (lazy-loaded) */}
                        {showEmojiPicker && (
                            <>
                                <div
                                    className="fixed inset-0 z-20"
                                    onClick={() => setShowEmojiPicker(false)}
                                />
                                <div className="absolute bottom-full mb-2 right-0 z-30">
                                    <Suspense fallback={<div className="w-[350px] h-[400px] animate-pulse bg-surface-100 dark:bg-surface-800 rounded-lg" />}>
                                        <EmojiPicker
                                            onEmojiClick={handleEmojiClick}
                                            autoFocusSearch={false}
                                            theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                                        />
                                    </Suspense>
                                </div>
                            </>
                        )}

                        {mentionQuery !== null && (
                            <MentionDropdown
                                query={mentionQuery}
                                onSelect={handleMentionSelect}
                                onClose={() => setMentionQuery(null)}
                            />
                        )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-surface-400 dark:text-surface-500">
                            Press Ctrl+Enter to submit | Type @ to mention
                        </span>
                        <div className="flex gap-2">
                            {onCancel && (
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400
                                               hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={!content.trim() || isSubmitting}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white
                                           text-sm font-medium rounded-lg
                                           hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                                           transition-colors"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                {submitLabel}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}
