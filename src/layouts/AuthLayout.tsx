import { Outlet, useLocation } from 'react-router-dom';
import { Crown, CheckCircle } from 'lucide-react';
import { APP_CONFIG } from '@/config/app';

const premiumBenefits = [
    { text: 'Everything in Free, plus:', bold: true },
    { text: 'Direct messaging with members', bold: false },
    { text: 'Access to premium groups', bold: false },
    { text: 'Priority support', bold: false },
    { text: 'Exclusive content and events', bold: false },
];

export default function AuthLayout() {
    const location = useLocation();
    const isMainAuth = ['/login', '/signup'].includes(location.pathname);

    // For forgot-password, reset-password, etc. - keep simple centered layout
    if (!isMainAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200/30 dark:bg-primary-900/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-300/20 dark:bg-primary-800/20 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10 w-full py-8 px-4">
                    <Outlet />
                </div>
            </div>
        );
    }

    // Split-screen layout for Login & Signup
    return (
        <div className="min-h-screen flex flex-col lg:flex-row">
            {/* Left Panel - Branding & Premium */}
            <div className="hidden lg:flex lg:w-[48%] xl:w-[45%] bg-gradient-to-br from-amber-50 via-orange-50/60 to-amber-50/80 dark:from-surface-900 dark:via-surface-850 dark:to-surface-800 p-8 xl:p-12 flex-col justify-center relative overflow-hidden">
                {/* Decorative background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-200/30 dark:bg-amber-900/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-orange-200/30 dark:bg-orange-900/10 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10 max-w-md mx-auto w-full">
                    {/* Logo & Brand */}
                    <div className="flex flex-col items-center gap-2 mb-10">
                        <img src="/logo-square-sm.png" alt={APP_CONFIG.name} className="w-12 h-12 rounded-xl shadow-lg" />
                        <div className="text-center">
                            <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100 leading-tight">{APP_CONFIG.name}</h2>
                            <p className="text-xs text-surface-500 dark:text-surface-400">Community Platform</p>
                        </div>
                    </div>

                    {/* Premium Card */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl p-6 xl:p-8">
                        {/* Crown Icon */}
                        <div className="text-center mb-5">
                            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-400/30">
                                <Crown className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Go Premium</h3>
                            <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
                                Unlock all features and exclusive content
                            </p>
                        </div>

                        {/* Benefits List */}
                        <div className="mb-6">
                            <ul className="space-y-3">
                                {premiumBenefits.map((benefit, index) => (
                                    <li key={index} className="flex items-center gap-2.5 text-sm text-surface-700 dark:text-surface-300">
                                        <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                        <span className={benefit.bold ? 'font-semibold' : ''}>{benefit.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* CTA Text */}
                        <div className="w-full py-3 text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl">
                            <span>Get Premium Membership</span>
                        </div>

                        <p className="text-xs text-surface-500 dark:text-surface-400 text-center mt-3">
                            Sign up to get started. Upgrade to premium anytime.
                        </p>

                        {/* Note */}
                        <div className="mt-4 p-3 bg-white/60 dark:bg-surface-800/50 rounded-lg">
                            <p className="text-xs text-surface-600 dark:text-surface-400 text-center">
                                Not sure yet? Start with a free account and upgrade anytime!
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center px-5 py-8 sm:px-8 bg-white dark:bg-surface-950 min-h-screen lg:min-h-0 overflow-y-auto">
                <div className="w-full max-w-[420px] lg:max-w-md">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
