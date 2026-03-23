import { Link } from 'react-router-dom';
import { ChevronUp, Star, MessageSquare } from 'lucide-react';
import type { ShowcaseCardData } from '@/types/showcase';
import { SHOWCASE_CATEGORY_INFO } from '@/types/showcase';

interface ShowcaseCardProps {
    showcase: ShowcaseCardData;
    onVote?: (showcaseId: string) => void;
    isVoting?: boolean;
}

export default function ShowcaseCard({ showcase, onVote, isVoting }: ShowcaseCardProps) {
    const categoryInfo = SHOWCASE_CATEGORY_INFO[showcase.category];

    const handleVote = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onVote?.(showcase.id);
    };

    return (
        <Link
            to={`/showcase/${showcase.id}`}
            className="card p-4 shadow-none hover:shadow-elevated transition-all duration-200 group block"
        >
            {/* Thumbnail */}
            <div className="relative aspect-video mb-4 rounded-lg overflow-hidden bg-surface-100 dark:bg-surface-800">
                {showcase.thumbnail_url ? (
                    <img
                        src={showcase.thumbnail_url}
                        alt={showcase.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-400">
                        <span className="text-4xl font-bold">{showcase.title.charAt(0)}</span>
                    </div>
                )}
                {/* Featured badge */}
                {showcase.is_featured && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded-full">
                        Featured
                    </div>
                )}
                {/* Category badge */}
                <div
                    className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full backdrop-blur-sm"
                    style={{ backgroundColor: categoryInfo.color, color: 'white' }}
                >
                    {categoryInfo.label}
                </div>
            </div>

            {/* Content */}
            <div className="flex gap-3 items-center">
                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-surface-900 dark:text-surface-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {showcase.title}
                    </h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">
                        {showcase.tagline}
                    </p>

                    {/* Tags */}
                    {showcase.tags && showcase.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {showcase.tags.slice(0, 3).map((tag) => (
                                <span
                                    key={tag.id}
                                    className="text-xs px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                                >
                                    {tag.name}
                                </span>
                            ))}
                            {showcase.tags.length > 3 && (
                                <span className="text-xs text-surface-400">+{showcase.tags.length - 3}</span>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-4 mt-3">
                        {/* Author */}
                        <div className="flex items-center gap-2 min-w-0">
                            {showcase.author.avatar_url ? (
                                <img
                                    src={showcase.author.avatar_url}
                                    alt={showcase.author.display_name}
                                    className="w-5 h-5 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-xs text-primary-600 dark:text-primary-400 font-medium">
                                    {showcase.author.display_name?.charAt(0) || '?'}
                                </div>
                            )}
                            <span className="text-xs text-surface-500 dark:text-surface-400 truncate">
                                {showcase.author.display_name}
                            </span>
                        </div>

                        {/* Reviews */}
                        {showcase.review_count > 0 && (
                            <div className="flex items-center gap-1 text-xs text-surface-500 dark:text-surface-400">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>{showcase.review_count}</span>
                            </div>
                        )}

                        {/* Rating */}
                        {showcase.average_rating > 0 && (
                            <div className="flex items-center gap-1 text-xs text-amber-500">
                                <Star className="w-3.5 h-3.5 fill-current" />
                                <span>{showcase.average_rating.toFixed(1)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Vote button - right side, vertically centered */}
                <button
                    onClick={handleVote}
                    disabled={isVoting}
                    className={`
                        flex flex-col items-center justify-center w-14 h-14 rounded-lg border transition-all flex-shrink-0
                        ${showcase.user_has_voted
                            ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400'
                            : 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400'
                        }
                        ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    <ChevronUp className={`w-5 h-5 -mb-0.5 ${showcase.user_has_voted ? 'text-primary-600 dark:text-primary-400' : ''}`} />
                    <span className="text-sm font-semibold">{showcase.vote_count}</span>
                </button>
            </div>
        </Link>
    );
}
