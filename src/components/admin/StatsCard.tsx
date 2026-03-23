import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        label: string;
        isPositive?: boolean;
    };
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo';
    children?: ReactNode;
}

const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
};

export default function StatsCard({
    title,
    value,
    icon: Icon,
    trend,
    color = 'blue',
    children,
}: StatsCardProps) {
    return (
        <div className="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-gray-100 dark:border-surface-700 p-6">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                    {trend && (
                        <p className="mt-2 text-sm">
                            <span
                                className={`font-medium ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                    }`}
                            >
                                {trend.isPositive ? '+' : ''}{trend.value}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 ml-1">{trend.label}</span>
                        </p>
                    )}
                </div>
                <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            {children}
        </div>
    );
}
