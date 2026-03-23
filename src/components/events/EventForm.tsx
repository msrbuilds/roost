import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import type { Event } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { getUserGroups, type GroupWithDetails } from '../../services/group';

interface EventFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: EventFormData) => Promise<void>;
    initialData?: Partial<Event> | any;
    groupId?: string;
}

export interface EventFormData {
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    location?: string;
    meeting_url?: string;
    is_virtual: boolean;
    group_id?: string;
}

export default function EventForm({ isOpen, onClose, onSubmit, initialData, groupId }: EventFormProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [userGroups, setUserGroups] = useState<GroupWithDetails[]>([]);
    const [formData, setFormData] = useState<EventFormData>({
        title: initialData?.title || '',
        description: initialData?.description || '',
        start_time: initialData?.start_time ? format(new Date(initialData.start_time), "yyyy-MM-dd'T'HH:mm") : '',
        end_time: initialData?.end_time ? format(new Date(initialData.end_time), "yyyy-MM-dd'T'HH:mm") : '',
        location: initialData?.location || '',
        meeting_url: initialData?.meeting_url || '',
        is_virtual: initialData?.is_virtual ?? false,
        group_id: groupId || initialData?.group_id || undefined,
    });

    useEffect(() => {
        const fetchGroups = async () => {
            if (user) {
                try {
                    const groups = await getUserGroups(user.id);
                    setUserGroups(groups);
                } catch (err) {
                    console.error('Failed to load user groups:', err);
                }
            }
        };

        if (isOpen) {
            fetchGroups();
        }
    }, [user, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                title: initialData?.title || '',
                description: initialData?.description || '',
                start_time: initialData?.start_time ? format(new Date(initialData.start_time), "yyyy-MM-dd'T'HH:mm") : '',
                end_time: initialData?.end_time ? format(new Date(initialData.end_time), "yyyy-MM-dd'T'HH:mm") : '',
                location: initialData?.location || '',
                meeting_url: initialData?.meeting_url || '',
                is_virtual: initialData?.is_virtual ?? false,
                group_id: groupId || initialData?.group_id || undefined,
            });
        }
    }, [initialData, groupId, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;

        try {
            setLoading(true);

            // Sanitize data: convert empty strings to undefined/null for optional fields
            const cleanData = {
                ...formData,
                group_id: formData.group_id || undefined, // Send undefined if empty string
                location: formData.location || undefined,
                meeting_url: formData.meeting_url || undefined
            };

            await onSubmit(cleanData);
            onClose();
        } catch (err) {
            console.error('Form submission error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof EventFormData, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl md:max-h-[90vh] bg-white dark:bg-surface-900 rounded-lg shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-surface-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {initialData ? 'Edit Event' : 'Create New Event'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Group Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Group (Optional)
                        </label>
                        <select
                            value={formData.group_id || ''}
                            onChange={(e) => handleChange('group_id', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            <option value="">General (Community Event)</option>
                            {userGroups.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Select "General" for community-wide events, or choose a specific group.
                        </p>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Event Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Monthly Team Meetup"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Tell attendees what to expect..."
                        />
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Start Date & Time <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.start_time}
                                onChange={(e) => handleChange('start_time', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                End Date & Time <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.end_time}
                                onChange={(e) => handleChange('end_time', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Virtual Toggle */}
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-surface-800 rounded-lg">
                        <input
                            type="checkbox"
                            id="is_virtual"
                            checked={formData.is_virtual}
                            onChange={(e) => handleChange('is_virtual', e.target.checked)}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                        <label htmlFor="is_virtual" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            This is a virtual event
                        </label>
                    </div>

                    {/* Location OR Meeting URL */}
                    {formData.is_virtual ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Meeting URL
                            </label>
                            <input
                                type="url"
                                value={formData.meeting_url}
                                onChange={(e) => handleChange('meeting_url', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="https://zoom.us/j/123456789"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Optional: Add after event creation or closer to event date
                            </p>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Location
                            </label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => handleChange('location', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="123 Main St, City, State"
                            />
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-surface-700 flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 dark:border-surface-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : initialData ? 'Update Event' : 'Create Event'}
                    </button>
                </div>
            </div>
        </>
    );
}
