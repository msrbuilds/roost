import { useRef, useEffect, useState, lazy, Suspense } from 'react';
import ReactQuill from 'react-quill-new';
import DOMPurify from 'dompurify';
import type { EmojiClickData } from 'emoji-picker-react';
import { Theme } from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import 'react-quill-new/dist/quill.snow.css';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

interface RichTextEditorProps {
    value: string;
    onChange: (content: string) => void;
    placeholder?: string;
    className?: string;
    initialValue?: string;
}

const modules = {
    toolbar: [
        [{ header: [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'clean'],
    ],
    clipboard: {
        matchVisual: false,
    },
};

const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'link',
];

export default function RichTextEditor({
    value,
    onChange,
    placeholder,
    className = '',
    initialValue,
}: RichTextEditorProps) {
    const quillRef = useRef<ReactQuill>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Initialize editor with content after mount
    useEffect(() => {
        const contentToSet = initialValue || value;
        if (!contentToSet || contentToSet === '<p><br></p>') {
            return;
        }

        // Wait for Quill to be fully ready
        const checkReady = setInterval(() => {
            if (quillRef.current) {
                const editor = quillRef.current.getEditor();
                if (editor) {
                    clearInterval(checkReady);
                    // Sanitize before injecting into the editor
                    const sanitized = DOMPurify.sanitize(contentToSet, {
                        ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'strike',
                            'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
                            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span'],
                        ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
                        FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
                        FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
                    });
                    editor.clipboard.dangerouslyPasteHTML(sanitized);
                }
            }
        }, 10);

        // Cleanup - stop checking after 500ms
        const timeout = setTimeout(() => {
            clearInterval(checkReady);
        }, 500);

        return () => {
            clearInterval(checkReady);
            clearTimeout(timeout);
        };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        if (quillRef.current) {
            const editor = quillRef.current.getEditor();
            const cursorPosition = editor.getSelection()?.index || 0;
            editor.insertText(cursorPosition, emojiData.emoji);
            editor.setSelection(cursorPosition + emojiData.emoji.length, 0);
            setShowEmojiPicker(false);
        }
    };

    return (
        <div className={`rich-text-editor ${className} relative`}>
            {/* Emoji Picker Button */}
            <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute top-2 right-2 z-10 p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
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
                    <div className="absolute top-12 right-2 z-30">
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

            <ReactQuill
                ref={quillRef}
                theme="snow"
                value={value || ''}
                onChange={onChange}
                modules={modules}
                formats={formats}
                placeholder={placeholder}
                className="bg-white dark:bg-surface-900 rounded-xl overflow-hidden"
            />
            <style>{`
        .rich-text-editor .ql-toolbar.ql-snow {
          border-top-left-radius: 0.75rem;
          border-top-right-radius: 0.75rem;
          border-color: #e2e8f0;
          background-color: #f8fafc;
        }
        .dark .rich-text-editor .ql-toolbar.ql-snow {
          border-color: #404040;
          background-color: #262626;
        }
        .rich-text-editor .ql-container.ql-snow {
          border-bottom-left-radius: 0.75rem;
          border-bottom-right-radius: 0.75rem;
          border-color: #e2e8f0;
          min-height: 200px;
          font-family: inherit;
          font-size: 1rem;
          background-color: #ffffff;
        }
        .dark .rich-text-editor .ql-container.ql-snow {
          border-color: #404040;
          background-color: #171717;
        }
        .rich-text-editor .ql-editor {
          min-height: 200px;
          color: #0f172a;
        }
        .dark .rich-text-editor .ql-editor {
          color: #fafafa;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: #94a3b8;
          font-style: normal;
        }
        .dark .rich-text-editor .ql-editor.ql-blank::before {
          color: #64748b;
        }
        .dark .rich-text-editor .ql-toolbar .ql-stroke {
          stroke: #a3a3a3;
        }
        .dark .rich-text-editor .ql-toolbar .ql-fill {
          fill: #a3a3a3;
        }
        .dark .rich-text-editor .ql-toolbar .ql-picker-label {
          color: #a3a3a3;
        }
      `}</style>
        </div>
    );
}
