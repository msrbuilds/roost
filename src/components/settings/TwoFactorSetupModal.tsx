import { useState, useEffect } from 'react';
import { X, Loader2, Check, AlertCircle, Shield, CheckCircle } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface TwoFactorSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type SetupStep = 'intro' | 'scan' | 'verify' | 'complete';

export default function TwoFactorSetupModal({ isOpen, onClose, onSuccess }: TwoFactorSetupModalProps) {
    const [step, setStep] = useState<SetupStep>('intro');
    const [secret, setSecret] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [factorId, setFactorId] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('intro');
            setSecret('');
            setQrCode('');
            setFactorId('');
            setVerificationCode('');
            setError(null);
        }
    }, [isOpen]);

    const handleClose = () => {
        if (!isLoading) {
            if (factorId && step !== 'complete') {
                void supabase.auth.mfa.unenroll({ factorId });
            }
            onClose();
        }
    };

    const startSetup = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data, error: enrollError } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: 'Roost authenticator',
            });
            if (enrollError) throw enrollError;
            setFactorId(data.id);
            setSecret(data.totp.secret);
            setQrCode(data.totp.qr_code);
            setStep('scan');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to setup 2FA');
        } finally {
            setIsLoading(false);
        }
    };

    const verifyCode = async () => {
        if (verificationCode.length !== 6) {
            setError('Please enter a 6-digit code');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            if (!factorId) throw new Error('The enrollment session expired. Start again.');
            const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
                factorId,
                code: verificationCode,
            });
            if (verifyError) throw verifyError;

            const { data: { session } } = await supabase.auth.getSession();
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            if (session) {
                const statusResponse = await fetch(`${apiUrl}/api/auth/mfa/status`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (!statusResponse.ok) throw new Error('2FA was enrolled but the account status could not be synchronized.');
            }
            setStep('complete');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to verify code');
        } finally {
            setIsLoading(false);
        }
    };

    const completeSetup = () => {
        onSuccess();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 dark:bg-black/70"
                onClick={handleClose}
            />

            {/* Modal */}
            <div
                className="relative w-full max-w-lg mx-4 bg-white dark:bg-surface-900 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto"
                role="dialog"
                aria-modal="true"
                aria-labelledby="two-factor-setup-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-surface-200 dark:border-surface-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 id="two-factor-setup-title" className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                            Setup Two-Factor Authentication
                        </h2>
                    </div>
                    {step !== 'complete' && (
                        <button
                            onClick={handleClose}
                            disabled={isLoading}
                            aria-label="Close two-factor authentication setup"
                            className="p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Error message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Step: Intro */}
                    {step === 'intro' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />
                                </div>
                                <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
                                    Add an Extra Layer of Security
                                </h3>
                                <p className="text-surface-500 dark:text-surface-400">
                                    Two-factor authentication adds an additional layer of security to your account
                                    by requiring a code from your authenticator app when you sign in.
                                </p>
                            </div>

                            <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
                                <h4 className="font-medium text-surface-900 dark:text-surface-100 mb-2">
                                    You'll need:
                                </h4>
                                <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-green-500" />
                                        An authenticator app (Google Authenticator, Authy, etc.)
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-green-500" />
                                        Your phone nearby to scan a QR code
                                    </li>
                                </ul>
                            </div>

                            <button
                                onClick={startSetup}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Setting up...</span>
                                    </>
                                ) : (
                                    <span>Get Started</span>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Step: Scan QR Code */}
                    {step === 'scan' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
                                    Scan QR Code
                                </h3>
                                <p className="text-surface-500 dark:text-surface-400 text-sm">
                                    Open your authenticator app and scan this QR code
                                </p>
                            </div>

                            {/* QR Code */}
                            <div className="flex justify-center">
                                <div className="p-4 bg-white rounded-lg border border-surface-200 dark:border-surface-700">
                                    <img
                                        src={qrCode}
                                        alt="QR Code"
                                        className="w-48 h-48"
                                    />
                                </div>
                            </div>

                            {/* Manual entry option */}
                            <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4">
                                <p className="text-xs text-surface-500 dark:text-surface-400 mb-2">
                                    Can't scan? Enter this code manually:
                                </p>
                                <code className="block px-3 py-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded text-sm font-mono break-all">
                                    {secret}
                                </code>
                            </div>

                            <button
                                onClick={() => setStep('verify')}
                                className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {/* Step: Verify Code */}
                    {step === 'verify' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
                                    Enter Verification Code
                                </h3>
                                <p className="text-surface-500 dark:text-surface-400 text-sm">
                                    Enter the 6-digit code from your authenticator app
                                </p>
                            </div>

                            <div>
                                <input
                                    type="text"
                                    aria-label="Six-digit authenticator code"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    value={verificationCode}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                        setVerificationCode(value);
                                    }}
                                    placeholder="000000"
                                    className="input text-center text-2xl tracking-widest font-mono"
                                    maxLength={6}
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('scan')}
                                    className="flex-1 px-4 py-3 border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 rounded-lg font-medium hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={verifyCode}
                                    disabled={isLoading || verificationCode.length !== 6}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Verifying...</span>
                                        </>
                                    ) : (
                                        <span>Verify</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Complete */}
                    {step === 'complete' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                                </div>
                                <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
                                    Two-Factor Authentication Enabled
                                </h3>
                                <p className="text-surface-500 dark:text-surface-400 text-sm">
                                    Future sign-ins require a code from your authenticator app. Keep access to the app and contact an administrator if you lose your device.
                                </p>
                            </div>

                            <button
                                onClick={completeSetup}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                            >
                                <Check className="w-5 h-5" />
                                <span>Done</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
