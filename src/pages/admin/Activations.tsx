import { useState, useEffect, useCallback } from 'react';
import {
    RefreshCw,
    Plus,
    Edit2,
    Trash2,
    Key,
    Package,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Eye,
    EyeOff,
    ExternalLink,
    X,
    Check,
    Loader2,
    Copy,
    Upload,
    FileDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile } from '@/services/s3';
import {
    getAdminProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getActivationRequests,
    getActivationStatsManual,
    PRODUCT_TYPES,
    type ActivationRequestWithDetails,
    type ActivationStats,
} from '@/services/activation';
import type { ActivationProduct, ActivationRequestStatus } from '@/types/database';

// Status badge helper
function StatusBadge({ status }: { status: ActivationRequestStatus }) {
    const config = {
        pending: { label: 'Pending', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', icon: Clock },
        in_progress: { label: 'In Progress', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', icon: Loader2 },
        completed: { label: 'Completed', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', icon: CheckCircle },
        rejected: { label: 'Rejected', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: XCircle },
    };
    const { label, color, icon: Icon } = config[status] || config.pending;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
            <Icon className={`w-3 h-3 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
            {label}
        </span>
    );
}

export default function AdminActivations() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'products' | 'requests'>('requests');

    // Products state
    const [products, setProducts] = useState<ActivationProduct[]>([]);
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ActivationProduct | null>(null);
    const [productForm, setProductForm] = useState({
        name: '',
        description: '',
        product_type: 'plugin',
        monthly_limit: 1,
        instructions: '',
        license_key: '',
        file_url: '',
        file_name: '',
    });
    const [productFile, setProductFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    // Requests state
    const [requests, setRequests] = useState<ActivationRequestWithDetails[]>([]);
    const [requestsTotal, setRequestsTotal] = useState(0);
    const [requestsPage, setRequestsPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<ActivationRequestStatus | 'all'>('pending');
    const [searchQuery, setSearchQuery] = useState('');

    // Selected request for processing modal
    const [selectedRequest, setSelectedRequest] = useState<ActivationRequestWithDetails | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [processForm, setProcessForm] = useState({
        status: 'completed' as ActivationRequestStatus,
        admin_notes: '',
    });

    // Stats and loading
    const [stats, setStats] = useState<ActivationStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Fetch products
    const fetchProducts = useCallback(async () => {
        try {
            const data = await getAdminProducts();
            setProducts(data);
        } catch (err) {
            console.error('Error fetching products:', err);
        }
    }, []);

    // Fetch requests
    const fetchRequests = useCallback(async () => {
        try {
            const { requests: data, total } = await getActivationRequests({
                status: statusFilter,
                search: searchQuery,
                page: requestsPage,
                pageSize: 20,
            });
            setRequests(data);
            setRequestsTotal(total);
        } catch (err) {
            console.error('Error fetching requests:', err);
        }
    }, [statusFilter, searchQuery, requestsPage]);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const data = await getActivationStatsManual();
            setStats(data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, []);

    // Initial load
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchProducts(), fetchRequests(), fetchStats()]);
            setLoading(false);
        };
        loadData();
    }, [fetchProducts, fetchRequests, fetchStats]);

    // Refresh requests when filters change
    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    // Product form handlers
    const handleCreateProduct = async () => {
        if (!productForm.name.trim()) return;
        setSaving(true);
        try {
            let fileUrl = productForm.file_url || undefined;
            let fileName = productForm.file_name || undefined;
            if (productFile) {
                setUploading(true);
                const result = await uploadFile(productFile, 'activations/products');
                fileUrl = result.url;
                fileName = result.fileName;
                setUploading(false);
            }
            await createProduct({
                name: productForm.name.trim(),
                description: productForm.description.trim() || undefined,
                product_type: productForm.product_type,
                monthly_limit: productForm.monthly_limit,
                instructions: productForm.instructions.trim() || undefined,
                license_key: productForm.license_key.trim() || undefined,
                file_url: fileUrl,
                file_name: fileName,
            });
            setProductForm({ name: '', description: '', product_type: 'plugin', monthly_limit: 1, instructions: '', license_key: '', file_url: '', file_name: '' }); setProductFile(null);
            setShowProductForm(false);
            await fetchProducts();
            await fetchStats();
        } catch (err) {
            console.error('Failed to create product:', err);
            alert('Failed to create product');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateProduct = async () => {
        if (!editingProduct || !productForm.name.trim()) return;
        setSaving(true);
        try {
            let fileUrl: string | null = productForm.file_url || null;
            let fileName: string | null = productForm.file_name || null;
            if (productFile) {
                setUploading(true);
                const result = await uploadFile(productFile, 'activations/products');
                fileUrl = result.url;
                fileName = result.fileName;
                setUploading(false);
            }
            await updateProduct(editingProduct.id, {
                name: productForm.name.trim(),
                description: productForm.description.trim() || null,
                product_type: productForm.product_type,
                monthly_limit: productForm.monthly_limit,
                instructions: productForm.instructions.trim() || null,
                license_key: productForm.license_key.trim() || null,
                file_url: fileUrl,
                file_name: fileName,
            });
            setEditingProduct(null);
            setProductForm({ name: '', description: '', product_type: 'plugin', monthly_limit: 1, instructions: '', license_key: '', file_url: '', file_name: '' }); setProductFile(null);
            await fetchProducts();
        } catch (err) {
            console.error('Failed to update product:', err);
            alert('Failed to update product');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProduct = async (productId: string) => {
        if (!confirm('Are you sure you want to delete this product? Existing requests will not be affected.')) {
            return;
        }
        try {
            await deleteProduct(productId);
            await fetchProducts();
            await fetchStats();
        } catch (err) {
            console.error('Failed to delete product:', err);
            alert('Failed to delete product');
        }
    };

    const handleToggleProductActive = async (product: ActivationProduct) => {
        try {
            await updateProduct(product.id, { is_active: !product.is_active });
            await fetchProducts();
        } catch (err) {
            console.error('Failed to toggle product:', err);
        }
    };

    const startEditProduct = (product: ActivationProduct) => {
        setEditingProduct(product);
        setProductForm({
            name: product.name,
            description: product.description || '',
            product_type: product.product_type,
            monthly_limit: product.monthly_limit,
            instructions: product.instructions || '',
            license_key: product.license_key || '',
            file_url: product.file_url || '',
            file_name: product.file_name || '',
        });
        setProductFile(null);
    };

    // Request processing handlers
    const handleProcessRequest = async () => {
        if (!selectedRequest || !user) return;
        setProcessing(true);
        try {
            // Use the API endpoint to process and send email
            const token = (await (await import('@/services/supabase')).supabase.auth.getSession()).data.session?.access_token;
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

            const response = await fetch(`${apiUrl}/api/activations/${selectedRequest.id}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    status: processForm.status,
                    admin_notes: processForm.admin_notes.trim() || undefined,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to process request');
            }

            setSelectedRequest(null);
            setProcessForm({ status: 'completed', admin_notes: '' });
            setShowPassword(false);
            await fetchRequests();
            await fetchStats();
        } catch (err) {
            console.error('Failed to process request:', err);
            alert(err instanceof Error ? err.message : 'Failed to process request');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-3">
                        <Key className="w-7 h-7 text-primary-500" />
                        Product Activations
                    </h1>
                    <p className="text-surface-500 dark:text-surface-400 mt-1">
                        Manage activation products and process user requests
                    </p>
                </div>
                <button
                    onClick={() => {
                        fetchProducts();
                        fetchRequests();
                        fetchStats();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg text-surface-700 dark:text-surface-300 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-surface-900 dark:text-surface-100">{stats?.total_products || 0}</p>
                            <p className="text-xs text-surface-500 dark:text-surface-400">Products</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-surface-900 dark:text-surface-100">{stats?.pending_requests || 0}</p>
                            <p className="text-xs text-surface-500 dark:text-surface-400">Pending</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-surface-900 dark:text-surface-100">{stats?.completed_this_month || 0}</p>
                            <p className="text-xs text-surface-500 dark:text-surface-400">This Month</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-surface-900 dark:text-surface-100">{stats?.total_requests || 0}</p>
                            <p className="text-xs text-surface-500 dark:text-surface-400">Total Requests</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-surface-200 dark:border-surface-700">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`pb-3 px-1 border-b-2 transition-colors ${
                            activeTab === 'requests'
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                        }`}
                    >
                        Requests
                        {(stats?.pending_requests || 0) > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs">
                                {stats?.pending_requests}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`pb-3 px-1 border-b-2 transition-colors ${
                            activeTab === 'products'
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                        }`}
                    >
                        Products
                    </button>
                </div>
            </div>

            {/* Requests Tab */}
            {activeTab === 'requests' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value as ActivationRequestStatus | 'all');
                                setRequestsPage(1);
                            }}
                            className="px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Search by website..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setRequestsPage(1);
                            }}
                            className="flex-1 px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 placeholder:text-surface-400"
                        />
                    </div>

                    {/* Requests Table */}
                    <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
                        {requests.length === 0 ? (
                            <div className="p-8 text-center text-surface-500 dark:text-surface-400">
                                <Clock className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                                <p>No activation requests found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
                                            <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">User</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">Product</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">Website</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">Status</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">Date</th>
                                            <th className="text-right py-3 px-4 text-sm font-medium text-surface-500 dark:text-surface-400">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {requests.map((request) => (
                                            <tr key={request.id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        {request.user?.avatar_url ? (
                                                            <img src={request.user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 text-sm font-medium">
                                                                {request.user?.display_name?.[0] || '?'}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-medium text-surface-900 dark:text-surface-100">{request.user?.display_name}</p>
                                                            <p className="text-xs text-surface-500 dark:text-surface-400">@{request.user?.username}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <p className="text-surface-900 dark:text-surface-100">{request.product?.name}</p>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <a
                                                        href={request.website_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary-600 dark:text-primary-400 hover:underline text-sm flex items-center gap-1"
                                                    >
                                                        {new URL(request.website_url).hostname}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <StatusBadge status={request.status || 'pending'} />
                                                </td>
                                                <td className="py-3 px-4 text-sm text-surface-500 dark:text-surface-400">
                                                    {request.created_at ? new Date(request.created_at).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedRequest(request);
                                                            setProcessForm({
                                                                status: request.status === 'pending' ? 'in_progress' : 'completed',
                                                                admin_notes: request.admin_notes || '',
                                                            });
                                                        }}
                                                        className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded-lg transition-colors"
                                                    >
                                                        {request.status === 'completed' || request.status === 'rejected' ? 'View' : 'Process'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {requestsTotal > 20 && (
                            <div className="flex items-center justify-between p-4 border-t border-surface-200 dark:border-surface-700">
                                <p className="text-sm text-surface-500 dark:text-surface-400">
                                    Showing {(requestsPage - 1) * 20 + 1} to {Math.min(requestsPage * 20, requestsTotal)} of {requestsTotal}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setRequestsPage(p => Math.max(1, p - 1))}
                                        disabled={requestsPage === 1}
                                        className="px-3 py-1 border border-surface-200 dark:border-surface-700 rounded-lg disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setRequestsPage(p => p + 1)}
                                        disabled={requestsPage * 20 >= requestsTotal}
                                        className="px-3 py-1 border border-surface-200 dark:border-surface-700 rounded-lg disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
                <div className="space-y-4">
                    {/* Add Product Button */}
                    {!showProductForm && !editingProduct && (
                        <button
                            onClick={() => setShowProductForm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Product
                        </button>
                    )}

                    {/* Product Form */}
                    {(showProductForm || editingProduct) && (
                        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-6">
                            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
                                {editingProduct ? 'Edit Product' : 'New Product'}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={productForm.name}
                                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                        placeholder="e.g., Elementor Pro"
                                        className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Type</label>
                                    <select
                                        value={productForm.product_type}
                                        onChange={(e) => setProductForm({ ...productForm, product_type: e.target.value })}
                                        className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                                    >
                                        {PRODUCT_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Monthly Limit</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={productForm.monthly_limit}
                                        onChange={(e) => setProductForm({ ...productForm, monthly_limit: parseInt(e.target.value) || 1 })}
                                        className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={productForm.description}
                                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                                        placeholder="Optional description"
                                        className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Instructions (shown to users)</label>
                                    <textarea
                                        value={productForm.instructions}
                                        onChange={(e) => setProductForm({ ...productForm, instructions: e.target.value })}
                                        placeholder="Instructions for users after activation..."
                                        rows={3}
                                        className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">License Key</label>
                                    <input
                                        type="text"
                                        value={productForm.license_key}
                                        onChange={(e) => setProductForm({ ...productForm, license_key: e.target.value })}
                                        placeholder="Product license key (shown to admins when processing requests)"
                                        className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 font-mono text-sm"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                        Plugin/Theme File
                                    </label>
                                    {(productForm.file_url || productFile) ? (
                                        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                            <FileDown className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                            <span className="text-sm text-green-800 dark:text-green-300 truncate flex-1">
                                                {productFile?.name || productForm.file_name || 'Uploaded file'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setProductFile(null);
                                                    setProductForm({ ...productForm, file_url: '', file_name: '' });
                                                }}
                                                className="p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded transition-colors text-green-600 dark:text-green-400"
                                                title="Remove file"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                                            <Upload className="w-5 h-5 text-surface-400" />
                                            <span className="text-sm text-surface-500 dark:text-surface-400">
                                                Click to upload .zip file
                                            </span>
                                            <input
                                                type="file"
                                                accept=".zip,.rar,.7z"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) setProductFile(file);
                                                }}
                                            />
                                        </label>
                                    )}
                                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                                        Upload the plugin/theme zip file. Users can download it after submitting an activation request.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={editingProduct ? handleUpdateProduct : handleCreateProduct}
                                    disabled={saving || !productForm.name.trim()}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {!saving && <Check className="w-4 h-4" />}
                                    {uploading ? 'Uploading...' : saving ? 'Saving...' : editingProduct ? 'Update' : 'Create'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowProductForm(false);
                                        setEditingProduct(null);
                                        setProductForm({ name: '', description: '', product_type: 'plugin', monthly_limit: 1, instructions: '', license_key: '', file_url: '', file_name: '' }); setProductFile(null);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Products List */}
                    <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
                        {products.length === 0 ? (
                            <div className="p-8 text-center text-surface-500 dark:text-surface-400">
                                <Package className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                                <p>No products yet</p>
                                <p className="text-sm mt-1">Create your first product to start accepting activation requests</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                                {products.map((product) => (
                                    <li key={product.id} className="p-4 hover:bg-surface-50 dark:hover:bg-surface-800">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                    product.is_active
                                                        ? 'bg-primary-100 dark:bg-primary-900/30'
                                                        : 'bg-surface-100 dark:bg-surface-800'
                                                }`}>
                                                    <Package className={`w-5 h-5 ${
                                                        product.is_active
                                                            ? 'text-primary-600 dark:text-primary-400'
                                                            : 'text-surface-400'
                                                    }`} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-surface-900 dark:text-surface-100 flex items-center gap-2">
                                                        {product.name}
                                                        {!product.is_active && (
                                                            <span className="px-2 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-500 text-xs rounded">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-sm text-surface-500 dark:text-surface-400">
                                                        {PRODUCT_TYPES.find(t => t.value === product.product_type)?.label || product.product_type}
                                                        {' · '}
                                                        {product.monthly_limit} activation{product.monthly_limit > 1 ? 's' : ''}/month
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleToggleProductActive(product)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                        product.is_active
                                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                                                            : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200'
                                                    }`}
                                                >
                                                    {product.is_active ? 'Active' : 'Inactive'}
                                                </button>
                                                <button
                                                    onClick={() => startEditProduct(product)}
                                                    className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4 text-surface-500 dark:text-surface-400" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProduct(product.id)}
                                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* Process Request Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-surface-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-surface-200 dark:border-surface-700">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                                    Process Activation Request
                                </h2>
                                <button
                                    onClick={() => {
                                        setSelectedRequest(null);
                                        setShowPassword(false);
                                    }}
                                    className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-surface-500" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* User Info */}
                            <div className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                                {selectedRequest.user?.avatar_url ? (
                                    <img src={selectedRequest.user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                                        {selectedRequest.user?.display_name?.[0] || '?'}
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium text-surface-900 dark:text-surface-100">{selectedRequest.user?.display_name}</p>
                                    <p className="text-sm text-surface-500 dark:text-surface-400">@{selectedRequest.user?.username}</p>
                                </div>
                            </div>

                            {/* Product */}
                            <div>
                                <label className="block text-sm font-medium text-surface-500 dark:text-surface-400 mb-1">Product</label>
                                <p className="text-surface-900 dark:text-surface-100 font-medium">{selectedRequest.product?.name}</p>
                            </div>

                            {/* License Key */}
                            {selectedRequest.product?.license_key && (
                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-purple-800 dark:text-purple-400 flex items-center gap-2">
                                            <Key className="w-4 h-4" />
                                            License Key
                                        </span>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(selectedRequest.product?.license_key || '');
                                                setCopiedField('license');
                                                setTimeout(() => setCopiedField(null), 2000);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-800 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium transition-colors"
                                            title="Copy license key"
                                        >
                                            {copiedField === 'license' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                            {copiedField === 'license' ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Website URL */}
                            <div>
                                <label className="block text-sm font-medium text-surface-500 dark:text-surface-400 mb-1">Website URL</label>
                                <a
                                    href={selectedRequest.website_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                                >
                                    {selectedRequest.website_url}
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>

                            {/* Credentials */}
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400 mb-3 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    WordPress Credentials
                                </p>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-yellow-700 dark:text-yellow-500">Username:</span>
                                        <div className="flex items-center gap-2">
                                            <code className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 rounded text-sm">
                                                {selectedRequest.wp_username}
                                            </code>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(selectedRequest.wp_username || '');
                                                    setCopiedField('username');
                                                    setTimeout(() => setCopiedField(null), 2000);
                                                }}
                                                className="p-1 hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded transition-colors"
                                                title="Copy username"
                                            >
                                                {copiedField === 'username' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-yellow-700 dark:text-yellow-500">Password:</span>
                                        <div className="flex items-center gap-2">
                                            <code className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 rounded text-sm">
                                                {showPassword ? selectedRequest.wp_password : '••••••••'}
                                            </code>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(selectedRequest.wp_password || '');
                                                    setCopiedField('password');
                                                    setTimeout(() => setCopiedField(null), 2000);
                                                }}
                                                className="p-1 hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded transition-colors"
                                                title="Copy password"
                                            >
                                                {copiedField === 'password' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="p-1 hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded transition-colors"
                                                title={showPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* User Notes */}
                            {selectedRequest.notes && (
                                <div>
                                    <label className="block text-sm font-medium text-surface-500 dark:text-surface-400 mb-1">User Notes</label>
                                    <p className="text-surface-700 dark:text-surface-300 text-sm p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                                        {selectedRequest.notes}
                                    </p>
                                </div>
                            )}

                            {/* Status Update */}
                            {selectedRequest.status !== 'completed' && selectedRequest.status !== 'rejected' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Update Status</label>
                                        <select
                                            value={processForm.status}
                                            onChange={(e) => setProcessForm({ ...processForm, status: e.target.value as ActivationRequestStatus })}
                                            className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                                        >
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="rejected">Rejected</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                            Admin Notes (visible to user)
                                        </label>
                                        <textarea
                                            value={processForm.admin_notes}
                                            onChange={(e) => setProcessForm({ ...processForm, admin_notes: e.target.value })}
                                            placeholder="Add notes about the activation..."
                                            rows={3}
                                            className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Show admin notes if already processed */}
                            {(selectedRequest.status === 'completed' || selectedRequest.status === 'rejected') && selectedRequest.admin_notes && (
                                <div>
                                    <label className="block text-sm font-medium text-surface-500 dark:text-surface-400 mb-1">Admin Notes</label>
                                    <p className="text-surface-700 dark:text-surface-300 text-sm p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                                        {selectedRequest.admin_notes}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        {selectedRequest.status !== 'completed' && selectedRequest.status !== 'rejected' && (
                            <div className="p-6 border-t border-surface-200 dark:border-surface-700 flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setSelectedRequest(null);
                                        setShowPassword(false);
                                    }}
                                    className="px-4 py-2 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleProcessRequest}
                                    disabled={processing}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                                >
                                    {processing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    {processing ? 'Processing...' : 'Update Status'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
