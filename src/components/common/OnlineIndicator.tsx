interface OnlineIndicatorProps {
    isOnline: boolean;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
};

export default function OnlineIndicator({
    isOnline,
    size = 'sm',
    showLabel = false,
}: OnlineIndicatorProps) {
    return (
        <div className="flex items-center gap-1.5">
            <div
                className={`
          ${sizeClasses[size]} rounded-full
          ${isOnline ? 'bg-green-500' : 'bg-surface-300 dark:bg-surface-600'}
        `}
            />
            {showLabel && (
                <span className={`text-xs ${isOnline ? 'text-green-600 dark:text-green-400' : 'text-surface-400 dark:text-surface-500'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                </span>
            )}
        </div>
    );
}
