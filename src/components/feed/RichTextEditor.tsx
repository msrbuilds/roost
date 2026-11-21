import { useEffect, useRef, useState } from 'react';
import DOMPurify, { type Config } from 'dompurify';
import type { EmojiClickData } from 'emoji-picker-react';
import { Bold, Italic, Link, List, ListOrdered, Smile, Underline } from 'lucide-react';

import EmojiPopover from '@/components/common/EmojiPopover';

interface RichTextEditorProps {
    value: string;
    onChange: (content: string) => void;
    placeholder?: string;
    className?: string;
    initialValue?: string;
}

const SANITIZE_OPTIONS: Config = {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'strike', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'a', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'style', 'class'],
};

export default function RichTextEditor({ value, onChange, placeholder, className = '', initialValue }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    useEffect(() => {
        if (!editorRef.current) return;
        const next = DOMPurify.sanitize(initialValue || value || '', SANITIZE_OPTIONS);
        if (editorRef.current.innerHTML !== next) editorRef.current.innerHTML = next;
    }, [initialValue, value]);

    const emitChange = () => {
        if (!editorRef.current) return;
        const sanitized = DOMPurify.sanitize(editorRef.current.innerHTML, SANITIZE_OPTIONS);
        if (editorRef.current.innerHTML !== sanitized) editorRef.current.innerHTML = sanitized;
        onChange(sanitized);
    };

    const runCommand = (command: string, commandValue?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, commandValue);
        emitChange();
    };

    const addLink = () => {
        const url = window.prompt('Enter an HTTPS URL');
        if (!url) return;
        try {
            const parsed = new URL(url);
            if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
            runCommand('createLink', parsed.toString());
        } catch {
            window.alert('Please enter a valid HTTP or HTTPS URL.');
        }
    };

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        editorRef.current?.focus();
        document.execCommand('insertText', false, emojiData.emoji);
        emitChange();
        setShowEmojiPicker(false);
    };

    const tools = [
        { label: 'Bold', icon: Bold, action: () => runCommand('bold') },
        { label: 'Italic', icon: Italic, action: () => runCommand('italic') },
        { label: 'Underline', icon: Underline, action: () => runCommand('underline') },
        { label: 'Bulleted list', icon: List, action: () => runCommand('insertUnorderedList') },
        { label: 'Numbered list', icon: ListOrdered, action: () => runCommand('insertOrderedList') },
        { label: 'Link', icon: Link, action: addLink },
    ];

    return (
        <div className={`rich-text-editor ${className} relative rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-1 p-2 pr-12 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
                {tools.map(({ label, icon: Icon, action }) => (
                    <button key={label} type="button" onClick={action} className="p-2 rounded hover:bg-surface-200 dark:hover:bg-surface-700" title={label} aria-label={label}>
                        <Icon className="w-4 h-4" />
                    </button>
                ))}
            </div>
            <button ref={emojiButtonRef} type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="absolute top-2 right-2 z-10 p-2 rounded hover:bg-surface-200 dark:hover:bg-surface-700" title="Add emoji" aria-label="Add emoji">
                <Smile className="w-5 h-5 text-surface-500 dark:text-surface-400" />
            </button>
            {showEmojiPicker && (
                <EmojiPopover anchorRef={emojiButtonRef} onClose={() => setShowEmojiPicker(false)} onEmojiClick={handleEmojiClick} />
            )}
            <div ref={editorRef} contentEditable role="textbox" aria-multiline="true" aria-label={placeholder || 'Post content'} data-placeholder={placeholder}
                onInput={emitChange} onBlur={emitChange}
                className="min-h-[200px] p-4 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-surface-400"
                suppressContentEditableWarning />
        </div>
    );
}
