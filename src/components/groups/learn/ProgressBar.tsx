interface ProgressBarProps {
    value: number; // 0-100
    size?: 'sm' | 'md';
    showLabel?: boolean;
}

export default function ProgressBar({ value, size = 'sm', showLabel = false }: ProgressBarProps) {
    const clampedValue = Math.min(100, Math.max(0, value));
    const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

    return (
        <div className="flex items-center gap-2">
            <div className={`flex-1 ${height} bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden`}>
                <div
                    className={`${height} rounded-full transition-all duration-300 ${
                        clampedValue === 100
                            ? 'bg-green-500'
                            : 'bg-primary-600'
                    }`}
                    style={{ width: `${clampedValue}%` }}
                />
            </div>
            {showLabel && (
                <span className="text-xs font-medium text-surface-500 dark:text-surface-400 tabular-nums">
                    {clampedValue}%
                </span>
            )}
        </div>
    );
}
