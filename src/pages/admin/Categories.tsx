import { useEffect, useState } from 'react';
import {
    Plus,
    Edit2,
    Trash2,
    GripVertical,
    X,
    Check,
    Tag,
} from 'lucide-react';
import {
    getAdminCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from '../../services';
import type { Category } from '../../types/database';

const PRESET_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#8B5CF6', // Purple
    '#F59E0B', // Orange
    '#EF4444', // Red
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#6366F1', // Indigo
];

export default function AdminCategories() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', color: '', icon: '' });
    const [isCreating, setIsCreating] = useState(false);
    const [newCategory, setNewCategory] = useState({ name: '', color: '#3B82F6', icon: '' });
    const [saving, setSaving] = useState(false);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const data = await getAdminCategories();
            setCategories(data);
        } catch (err) {
            console.error('Failed to load categories:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    };

    const handleCreate = async () => {
        if (!newCategory.name.trim()) return;
        setSaving(true);
        try {
            await createCategory({
                name: newCategory.name.trim(),
                slug: generateSlug(newCategory.name),
                color: newCategory.color,
                icon: newCategory.icon || undefined,
            });
            setNewCategory({ name: '', color: '#3B82F6', icon: '' });
            setIsCreating(false);
            loadCategories();
        } catch (err) {
            console.error('Failed to create category:', err);
            alert('Failed to create category');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (category: Category) => {
        setEditingId(category.id);
        setEditForm({
            name: category.name,
            color: category.color || '#3B82F6',
            icon: category.icon || '',
        });
    };

    const handleSaveEdit = async (categoryId: string) => {
        if (!editForm.name.trim()) return;
        setSaving(true);
        try {
            await updateCategory(categoryId, {
                name: editForm.name.trim(),
                slug: generateSlug(editForm.name),
                color: editForm.color,
                icon: editForm.icon || null,
            });
            setEditingId(null);
            loadCategories();
        } catch (err) {
            console.error('Failed to update category:', err);
            alert('Failed to update category');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (categoryId: string) => {
        if (!confirm('Are you sure you want to delete this category? Posts using it will become uncategorized.')) {
            return;
        }
        try {
            await deleteCategory(categoryId);
            loadCategories();
        } catch (err) {
            console.error('Failed to delete category:', err);
            alert('Failed to delete category');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Category Management</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage post categories</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Add Category
                    </button>
                )}
            </div>

            {/* Create Form */}
            {isCreating && (
                <div className="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-gray-100 dark:border-surface-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">New Category</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                            <input
                                type="text"
                                value={newCategory.name}
                                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                placeholder="Category name"
                                className="w-full px-4 py-2 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
                            <div className="flex gap-2">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setNewCategory({ ...newCategory, color })}
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${newCategory.color === color ? 'border-gray-900 dark:border-gray-100 scale-110' : 'border-transparent'
                                            }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                                <input
                                    type="color"
                                    value={newCategory.color}
                                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                                    className="w-8 h-8 rounded cursor-pointer"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon (optional)</label>
                            <input
                                type="text"
                                value={newCategory.icon}
                                onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                                placeholder="e.g., 📚 or icon name"
                                className="w-full px-4 py-2 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleCreate}
                                disabled={saving || !newCategory.name.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
                            >
                                <Check className="w-4 h-4" />
                                {saving ? 'Creating...' : 'Create'}
                            </button>
                            <button
                                onClick={() => {
                                    setIsCreating(false);
                                    setNewCategory({ name: '', color: '#3B82F6', icon: '' });
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-surface-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-surface-700 transition-colors"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Categories List */}
            <div className="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-gray-100 dark:border-surface-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
                ) : categories.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        <Tag className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                        <p>No categories yet</p>
                        <p className="text-sm mt-1">Create your first category to organize posts</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-surface-700">
                        {categories.map((category) => (
                            <li key={category.id} className="p-4 hover:bg-gray-50 dark:hover:bg-surface-800">
                                {editingId === category.id ? (
                                    <div className="space-y-3">
                                        <div className="flex gap-4">
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                className="flex-1 px-3 py-2 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                                            />
                                            <input
                                                type="color"
                                                value={editForm.color}
                                                onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                                                className="w-10 h-10 rounded cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSaveEdit(category.id)}
                                                disabled={saving}
                                                className="px-3 py-1.5 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="px-3 py-1.5 bg-gray-100 dark:bg-surface-800 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-surface-700"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4">
                                        <GripVertical className="w-5 h-5 text-gray-300 dark:text-gray-600 cursor-move" />
                                        <div
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: category.color || '#666' }}
                                        />
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900 dark:text-gray-100">
                                                {category.icon && <span className="mr-2">{category.icon}</span>}
                                                {category.name}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">/{category.slug}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(category)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(category.id)}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
