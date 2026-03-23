import { Trophy } from 'lucide-react';

interface UserRankBadgeProps {
    rank: number;
    size?: 'sm' | 'md' | 'lg';
}

export default function UserRankBadge({ rank, size = 'md' }: UserRankBadgeProps) {
    // Size configurations
    const sizeClasses = {
        sm: 'w-6 h-6 text-xs',
        md: 'w-8 h-8 text-sm',
        lg: 'w-12 h-12 text-base',
    };

    const iconSizes = {
        sm: 12,
        md: 16,
        lg: 20,
    };

    // Color coding based on rank
    const getBadgeColor = () => {
        if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white'; // Gold
        if (rank <= 3) return 'bg-gradient-to-br from-gray-300 to-gray-500 text-white'; // Silver
        if (rank <= 10) return 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'; // Bronze
        if (rank <= 50) return 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'; // Blue
        return 'bg-gray-200 dark:bg-surface-700 text-gray-700 dark:text-gray-300'; // Default
    };

    return (
        <div
            className={`
                ${sizeClasses[size]}
                ${getBadgeColor()}
                rounded-full
                flex items-center justify-center
                font-bold
                shadow-md
                relative
            `}
            title={`Rank #${rank}`}
        >
            {rank === 1 && (
                <Trophy
                    size={iconSizes[size]}
                    className="absolute -top-1 -right-1 text-yellow-300"
                    strokeWidth={3}
                />
            )}
            #{rank}
        </div>
    );
}
