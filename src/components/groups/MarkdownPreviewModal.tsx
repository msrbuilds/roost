import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2, FileText } from 'lucide-react';
import DOMPurify from 'dompurify';

interface MarkdownPreviewModalProps {
    isOpen: boolean;
    fileUrl: string;
    fileName: string;
    onClose: () => void;
}

export default function MarkdownPreviewModal({
    isOpen,
    fileUrl,
    fileName,
    onClose,
}: MarkdownPreviewModalProps) {
    const [content, setContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && fileUrl) {
            fetchContent();
        }
        return () => {
            setContent('');
            setError(null);
        };
    }, [isOpen, fileUrl]);

    const fetchContent = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error('Failed to fetch file');
            }
            const text = await response.text();
            setContent(text);
        } catch (err) {
            console.error('Error fetching markdown:', err);
            setError('Failed to load file content');
        } finally {
            setIsLoading(false);
        }
    };

    const escapeHtml = (text: string): string => {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    const renderMarkdown = (md: string): string => {
        const lines = md.split('\n');
        const result: string[] = [];
        let inCodeBlock = false;
        let codeBlockContent: string[] = [];
        let inList = false;
        let listType: 'ul' | 'ol' | null = null;

        const closeList = () => {
            if (inList && listType) {
                result.push(listType === 'ul' ? '</ul>' : '</ol>');
                inList = false;
                listType = null;
            }
        };

        const processInline = (text: string): string => {
            // Process inline code first (to prevent other formatting inside)
            let processed = text.replace(/`([^`]+)`/g, (_, code) => {
                return `<code class="px-1.5 py-0.5 bg-surface-100 dark:bg-surface-800 rounded text-sm font-mono">${escapeHtml(code)}</code>`;
            });

            // Escape HTML in remaining text (but not the code tags we just added)
            const parts = processed.split(/(<code[^>]*>.*?<\/code>)/g);
            processed = parts.map(part => {
                if (part.startsWith('<code')) {
                    return part;
                }
                return escapeHtml(part);
            }).join('');

            // Bold and italic
            processed = processed
                .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
                .replace(/__(.+?)__/g, '<strong>$1</strong>')
                .replace(/_([^_]+)_/g, '<em>$1</em>');

            // Links (reject javascript: and other dangerous protocols)
            processed = processed.replace(
                /\[([^\]]+)\]\(([^)]+)\)/g,
                (_match: string, text: string, href: string) => {
                    const trimmedHref = href.trim().toLowerCase();
                    if (trimmedHref.startsWith('javascript:') || trimmedHref.startsWith('data:') || trimmedHref.startsWith('vbscript:')) {
                        return text;
                    }
                    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">${text}</a>`;
                }
            );

            return processed;
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Handle fenced code blocks
            if (trimmed.startsWith('```')) {
                if (inCodeBlock) {
                    // End code block
                    result.push(
                        `<pre class="bg-surface-100 dark:bg-surface-800 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm font-mono text-surface-800 dark:text-surface-200">${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`
                    );
                    codeBlockContent = [];
                    inCodeBlock = false;
                } else {
                    // Start code block
                    closeList();
                    inCodeBlock = true;
                }
                continue;
            }

            if (inCodeBlock) {
                codeBlockContent.push(line);
                continue;
            }

            // Empty line
            if (!trimmed) {
                closeList();
                continue;
            }

            // Headers
            const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (headerMatch) {
                closeList();
                const level = headerMatch[1].length;
                const text = processInline(headerMatch[2]);
                const styles: Record<number, string> = {
                    1: 'text-3xl font-bold mt-8 mb-4',
                    2: 'text-2xl font-bold mt-6 mb-3',
                    3: 'text-xl font-semibold mt-5 mb-3',
                    4: 'text-lg font-semibold mt-4 mb-2',
                    5: 'text-base font-semibold mt-4 mb-2',
                    6: 'text-sm font-semibold mt-3 mb-2',
                };
                result.push(`<h${level} class="${styles[level]} text-surface-900 dark:text-surface-50">${text}</h${level}>`);
                continue;
            }

            // Horizontal rule
            if (/^(---|\*\*\*|___)$/.test(trimmed)) {
                closeList();
                result.push('<hr class="my-6 border-surface-200 dark:border-surface-700" />');
                continue;
            }

            // Blockquote
            if (trimmed.startsWith('>')) {
                closeList();
                const quoteText = processInline(trimmed.replace(/^>\s*/, ''));
                result.push(
                    `<blockquote class="border-l-4 border-primary-500 pl-4 py-2 my-3 bg-surface-50 dark:bg-surface-800/50 rounded-r text-surface-600 dark:text-surface-400">${quoteText}</blockquote>`
                );
                continue;
            }

            // Unordered list
            const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
            if (ulMatch) {
                if (!inList || listType !== 'ul') {
                    closeList();
                    result.push('<ul class="my-3 space-y-1 list-disc list-inside">');
                    inList = true;
                    listType = 'ul';
                }
                result.push(`<li class="text-surface-700 dark:text-surface-300">${processInline(ulMatch[1])}</li>`);
                continue;
            }

            // Ordered list
            const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
            if (olMatch) {
                if (!inList || listType !== 'ol') {
                    closeList();
                    result.push('<ol class="my-3 space-y-1 list-decimal list-inside">');
                    inList = true;
                    listType = 'ol';
                }
                result.push(`<li class="text-surface-700 dark:text-surface-300">${processInline(olMatch[1])}</li>`);
                continue;
            }

            // Regular paragraph
            closeList();
            result.push(`<p class="my-3 leading-relaxed">${processInline(trimmed)}</p>`);
        }

        // Close any open code block
        if (inCodeBlock && codeBlockContent.length > 0) {
            result.push(
                `<pre class="bg-surface-100 dark:bg-surface-800 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm font-mono text-surface-800 dark:text-surface-200">${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`
            );
        }

        closeList();
        return result.join('\n');
    };

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white dark:bg-surface-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700 flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                        <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-50 truncate">
                            {fileName}
                        </h2>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                            href={fileUrl}
                            download={fileName}
                            className="p-2 text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            title="Download"
                        >
                            <Download className="w-5 h-5" />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            title="Close"
                        >
                            <X className="w-5 h-5 text-surface-500 dark:text-surface-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    ) : (
                        <article
                            className="max-w-none text-surface-700 dark:text-surface-300"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(content), {
                                ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'strike',
                                    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
                                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'hr'],
                                ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
                                FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
                                FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
                            }) }}
                        />
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
