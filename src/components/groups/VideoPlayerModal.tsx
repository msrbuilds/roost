import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface VideoPlayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    videoPlatform: 'youtube' | 'vimeo';
    videoId: string;
}

export default function VideoPlayerModal({
    isOpen,
    onClose,
    title,
    videoPlatform,
    videoId,
}: VideoPlayerModalProps) {
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

    const getEmbedUrl = () => {
        if (videoPlatform === 'youtube') {
            return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        } else if (videoPlatform === 'vimeo') {
            return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
        }
        return null;
    };

    const embedUrl = getEmbedUrl();

    if (!embedUrl) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
            onClick={onClose}
        >
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                aria-label="Close video"
            >
                <X className="w-6 h-6 text-white" />
            </button>

            {/* Title */}
            <div className="absolute top-4 left-4 right-16">
                <h3 className="text-white text-lg font-medium truncate">{title}</h3>
            </div>

            {/* Video container */}
            <div
                className="w-full max-w-5xl mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
                    <iframe
                        src={embedUrl}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={title}
                    />
                </div>
            </div>
        </div>,
        document.body
    );
}
