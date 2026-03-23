import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface MessageInputProps {
  onSend: (content: string, files?: File[]) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}

export default function MessageInput({
  onSend,
  placeholder = 'Type a message...',
  disabled = false
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setFiles(prev => [...prev, ...acceptedFiles]);
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  const handleSubmit = async () => {
    if ((!content.trim() && files.length === 0) || isSubmitting || disabled) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSend(content, files.length > 0 ? files : undefined);
      setContent('');
      setFiles([]);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="border-t border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
      {/* File previews */}
      {files.length > 0 && (
        <div className="flex gap-2 p-3 overflow-x-auto border-b border-surface-100 dark:border-surface-800">
          {files.map((file, index) => (
            <div key={index} className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-surface-400 dark:text-surface-500" />
                  </div>
                )}
              </div>
              <button
                onClick={() => removeFile(index)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-error text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div {...getRootProps()} className={`p-4 ${isDragActive ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
        <input {...getInputProps()} />
        <div className="flex items-end gap-2">
          {/* File upload button */}
          <button
            type="button"
            onClick={open}
            disabled={disabled || isSubmitting}
            className="flex-shrink-0 p-2 text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Attach images"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSubmitting}
            rows={1}
            className="flex-1 resize-none bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl px-4 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ maxHeight: '120px' }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={(!content.trim() && files.length === 0) || isSubmitting || disabled}
            className="flex-shrink-0 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Helper text */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-surface-400 dark:text-surface-500">
            Press Ctrl+Enter to send
          </span>
          {content.length > 4500 && (
            <span className={`text-xs ${content.length > 5000 ? 'text-error' : 'text-warning'}`}>
              {5000 - content.length} characters remaining
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
