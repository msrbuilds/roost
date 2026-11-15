import { useState } from 'react';

/** Local initials keep members without photos independent of third-party services. */
export function MemberAvatar({ name, src, className = 'w-10 h-10' }: { name: string; src?: string | null; className?: string }) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    return src && src !== failedSrc ? <img src={src} alt={name} onError={() => setFailedSrc(src)} className={`${className} rounded-full object-cover shrink-0`} />
        : <span aria-hidden="true" className={`${className} rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold shrink-0`}>{name.trim().charAt(0).toUpperCase() || '?'}</span>;
}
