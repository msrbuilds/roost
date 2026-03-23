import { format, isToday, isYesterday } from 'date-fns';
import type { MessageWithSender } from '../../services/message';
import { Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';

interface MessageBubbleProps {
  message: MessageWithSender;
  isSent: boolean;
  showTimestamp?: boolean;
}

export default function MessageBubble({ message, isSent, showTimestamp = true }: MessageBubbleProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date);

    if (isToday(messageDate)) {
      return format(messageDate, 'h:mm a');
    } else if (isYesterday(messageDate)) {
      return `Yesterday ${format(messageDate, 'h:mm a')}`;
    } else {
      return format(messageDate, 'MMM d, h:mm a');
    }
  };

  const hasAttachments = message.assets && message.assets.length > 0;

  return (
    <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[70%] ${isSent ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-2 ${isSent
            ? 'bg-primary-600 text-white'
            : 'bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-surface-100'
            }`}
        >
          {/* Message content */}
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

          {/* Attachments */}
          {hasAttachments && (
            <div className="mt-2 space-y-2">
              {message.assets!.map((asset) => (
                <div key={asset.id}>
                  {asset.asset_type === 'image' ? (
                    <button
                      onClick={() => setSelectedImage(asset.file_url)}
                      className="block rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                    >
                      <img
                        src={asset.file_url}
                        alt={asset.filename || 'Attachment'}
                        className="max-w-full h-auto max-h-64 object-cover"
                      />
                    </button>
                  ) : (
                    <a
                      href={asset.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 p-2 rounded-lg ${isSent ? 'bg-primary-700' : 'bg-surface-50 dark:bg-surface-700'
                        } hover:opacity-80 transition-opacity`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-xs truncate">{asset.filename ?? 'File'}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp */}
        {showTimestamp && (
          <span className="text-xs text-surface-400 dark:text-surface-500 px-1">
            {formatMessageTime(message.created_at || new Date().toISOString())}
          </span>
        )}
      </div>

      {/* Lightbox for images */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
