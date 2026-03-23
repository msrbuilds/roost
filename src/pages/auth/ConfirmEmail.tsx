import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, RefreshCw, LogOut, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { APP_CONFIG } from '@/config/app';

export default function ConfirmEmail() {
    const { user, isEmailConfirmed, signOut, isLoading } = useAuth();
    const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    // If not logged in, redirect to login
    if (!isLoading && !user) {
        return <Navigate to="/login" replace />;
    }

    // If email is confirmed, redirect to home
    if (!isLoading && isEmailConfirmed) {
        return <Navigate to="/" replace />;
    }

    const handleResendEmail = async () => {
        if (!user?.email) return;

        setResendStatus('sending');
        setErrorMessage('');

        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: user.email,
            });

            if (error) {
                throw error;
            }

            setResendStatus('sent');
        } catch (error) {
            console.error('Error resending confirmation email:', error);
            setResendStatus('error');
            setErrorMessage(error instanceof Error ? error.message : 'Failed to resend email');
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-900 px-4">
            <div className="max-w-md w-full">
                <div className="bg-white dark:bg-surface-800 rounded-xl shadow-lg p-8 text-center">
                    {/* Icon */}
                    <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Mail className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
                        Confirm Your Email
                    </h1>

                    {/* Description */}
                    <p className="text-surface-600 dark:text-surface-400 mb-6">
                        We've sent a confirmation link to:
                    </p>

                    {/* Email display */}
                    <div className="bg-surface-100 dark:bg-surface-700 rounded-lg px-4 py-3 mb-6">
                        <p className="font-medium text-surface-900 dark:text-white">
                            {user?.email}
                        </p>
                    </div>

                    {/* Instructions */}
                    <div className="text-left bg-surface-50 dark:bg-surface-700/50 rounded-lg p-4 mb-6">
                        <p className="text-sm text-surface-600 dark:text-surface-400 mb-3">
                            Please check your inbox and:
                        </p>
                        <ol className="text-sm text-surface-600 dark:text-surface-400 space-y-2 list-decimal list-inside">
                            <li>Open the email from {APP_CONFIG.name}</li>
                            <li>Click the confirmation link</li>
                            <li>Return here and refresh the page</li>
                        </ol>
                    </div>

                    {/* Resend status messages */}
                    {resendStatus === 'sent' && (
                        <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-4">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm">Confirmation email sent!</span>
                        </div>
                    )}

                    {resendStatus === 'error' && (
                        <div className="text-red-600 dark:text-red-400 text-sm mb-4">
                            {errorMessage || 'Failed to resend email. Please try again.'}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={handleResendEmail}
                            disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-lg font-medium transition-colors"
                        >
                            {resendStatus === 'sending' ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    Sending...
                                </>
                            ) : resendStatus === 'sent' ? (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    Email Sent
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-5 h-5" />
                                    Resend Confirmation Email
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-100 hover:bg-surface-200 dark:bg-surface-700 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 rounded-lg font-medium transition-colors"
                        >
                            <RefreshCw className="w-5 h-5" />
                            I've Confirmed - Refresh
                        </button>

                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            Sign Out
                        </button>
                    </div>

                    {/* Help text */}
                    <p className="text-xs text-surface-500 dark:text-surface-500 mt-6">
                        Didn't receive the email? Check your spam folder or try resending.
                    </p>
                </div>
            </div>
        </div>
    );
}
