interface VideoEmbedProps {
    url: string;
}

export default function VideoEmbed({ url }: VideoEmbedProps) {
    const getEmbedUrl = (url: string) => {
        // YouTube
        const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/);
        if (ytMatch && ytMatch[1]) {
            const id = ytMatch[1].split('&')[0];
            return `https://www.youtube.com/embed/${id}`;
        }

        // Vimeo
        const vimeoMatch = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(.+)/);
        if (vimeoMatch && vimeoMatch[1]) {
            return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }

        return null;
    };

    const embedUrl = getEmbedUrl(url);

    if (!embedUrl) return null;

    return (
        <div className="mt-4 relative aspect-video rounded-xl overflow-hidden border border-surface-200 bg-black shadow-sm">
            <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Video embed"
            />
        </div>
    );
}

/**
 * Helper to detect video links in text
 */
export function detectVideoLinks(text: string): string[] {
    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?[a-zA-Z0-9_-]{11}(?:\S+)?/g;
    const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/[0-9]+(?:\S+)?/g;

    const matches = [...(text.match(ytRegex) || []), ...(text.match(vimeoRegex) || [])];

    // Return unique matches
    return Array.from(new Set(matches));
}
