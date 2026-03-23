import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Mail, Loader2, Eye, EyeOff, Shield, Key, CheckCircle, RefreshCw } from 'lucide-react';

type LoginStep = 'credentials' | '2fa' | 'email-not-confirmed';

export default function Login() {
    const navigate = useNavigate();

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [useBackupCode, setUseBackupCode] = useState(false);
    const [backupCode, setBackupCode] = useState('');

    // UI state
    const [step, setStep] = useState<LoginStep>('credentials');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [unconfirmedEmail, setUnconfirmedEmail] = useState<string>('');

    const handleCredentialsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const response = await fetch(`${apiUrl}/api/2fa/check-required`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Check if email is not confirmed
                if (data.code === 'EMAIL_NOT_CONFIRMED') {
                    setUnconfirmedEmail(data.email || email);
                    setStep('email-not-confirmed');
                    return;
                }
                throw new Error(data.error || 'Invalid email or password');
            }

            if (data.requires2FA) {
                // User has 2FA enabled, show 2FA step
                setStep('2fa');
            } else {
                // No 2FA, set the session and navigate
                if (data.session) {
                    await supabase.auth.setSession({
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token,
                    });
                    navigate('/');
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to sign in');
        } finally {
            setIsLoading(false);
        }
    };

    const handle2FASubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const endpoint = useBackupCode ? '/api/2fa/verify-login-backup' : '/api/2fa/verify-login';
            const code = useBackupCode ? backupCode : twoFactorCode;

            const response = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, code }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Invalid verification code');
            }

            // Set the session and navigate
            if (data.session) {
                await supabase.auth.setSession({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                });
                navigate('/');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to verify code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToCredentials = () => {
        setStep('credentials');
        setTwoFactorCode('');
        setBackupCode('');
        setUseBackupCode(false);
        setError(null);
        setResendStatus('idle');
    };

    const handleResendConfirmation = async () => {
        if (!unconfirmedEmail) return;

        setResendStatus('sending');
        setError(null);

        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: unconfirmedEmail,
            });

            if (error) {
                throw error;
            }

            setResendStatus('sent');
        } catch (err) {
            console.error('Error resending confirmation email:', err);
            setResendStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to resend confirmation email');
        }
    };

    // Tab toggle component
    const TabToggle = ({ active }: { active: 'login' | 'signup' }) => (
        <div className="flex bg-surface-100 dark:bg-surface-800 rounded-xl p-1 mb-8">
            <Link
                to="/login"
                className={`flex-1 py-2.5 text-center text-sm font-medium rounded-lg transition-all duration-200 ${
                    active === 'login'
                        ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
                        : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
                }`}
            >
                Login
            </Link>
            <Link
                to="/signup"
                className={`flex-1 py-2.5 text-center text-sm font-medium rounded-lg transition-all duration-200 ${
                    active === 'signup'
                        ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
                        : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
                }`}
            >
                Sign Up
            </Link>
        </div>
    );

    // Email not confirmed step
    if (step === 'email-not-confirmed') {
        return (
            <div className="animate-fade-in">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Mail className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                        Email Not Confirmed
                    </h1>
                    <p className="text-surface-500 dark:text-surface-400 mt-2 text-sm">
                        Please confirm your email address to continue
                    </p>
                </div>

                {/* Email display */}
                <div className="bg-surface-100 dark:bg-surface-800 rounded-lg px-4 py-3 mb-6 text-center">
                    <p className="font-medium text-surface-900 dark:text-white text-sm">
                        {unconfirmedEmail}
                    </p>
                </div>

                {/* Instructions */}
                <div className="bg-surface-50 dark:bg-surface-800/50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-surface-600 dark:text-surface-400 mb-3">
                        We've sent a confirmation link to your email. Please:
                    </p>
                    <ol className="text-sm text-surface-600 dark:text-surface-400 space-y-2 list-decimal list-inside">
                        <li>Check your inbox (and spam folder)</li>
                        <li>Click the confirmation link</li>
                        <li>Return here and try logging in again</li>
                    </ol>
                </div>

                {/* Resend status messages */}
                {resendStatus === 'sent' && (
                    <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-4">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm">Confirmation email sent!</span>
                    </div>
                )}

                {error && resendStatus === 'error' && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="space-y-3">
                    <button
                        onClick={handleResendConfirmation}
                        disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-lg font-medium transition-colors text-sm"
                    >
                        {resendStatus === 'sending' ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Sending...
                            </>
                        ) : resendStatus === 'sent' ? (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Email Sent
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                Resend Confirmation Email
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleBackToCredentials}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-lg font-medium transition-colors text-sm"
                    >
                        Back to Login
                    </button>
                </div>

                {/* Help text */}
                <p className="text-xs text-surface-500 mt-6 text-center">
                    Didn't receive the email? Check your spam folder or try resending.
                </p>
            </div>
        );
    }

    // Credentials step
    if (step === 'credentials') {
        return (
            <div className="animate-fade-in">
                {/* Tab Toggle */}
                <TabToggle active="login" />

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Welcome back</h1>
                    <p className="text-surface-500 dark:text-surface-400 mt-1 text-sm">Sign in to your account to continue</p>
                </div>

                {/* Error message */}
                {error && (
                    <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Login form */}
                <form onSubmit={handleCredentialsSubmit} className="space-y-5">
                    {/* Email field */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-surface-900 dark:text-surface-200 mb-1.5">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className="input w-full"
                            disabled={isLoading}
                        />
                    </div>

                    {/* Password field */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-surface-900 dark:text-surface-200 mb-1.5">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                className="input w-full pr-10"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                            >
                                {showPassword ? (
                                    <EyeOff className="w-4 h-4" />
                                ) : (
                                    <Eye className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Forgot password link */}
                    <div className="flex justify-end">
                        <Link
                            to="/forgot-password"
                            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                        >
                            Forgot password?
                        </Link>
                    </div>

                    {/* Submit button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary w-full py-2.5"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Signing in...</span>
                            </>
                        ) : (
                            <span>Sign In</span>
                        )}
                    </button>
                </form>
            </div>
        );
    }

    // 2FA step
    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                </div>
                <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                    Two-Factor Authentication
                </h1>
                <p className="text-surface-500 dark:text-surface-400 mt-2 text-sm">
                    {useBackupCode
                        ? 'Enter one of your backup codes'
                        : 'Enter the 6-digit code from your authenticator app'
                    }
                </p>
            </div>

            {/* Error message */}
            {error && (
                <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* 2FA form */}
            <form onSubmit={handle2FASubmit} className="space-y-5">
                {useBackupCode ? (
                    <div>
                        <label htmlFor="backupCode" className="block text-sm font-medium text-surface-900 dark:text-surface-200 mb-1.5">
                            Backup Code
                        </label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                            <input
                                id="backupCode"
                                type="text"
                                value={backupCode}
                                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                                placeholder="XXXX-XXXX"
                                required
                                className="input w-full pl-10 font-mono tracking-wider"
                                disabled={isLoading}
                                autoFocus
                            />
                        </div>
                    </div>
                ) : (
                    <div>
                        <label htmlFor="twoFactorCode" className="block text-sm font-medium text-surface-900 dark:text-surface-200 mb-1.5">
                            Verification Code
                        </label>
                        <input
                            id="twoFactorCode"
                            type="text"
                            value={twoFactorCode}
                            onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                setTwoFactorCode(value);
                            }}
                            placeholder="000000"
                            required
                            maxLength={6}
                            className="input w-full text-center text-2xl tracking-widest font-mono"
                            disabled={isLoading}
                            autoFocus
                        />
                    </div>
                )}

                {/* Submit button */}
                <button
                    type="submit"
                    disabled={isLoading || (useBackupCode ? !backupCode : twoFactorCode.length !== 6)}
                    className="btn-primary w-full py-2.5"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Verifying...</span>
                        </>
                    ) : (
                        <span>Verify & Sign in</span>
                    )}
                </button>
            </form>

            {/* Toggle backup code / authenticator */}
            <div className="mt-4 text-center">
                <button
                    type="button"
                    onClick={() => {
                        setUseBackupCode(!useBackupCode);
                        setError(null);
                        setTwoFactorCode('');
                        setBackupCode('');
                    }}
                    className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                    {useBackupCode
                        ? 'Use authenticator app instead'
                        : 'Use a backup code instead'
                    }
                </button>
            </div>

            {/* Back to login */}
            <div className="mt-6 text-center">
                <button
                    type="button"
                    onClick={handleBackToCredentials}
                    className="text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
                >
                    &larr; Back to login
                </button>
            </div>
        </div>
    );
}
