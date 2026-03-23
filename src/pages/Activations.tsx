import { useState, useEffect, useCallback } from 'react';
import {
    Key,
    Package,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    ExternalLink,
    X,
    Eye,
    EyeOff,
    Loader2,
    Shield,
    Download,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
    getAvailableProducts,
    getUserActivations,
    requestActivation,
    PRODUCT_TYPES,
    type ProductWithUsage,
    type ActivationRequestWithDetails,
} from '@/services/activation';
import type { ActivationRequestStatus } from '@/types/database';

// Status badge helper
function StatusBadge({ status }: { status: ActivationRequestStatus }) {
    const config = {
        pending: { label: 'Pending Review', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', icon: Clock },
        in_progress: { label: 'In Progress', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', icon: Loader2 },
        completed: { label: 'Completed', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', icon: CheckCircle },
        rejected: { label: 'Rejected', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: XCircle },
    };
    const { label, color, icon: Icon } = config[status] || config.pending;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${color}`}>
            <Icon className={`w-4 h-4 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
            {label}
        </span>
    );
}

export default function Activations() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');

    // Products state
    const [products, setProducts] = useState<ProductWithUsage[]>([]);
    const [myActivations, setMyActivations] = useState<ActivationRequestWithDetails[]>([]);
    const [loading, setLoading] = useState(true);

    // Request modal state
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<ProductWithUsage | null>(null);
    const [requestForm, setRequestForm] = useState({
        website_url: '',
        wp_username: '',
        wp_password: '',
        notes: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch data
    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [productsData, activationsData] = await Promise.all([
                getAvailableProducts(user.id),
                getUserActivations(user.id),
            ]);
            setProducts(productsData);
            setMyActivations(activationsData);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle request submission
    const handleSubmitRequest = async () => {
        if (!user || !selectedProduct) return;
        if (!requestForm.website_url.trim() || !requestForm.wp_username.trim() || !requestForm.wp_password.trim()) {
            setError('Please fill in all required fields');
            return;
        }

        // Validate URL
        try {
            new URL(requestForm.website_url);
        } catch {
            setError('Please enter a valid website URL');
            return;
        }

        // Client-side check for existing active request
        const hasActiveRequest = myActivations.some(
            a => a.product_id === selectedProduct.id && (a.status === 'pending' || a.status === 'in_progress')
        );
        if (hasActiveRequest) {
            setError('You already have an active request for this product');
            return;
        }

        // Check remaining activations
        if (selectedProduct.remaining_activations <= 0) {
            setError('Monthly activation limit reached for this product');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await requestActivation(
                user.id,
                selectedProduct.id,
                requestForm.website_url.trim(),
                requestForm.wp_username.trim(),
                requestForm.wp_password,
                requestForm.notes.trim() || undefined
            );

            setShowRequestModal(false);
            setSelectedProduct(null);
            setRequestForm({ website_url: '', wp_username: '', wp_password: '', notes: '' });
            setShowPassword(false);
            await fetchData();
            setActiveTab('history');
        } catch (err) {
            console.error('Error submitting request:', err);
            setError(err instanceof Error ? err.message : 'Failed to submit request');
        } finally {
            setSubmitting(false);
        }
    };

    // Open request modal
    const openRequestModal = async (product: ProductWithUsage) => {
        // Refresh data first to ensure we have latest state
        await fetchData();

        // Re-check if user can request (in case data changed)
        const hasActiveRequest = myActivations.some(
            a => a.product_id === product.id && (a.status === 'pending' || a.status === 'in_progress')
        );
        if (hasActiveRequest) {
            alert('You already have an active request for this product');
            return;
        }

        setSelectedProduct(product);
        setShowRequestModal(true);
        setError(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-surface-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-surface-950 py-8">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                        <Key className="w-8 h-8 text-primary-500" />
                        Product Activations
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Request activation keys for premium products like Elementor, Bricks Builder, themes, and more.
                    </p>
                </div>

                {/* Tabs */}
                <div className="border-b border-surface-200 dark:border-surface-700 mb-6">
                    <div className="flex gap-6">
                        <button
                            onClick={() => setActiveTab('available')}
                            className={`pb-3 px-1 border-b-2 transition-colors font-medium ${
                                activeTab === 'available'
                                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                    : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                            }`}
                        >
                            Available Products
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`pb-3 px-1 border-b-2 transition-colors font-medium ${
                                activeTab === 'history'
                                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                    : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                            }`}
                        >
                            My Requests
                            {myActivations.filter(a => a.status === 'pending' || a.status === 'in_progress').length > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-xs">
                                    {myActivations.filter(a => a.status === 'pending' || a.status === 'in_progress').length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Available Products Tab */}
                {activeTab === 'available' && (
                    <div>
                        {products.length === 0 ? (
                            <div className="text-center py-12">
                                <Package className="w-16 h-16 mx-auto text-surface-300 dark:text-surface-600 mb-4" />
                                <p className="text-surface-600 dark:text-surface-400 text-lg">No products available</p>
                                <p className="text-surface-500 dark:text-surface-500 mt-1">Check back later for new products</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {products.map((product) => (
                                    <div
                                        key={product.id}
                                        className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden hover:shadow-lg transition-shadow"
                                    >
                                        <div className="p-6">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                                    <Package className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                                </div>
                                                <span className="px-2 py-1 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 text-xs rounded-full">
                                                    {PRODUCT_TYPES.find(t => t.value === product.product_type)?.label || product.product_type}
                                                </span>
                                            </div>

                                            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
                                                {product.name}
                                            </h3>

                                            {product.description && (
                                                <p className="text-surface-500 dark:text-surface-400 text-sm mb-4 line-clamp-2">
                                                    {product.description}
                                                </p>
                                            )}

                                            <div className="flex items-center justify-between text-sm mb-4">
                                                <span className="text-surface-500 dark:text-surface-400">Monthly Limit</span>
                                                <span className="font-medium text-surface-900 dark:text-surface-100">
                                                    {product.remaining_activations} / {product.monthly_limit} remaining
                                                </span>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="h-2 bg-surface-100 dark:bg-surface-800 rounded-full mb-4 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${
                                                        product.remaining_activations === 0
                                                            ? 'bg-red-500'
                                                            : product.remaining_activations < product.monthly_limit
                                                            ? 'bg-yellow-500'
                                                            : 'bg-green-500'
                                                    }`}
                                                    style={{
                                                        width: `${(product.remaining_activations / product.monthly_limit) * 100}%`,
                                                    }}
                                                />
                                            </div>

                                            <button
                                                onClick={() => openRequestModal(product)}
                                                disabled={product.remaining_activations === 0 || product.has_active_request}
                                                className="w-full py-2.5 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary-500 hover:bg-primary-600 text-white disabled:hover:bg-primary-500"
                                            >
                                                {product.has_active_request
                                                    ? 'Request Pending'
                                                    : product.remaining_activations === 0
                                                    ? 'Limit Reached'
                                                    : 'Request Activation'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* My Requests Tab */}
                {activeTab === 'history' && (
                    <div>
                        {myActivations.length === 0 ? (
                            <div className="text-center py-12">
                                <Clock className="w-16 h-16 mx-auto text-surface-300 dark:text-surface-600 mb-4" />
                                <p className="text-surface-600 dark:text-surface-400 text-lg">No activation requests yet</p>
                                <p className="text-surface-500 dark:text-surface-500 mt-1">
                                    Browse available products and submit your first request
                                </p>
                                <button
                                    onClick={() => setActiveTab('available')}
                                    className="mt-4 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                                >
                                    View Products
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {myActivations.map((activation) => (
                                    <div
                                        key={activation.id}
                                        className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-6"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                                                    <Package className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-surface-900 dark:text-surface-100">
                                                        {activation.product?.name}
                                                    </h3>
                                                    <a
                                                        href={activation.website_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 mt-1"
                                                    >
                                                        {activation.website_url}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">
                                                        Requested {activation.created_at ? new Date(activation.created_at).toLocaleDateString() : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                            <StatusBadge status={activation.status || 'pending'} />
                                        </div>

                                        {/* Status-specific content */}
                                        {activation.status === 'pending' && (
                                            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                                <p className="text-sm text-yellow-800 dark:text-yellow-400">
                                                    Your request is awaiting review. We'll notify you when it's being processed.
                                                </p>
                                            </div>
                                        )}

                                        {activation.status === 'in_progress' && (
                                            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                                <p className="text-sm text-blue-800 dark:text-blue-400">
                                                    Your activation is being processed. This usually takes a few minutes.
                                                </p>
                                            </div>
                                        )}

                                        {activation.status === 'completed' && (
                                            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                <p className="text-sm text-green-800 dark:text-green-400 flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4" />
                                                    Your product has been activated successfully!
                                                </p>
                                                {activation.admin_notes && (
                                                    <p className="text-sm text-green-700 dark:text-green-500 mt-2">
                                                        <strong>Note:</strong> {activation.admin_notes}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {activation.status === 'rejected' && (
                                            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                                <p className="text-sm text-red-800 dark:text-red-400 flex items-center gap-2">
                                                    <XCircle className="w-4 h-4" />
                                                    Your request could not be completed.
                                                </p>
                                                {activation.admin_notes && (
                                                    <p className="text-sm text-red-700 dark:text-red-500 mt-2">
                                                        <strong>Reason:</strong> {activation.admin_notes}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Download File */}
                                        {activation.product?.file_url && (
                                            <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-primary-800 dark:text-primary-300">
                                                            Download & install the {activation.product.product_type === 'theme' ? 'theme' : 'plugin'} on your WordPress site
                                                        </p>
                                                        <p className="text-xs text-primary-600 dark:text-primary-500 mt-0.5 truncate">
                                                            {activation.product.file_name || 'File'}
                                                        </p>
                                                    </div>
                                                    <a
                                                        href={activation.product.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        download
                                                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Download
                                                    </a>
                                                </div>
                                            </div>
                                        )}

                                        {/* User notes */}
                                        {activation.notes && (
                                            <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800">
                                                <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Your notes:</p>
                                                <p className="text-sm text-surface-600 dark:text-surface-400">{activation.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Request Modal */}
            {showRequestModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-surface-900 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-surface-200 dark:border-surface-700">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                                    Request Activation
                                </h2>
                                <button
                                    onClick={() => {
                                        setShowRequestModal(false);
                                        setSelectedProduct(null);
                                        setError(null);
                                    }}
                                    className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-surface-500" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Product Info */}
                            <div className="flex items-center gap-3 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
                                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                    <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-surface-900 dark:text-surface-100">{selectedProduct.name}</p>
                                    <p className="text-sm text-surface-500 dark:text-surface-400">
                                        {selectedProduct.remaining_activations} activation{selectedProduct.remaining_activations !== 1 ? 's' : ''} remaining this month
                                    </p>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        {error}
                                    </p>
                                </div>
                            )}

                            {/* Form Fields */}
                            <div>
                                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                    Website URL <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="url"
                                    value={requestForm.website_url}
                                    onChange={(e) => setRequestForm({ ...requestForm, website_url: e.target.value })}
                                    placeholder="https://yourwebsite.com"
                                    className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                    WordPress Username <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={requestForm.wp_username}
                                    onChange={(e) => setRequestForm({ ...requestForm, wp_username: e.target.value })}
                                    placeholder="admin"
                                    className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                    WordPress Password <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={requestForm.wp_password}
                                        onChange={(e) => setRequestForm({ ...requestForm, wp_password: e.target.value })}
                                        placeholder="Your WordPress password"
                                        className="w-full px-3 py-2 pr-10 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                                    Notes (optional)
                                </label>
                                <textarea
                                    value={requestForm.notes}
                                    onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                                    placeholder="Any additional information..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
                                />
                            </div>

                            {/* Security Notice */}
                            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-700 dark:text-blue-400">
                                    <p className="font-medium">Your credentials are secure</p>
                                    <p className="mt-1 text-blue-600 dark:text-blue-500">
                                        Your login details are stored securely and only used by our team to activate the product on your website.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-surface-200 dark:border-surface-700 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowRequestModal(false);
                                    setSelectedProduct(null);
                                    setError(null);
                                }}
                                className="px-4 py-2 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitRequest}
                                disabled={submitting || !requestForm.website_url || !requestForm.wp_username || !requestForm.wp_password}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Key className="w-4 h-4" />
                                        Submit Request
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
