import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Loader2, ThumbsUp, Heart, Flame, Hand, Brain, Laugh } from 'lucide-react';
import { getReactors } from '@/services/reaction';
import type { ReactableType, ReactionCounts, ReactorInfo } from '@/services/reaction';
import type { ReactionType } from '@/types';

interface ReactorListModalProps {
    onClose: () => void;
    reactableType: ReactableType;
    reactableId: string;
    reactionCounts: ReactionCounts;
}

const reactionConfig: Record<ReactionType, { icon: typeof ThumbsUp; label: string; color: string; activeColor: string }> = {
    like: { icon: ThumbsUp, label: 'Like', color: 'text-blue-500', activeColor: 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
    love: { icon: Heart, label: 'Love', color: 'text-red-500', activeColor: 'border-red-500 text-red-600 bg-red-50 dark:bg-red-900/30' },
    fire: { icon: Flame, label: 'Fire', color: 'text-orange-500', activeColor: 'border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-900/30' },
    clap: { icon: Hand, label: 'Clap', color: 'text-yellow-500', activeColor: 'border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30' },
    think: { icon: Brain, label: 'Think', color: 'text-purple-500', activeColor: 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-900/30' },
    haha: { icon: Laugh, label: 'Haha', color: 'text-green-500', activeColor: 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/30' },
};

type TabType = 'all' | ReactionType;

export default function ReactorListModal({
    onClose,
    reactableType,
    reactableId,
    reactionCounts,
}: ReactorListModalProps) {
    const [reactors, setReactors] = useState<ReactorInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('all');

    const loadReactors = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getReactors(reactableType, reactableId);
            setReactors(data);
        } catch (error) {
            console.error('Error loading reactors:', error);
        } finally {
            setIsLoading(false);
        }
    }, [reactableType, reactableId]);

    useEffect(() => {
        loadReactors();
    }, [loadReactors]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const filteredReactors = activeTab === 'all'
        ? reactors
        : reactors.filter((r) => r.reaction_type === activeTab);

    // Build tabs: "All" + each reaction type with count > 0
    const tabs: { key: TabType; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: reactionCounts.total },
    ];
    (Object.keys(reactionConfig) as ReactionType[]).forEach((type) => {
        if (reactionCounts[type] > 0) {
            tabs.push({ key: type, label: reactionConfig[type].label, count: reactionCounts[type] });
        }
    });

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-700 max-w-md w-full max-h-[70vh] flex flex-col animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                        Reactions
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-surface-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1.5 px-5 pb-3 overflow-x-auto">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.key;
                        const config = tab.key !== 'all' ? reactionConfig[tab.key as ReactionType] : null;
                        const Icon = config?.icon;

                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`
                                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                                    border transition-all whitespace-nowrap
                                    ${isActive
                                        ? config
                                            ? config.activeColor
                                            : 'border-primary-500 text-primary-600 bg-primary-50 dark:bg-primary-900/30'
                                        : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800'
                                    }
                                `}
                            >
                                {Icon && <Icon className={`w-4 h-4 ${config?.color}`} />}
                                {tab.key === 'all' && <span>All</span>}
                                <span className="text-xs">{tab.count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Divider */}
                <div className="border-t border-surface-100 dark:border-surface-800" />

                {/* Reactor List */}
                <div className="flex-1 overflow-y-auto px-5 py-3">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                        </div>
                    ) : filteredReactors.length === 0 ? (
                        <p className="text-center py-8 text-sm text-surface-400">No reactions yet</p>
                    ) : (
                        <div className="space-y-1">
                            {filteredReactors.map((reactor) => {
                                const config = reactionConfig[reactor.reaction_type];
                                const Icon = config.icon;

                                return (
                                    <Link
                                        key={`${reactor.user_id}-${reactor.reaction_type}`}
                                        to={`/profile/${reactor.user.username}`}
                                        onClick={onClose}
                                        className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                                    >
                                        {/* Avatar */}
                                        {reactor.user.avatar_url ? (
                                            <img
                                                src={reactor.user.avatar_url}
                                                alt={reactor.user.display_name}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium">
                                                {reactor.user.display_name?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                        )}

                                        {/* Name */}
                                        <span className="flex-1 font-medium text-surface-900 dark:text-surface-50 text-sm truncate">
                                            {reactor.user.display_name}
                                        </span>

                                        {/* Reaction Icon */}
                                        <div className="w-7 h-7 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                                            <Icon className={`w-4 h-4 ${config.color}`} />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
