import { useEffect, useState } from 'react';
import {
    Plus,
    Edit2,
    Trash2,
    X,
    Check,
    Megaphone,
    AlertCircle,
    AlertTriangle,
    CheckCircle,
    Info,
    Globe,
    Users,
} from 'lucide-react';
import {
    getAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    getGroups,
} from '../../services';
import type { Announcement, AnnouncementType, AnnouncementScope } from '../../services';
import type { Group } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';

const TYPE_OPTIONS: { value: AnnouncementType; label: string; icon: typeof Info; color: string }[] = [
    { value: 'info', label: 'Info', icon: Info, color: 'text-blue-500' },
    { value: 'success', label: 'Success', icon: CheckCircle, color: 'text-green-500' },
    { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'text-yellow-500' },
    { value: 'error', label: 'Error', icon: AlertCircle, color: 'text-red-500' },
];

interface AnnouncementFormData {
    title: string;
    content: string;
    type: AnnouncementType;
    scope: AnnouncementScope;
    group_id: string;
    is_dismissible: boolean;
    starts_at: string;
    expires_at: string;
}

const defaultForm: AnnouncementFormData = {
    title: '',
    content: '',
    type: 'info',
    scope: 'global',
    group_id: '',
    is_dismissible: true,
    starts_at: '',
    expires_at: '',
};

export default function AdminAnnouncements() {
    const { user } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<AnnouncementFormData>(defaultForm);
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [announcementsData, groupsData] = await Promise.all([
                getAnnouncements({ includeInactive: true }),
                getGroups({}),
            ]);
            setAnnouncements(announcementsData);
            setGroups(groupsData.groups);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreate = () => {
        setForm(defaultForm);
        setEditingId(null);
        setShowForm(true);
    };

    const handleEdit = (announcement: Announcement) => {
        setForm({
            title: announcement.title,
            content: announcement.content,
            type: announcement.type,
            scope: announcement.scope,
            group_id: announcement.group_id || '',
            is_dismissible: announcement.is_dismissible,
            starts_at: announcement.starts_at ? new Date(announcement.starts_at).toISOString().slice(0, 16) : '',
            expires_at: announcement.expires_at ? new Date(announcement.expires_at).toISOString().slice(0, 16) : '',
        });
        setEditingId(announcement.id);
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.title.trim() || !form.content.trim() || !user) return;
        setSaving(true);
        try {
            if (editingId) {
                await updateAnnouncement(editingId, {
                    title: form.title,
                    content: form.content,
                    type: form.type,
                    scope: form.scope,
                    group_id: form.scope === 'group' ? form.group_id : null,
                    is_dismissible: form.is_dismissible,
                    starts_at: form.starts_at || null,
                    expires_at: form.expires_at || null,
                });
            } else {
                await createAnnouncement({
                    title: form.title,
                    content: form.content,
                    type: form.type,
                    scope: form.scope,
                    group_id: form.scope === 'group' ? form.group_id || null : null,
                    is_dismissible: form.is_dismissible,
                    starts_at: form.starts_at || null,
                    expires_at: form.expires_at || null,
                    created_by: user.id,
                });
            }
            setShowForm(false);
            setEditingId(null);
            setForm(defaultForm);
            loadData();
        } catch (err) {
            console.error('Failed to save announcement:', err);
            alert('Failed to save announcement');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (announcement: Announcement) => {
        try {
            await updateAnnouncement(announcement.id, {
                is_active: !announcement.is_active,
            });
            loadData();
        } catch (err) {
            console.error('Failed to toggle announcement:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return;
        try {
            await deleteAnnouncement(id);
            loadData();
        } catch (err) {
            console.error('Failed to delete announcement:', err);
        }
    };


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Announcements</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage site-wide and group announcements</p>
                </div>
                {!showForm && (
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        New Announcement
                    </button>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-gray-100 dark:border-surface-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {editingId ? 'Edit Announcement' : 'New Announcement'}
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="Announcement title"
                                className="w-full px-4 py-2 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
                            <textarea
                                value={form.content}
                                onChange={(e) => setForm({ ...form, content: e.target.value })}
                                placeholder="Announcement content"
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary-500 resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
                                <div className="flex gap-2">
                                    {TYPE_OPTIONS.map(({ value, label, icon: Icon, color }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setForm({ ...form, type: value })}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors ${form.type === value
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                                                : 'border-gray-200 dark:border-surface-700 hover:bg-gray-50 dark:hover:bg-surface-800'
                                                }`}
                                        >
                                            <Icon className={`w-4 h-4 ${color}`} />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Scope</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, scope: 'global', group_id: '' })}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors ${form.scope === 'global'
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                                            : 'border-gray-200 dark:border-surface-700 hover:bg-gray-50 dark:hover:bg-surface-800'
                                            }`}
                                    >
                                        <Globe className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Global</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, scope: 'group' })}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors ${form.scope === 'group'
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                                            : 'border-gray-200 dark:border-surface-700 hover:bg-gray-50 dark:hover:bg-surface-800'
                                            }`}
                                    >
                                        <Users className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Group</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        {form.scope === 'group' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Group</label>
                                <select
                                    value={form.group_id}
                                    onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="">Select a group...</option>
                                    {groups.map((group) => (
                                        <option key={group.id} value={group.id}>
                                            {group.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date (optional)</label>
                                <input
                                    type="datetime-local"
                                    value={form.starts_at}
                                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date (optional)</label>
                                <input
                                    type="datetime-local"
                                    value={form.expires_at}
                                    onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.is_dismissible}
                                onChange={(e) => setForm({ ...form, is_dismissible: e.target.checked })}
                                className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Allow users to dismiss</span>
                        </label>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.title.trim() || !form.content.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50"
                            >
                                <Check className="w-4 h-4" />
                                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowForm(false);
                                    setEditingId(null);
                                    setForm(defaultForm);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-surface-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-surface-700"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Announcements List */}
            <div className="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-gray-100 dark:border-surface-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
                ) : announcements.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        <Megaphone className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                        <p>No announcements yet</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-surface-700">
                        {announcements.map((announcement) => {
                            const typeInfo = TYPE_OPTIONS.find((t) => t.value === announcement.type);
                            const Icon = typeInfo?.icon || Info;
                            const isExpired = announcement.expires_at && new Date(announcement.expires_at) < new Date();

                            return (
                                <li key={announcement.id} className="p-4 hover:bg-gray-50 dark:hover:bg-surface-800">
                                    <div className="flex items-start gap-4">
                                        <div className={`mt-1 ${typeInfo?.color}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-gray-900 dark:text-gray-100">{announcement.title}</h4>
                                                {announcement.scope === 'group' && (
                                                    <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                                                        Group
                                                    </span>
                                                )}
                                                {!announcement.is_active && (
                                                    <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                                                        Inactive
                                                    </span>
                                                )}
                                                {isExpired && (
                                                    <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                                                        Expired
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{announcement.content}</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                                Created {new Date(announcement.created_at).toLocaleDateString()}
                                                {announcement.expires_at && ` • Expires ${new Date(announcement.expires_at).toLocaleDateString()}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleActive(announcement)}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${announcement.is_active
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {announcement.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(announcement)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-surface-700 rounded-lg"
                                            >
                                                <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(announcement.id)}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
