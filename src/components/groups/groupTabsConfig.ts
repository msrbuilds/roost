import { BookOpen, FileText, Video } from 'lucide-react';
import type { TabValue } from './GroupTabs';

export interface Tab {
    value: TabValue;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

export const groupTabs: Tab[] = [
    { value: 'feed', label: 'Feed', icon: BookOpen },
    { value: 'assets', label: 'Assets', icon: FileText },
    { value: 'recordings', label: 'Recordings', icon: Video },
];
