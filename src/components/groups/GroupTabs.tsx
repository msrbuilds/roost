import { groupTabs } from './groupTabsConfig';

export type TabValue = 'feed' | 'assets' | 'recordings';

interface GroupTabsProps {
    activeTab: TabValue;
    onTabChange: (tab: TabValue) => void;
    variant?: 'full-width' | 'inline';
}

export default function GroupTabs({ activeTab, onTabChange, variant = 'full-width' }: GroupTabsProps) {
    const tabButtons = groupTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.value;

        return (
            <button
                key={tab.value}
                onClick={() => onTabChange(tab.value)}
                className={`
                    flex items-center gap-2 px-4 ${variant === 'full-width' ? 'py-4' : 'py-3'} text-sm font-medium
                    border-b-2 transition-colors whitespace-nowrap
                    ${isActive
                        ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:border-surface-300 dark:hover:border-surface-600'
                    }
                `}
            >
                <Icon className="w-4 h-4" />
                {tab.label}
            </button>
        );
    });

    if (variant === 'inline') {
        return (
            <div className="flex gap-1">
                {tabButtons}
            </div>
        );
    }

    // Full-width variant (default)
    return (
        <div className="border-b border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
                    {tabButtons}
                </div>
            </div>
        </div>
    );
}
