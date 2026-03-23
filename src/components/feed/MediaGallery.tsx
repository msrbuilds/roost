import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Asset } from '@/services/asset';

interface MediaGalleryProps {
    assets: Asset[];
}

export default function MediaGallery({ assets }: MediaGalleryProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (selectedIndex === null) return;

        switch (e.key) {
            case 'Escape':
                setSelectedIndex(null);
                break;
            case 'ArrowLeft':
                setSelectedIndex((prev) => (prev! === 0 ? assets.length - 1 : prev! - 1));
                break;
            case 'ArrowRight':
                setSelectedIndex((prev) => (prev! === assets.length - 1 ? 0 : prev! + 1));
                break;
        }
    }, [selectedIndex, assets.length]);

    useEffect(() => {
        if (selectedIndex !== null) {
            document.addEventListener('keydown', handleKeyDown);
            // Prevent body scroll when lightbox is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [selectedIndex, handleKeyDown]);

    if (assets.length === 0) return null;

    const goToPrevious = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIndex((prev) => (prev! === 0 ? assets.length - 1 : prev! - 1));
    };

    const goToNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIndex((prev) => (prev! === assets.length - 1 ? 0 : prev! + 1));
    };

    const closeLightbox = () => {
        setSelectedIndex(null);
    };

    return (
        <div className="mt-4 space-y-4">
            {/* Grid Display */}
            <div className={`grid gap-2 ${assets.length === 1 ? 'grid-cols-1' :
                assets.length === 2 ? 'grid-cols-2' :
                    assets.length === 3 ? 'grid-cols-3' :
                        'grid-cols-2 sm:grid-cols-3'
                }`}>
                {assets.slice(0, 6).map((asset, index) => (
                    <div
                        key={asset.id}
                        className={`relative rounded-xl overflow-hidden cursor-pointer bg-surface-100 border border-surface-200 
                            hover:opacity-90 hover:scale-[1.02] transition-all duration-200
                            ${assets.length === 1 ? 'aspect-auto max-h-[500px]' : 'aspect-square'}
                            ${index === 5 && assets.length > 6 ? 'relative' : ''}`}
                        onClick={() => setSelectedIndex(index)}
                    >
                        {asset.asset_type === 'image' ? (
                            <img
                                src={asset.file_url}
                                alt={asset.filename}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        ) : asset.asset_type === 'video' ? (
                            <div className="w-full h-full flex items-center justify-center bg-surface-900">
                                <video
                                    src={asset.file_url}
                                    className="w-full h-full object-cover opacity-70"
                                    muted
                                    preload="metadata"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-lg hover:bg-white/30 transition-colors">
                                        <Play className="w-6 h-6 ml-1" fill="currentColor" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center p-4 bg-surface-50">
                                <span className="text-xs text-surface-500 text-center truncate px-2">
                                    {asset.filename}
                                </span>
                            </div>
                        )}

                        {/* Show "+N more" overlay on last visible item if there are more */}
                        {index === 5 && assets.length > 6 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-white text-xl font-semibold">
                                    +{assets.length - 6} more
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Lightbox / Modal */}
            {selectedIndex !== null && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-fadeIn"
                    onClick={closeLightbox}
                >
                    {/* Close button */}
                    <button
                        onClick={closeLightbox}
                        className="absolute top-4 right-4 z-10 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
                        aria-label="Close"
                    >
                        <X className="w-8 h-8" />
                    </button>

                    {/* Navigation buttons */}
                    {assets.length > 1 && (
                        <>
                            <button
                                onClick={goToPrevious}
                                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:scale-110"
                                aria-label="Previous image"
                            >
                                <ChevronLeft className="w-8 h-8" />
                            </button>
                            <button
                                onClick={goToNext}
                                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:scale-110"
                                aria-label="Next image"
                            >
                                <ChevronRight className="w-8 h-8" />
                            </button>
                        </>
                    )}

                    {/* Media content */}
                    <div
                        className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {assets[selectedIndex].asset_type === 'image' ? (
                            <img
                                src={assets[selectedIndex].file_url}
                                alt={assets[selectedIndex].filename}
                                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-scaleIn"
                            />
                        ) : (
                            <video
                                src={assets[selectedIndex].file_url}
                                controls
                                autoPlay
                                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
                            />
                        )}
                    </div>

                    {/* Footer info */}
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                        <p className="text-white/60 text-sm">
                            {selectedIndex + 1} of {assets.length}
                        </p>
                        <p className="text-white/40 text-xs mt-1">
                            Press arrow keys to navigate • ESC to close
                        </p>
                    </div>

                    {/* Thumbnail strip for multiple images */}
                    {assets.length > 1 && (
                        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/50 rounded-lg backdrop-blur-sm max-w-[80vw] overflow-x-auto">
                            {assets.map((asset, idx) => (
                                <button
                                    key={asset.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedIndex(idx);
                                    }}
                                    className={`flex-shrink-0 w-12 h-12 rounded-md overflow-hidden transition-all
                                        ${idx === selectedIndex
                                            ? 'ring-2 ring-primary-500 scale-110'
                                            : 'opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    {asset.asset_type === 'image' ? (
                                        <img
                                            src={asset.file_url}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-surface-800 flex items-center justify-center">
                                            <Play className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Animation styles */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
                .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
            `}</style>
        </div>
    );
}
