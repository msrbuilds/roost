import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, Loader2, XCircle, AlertCircle, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isUsernameAvailable, isValidUsername } from '@/services/profile';
import { APP_CONFIG } from '@/config/app';

// Password strength calculation
interface PasswordStrength {
    score: number; // 0-4
    label: string;
    color: string;
    bgColor: string;
}

function calculatePasswordStrength(password: string): PasswordStrength {
    let score = 0;

    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    // Cap at 4
    score = Math.min(score, 4);

    const strengths: PasswordStrength[] = [
        { score: 0, label: 'Too weak', color: 'text-red-500', bgColor: 'bg-red-500' },
        { score: 1, label: 'Weak', color: 'text-orange-500', bgColor: 'bg-orange-500' },
        { score: 2, label: 'Fair', color: 'text-yellow-500', bgColor: 'bg-yellow-500' },
        { score: 3, label: 'Good', color: 'text-lime-500', bgColor: 'bg-lime-500' },
        { score: 4, label: 'Strong', color: 'text-green-500', bgColor: 'bg-green-500' },
    ];

    return strengths[score];
}

export default function Signup() {
    const navigate = useNavigate();
    const { signUp } = useAuth();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        username: '',
        displayName: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
    const [confirmationEmail, setConfirmationEmail] = useState('');

    // Username validation state
    const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
    const [usernameError, setUsernameError] = useState<string | null>(null);

    // Password strength
    const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);

    // Check username availability with debounce
    useEffect(() => {
        const username = formData.username.trim().toLowerCase();

        if (!username) {
            setUsernameStatus('idle');
            setUsernameError(null);
            return;
        }

        if (username.length < 3) {
            setUsernameStatus('invalid');
            setUsernameError('Username must be at least 3 characters');
            return;
        }

        if (!isValidUsername(username)) {
            setUsernameStatus('invalid');
            setUsernameError('Only letters, numbers, underscores, and hyphens allowed');
            return;
        }

        setUsernameStatus('checking');
        setUsernameError(null);

        const timeoutId = setTimeout(async () => {
            try {
                const available = await isUsernameAvailable(username);
                setUsernameStatus(available ? 'available' : 'taken');
                setUsernameError(available ? null : 'Username is already taken');
            } catch {
                setUsernameStatus('idle');
                setUsernameError(null);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [formData.username]);

    // Update password strength when password changes
    useEffect(() => {
        if (formData.password) {
            setPasswordStrength(calculatePasswordStrength(formData.password));
        } else {
            setPasswordStrength(null);
        }
    }, [formData.password]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError(null);
    };

    const validateForm = (): string | null => {
        if (!formData.email || !formData.password || !formData.username || !formData.displayName) {
            return 'All fields are required';
        }
        if (formData.password.length < 6) {
            return 'Password must be at least 6 characters';
        }
        if (formData.password !== formData.confirmPassword) {
            return 'Passwords do not match';
        }
        if (usernameStatus === 'taken') {
            return 'Username is already taken';
        }
        if (usernameStatus === 'invalid') {
            return usernameError || 'Invalid username';
        }
        return null;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await signUp(formData.email, formData.password, {
                username: formData.username.toLowerCase(),
                display_name: formData.displayName,
            });

            if (result.requiresEmailConfirmation) {
                // Show email confirmation message
                setConfirmationEmail(result.email);
                setEmailConfirmationSent(true);
            } else {
                // Email confirmation disabled - redirect to home
                navigate('/');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create account';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    // Username status indicator
    const renderUsernameStatus = () => {
        if (usernameStatus === 'idle' || !formData.username) return null;

        if (usernameStatus === 'checking') {
            return (
                <div className="flex items-center gap-1 mt-1 text-surface-500 text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Checking...</span>
                </div>
            );
        }

        if (usernameStatus === 'available') {
            return (
                <div className="flex items-center gap-1 mt-1 text-green-600 dark:text-green-400 text-xs">
                    <CheckCircle className="w-3 h-3" />
                    <span>Available</span>
                </div>
            );
        }

        if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
            return (
                <div className="flex items-center gap-1 mt-1 text-red-600 dark:text-red-400 text-xs">
                    <XCircle className="w-3 h-3" />
                    <span>{usernameError}</span>
                </div>
            );
        }

        return null;
    };

    // Password strength indicator
    const renderPasswordStrength = () => {
        if (!passwordStrength || !formData.password) return null;

        return (
            <div className="mt-1.5">
                {/* Strength bar */}
                <div className="flex gap-0.5 mb-0.5">
                    {[0, 1, 2, 3].map((index) => (
                        <div
                            key={index}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                                index < passwordStrength.score
                                    ? passwordStrength.bgColor
                                    : 'bg-surface-200 dark:bg-surface-700'
                            }`}
                        />
                    ))}
                </div>
                {/* Strength label */}
                <div className={`flex items-center gap-1 text-xs ${passwordStrength.color}`}>
                    {passwordStrength.score < 2 ? (
                        <AlertCircle className="w-3 h-3" />
                    ) : (
                        <CheckCircle className="w-3 h-3" />
                    )}
                    <span>{passwordStrength.label}</span>
                </div>
            </div>
        );
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

    // Show email confirmation message after successful signup
    if (emailConfirmationSent) {
        return (
            <div className="animate-fade-in">
                <div className="text-center">
                    <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Mail className="w-7 h-7 text-green-600 dark:text-green-400" />
                    </div>
                    <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100 mb-2">
                        Check your email
                    </h1>
                    <p className="text-surface-600 dark:text-surface-400 text-sm mb-4">
                        We've sent a confirmation link to:
                    </p>
                    <p className="font-medium text-surface-900 dark:text-surface-100 mb-6 break-all">
                        {confirmationEmail}
                    </p>
                    <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 text-left text-sm text-surface-600 dark:text-surface-400 mb-6">
                        <p className="mb-2">
                            <strong>Next steps:</strong>
                        </p>
                        <ol className="list-decimal list-inside space-y-1">
                            <li>Open the email we just sent</li>
                            <li>Click the confirmation link</li>
                            <li>Start using {APP_CONFIG.name}!</li>
                        </ol>
                    </div>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mb-4">
                        Didn't receive the email? Check your spam folder or{' '}
                        <button
                            onClick={() => setEmailConfirmationSent(false)}
                            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                        >
                            try again
                        </button>
                    </p>
                    <Link
                        to="/login"
                        className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
                    >
                        Back to login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Tab Toggle */}
            <TabToggle active="signup" />

            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Create an account</h1>
                <p className="text-surface-500 dark:text-surface-400 mt-1 text-sm">
                    Join the community and start vibing
                </p>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Display Name */}
                <div>
                    <label htmlFor="displayName" className="block text-sm font-medium text-surface-900 dark:text-surface-200 mb-1.5">
                        Full Name
                    </label>
                    <input
                        type="text"
                        id="displayName"
                        name="displayName"
                        value={formData.displayName}
                        onChange={handleChange}
                        className="input w-full"
                        placeholder="Your full name"
                        required
                        disabled={isLoading}
                    />
                </div>

                {/* Username */}
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-surface-900 dark:text-surface-200 mb-1.5">
                        Username
                    </label>
                    <input
                        type="text"
                        id="username"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        className={`input w-full ${
                            usernameStatus === 'available'
                                ? 'border-green-500 focus:ring-green-500'
                                : usernameStatus === 'taken' || usernameStatus === 'invalid'
                                ? 'border-red-500 focus:ring-red-500'
                                : ''
                        }`}
                        placeholder="johndoe"
                        required
                        disabled={isLoading}
                    />
                    {renderUsernameStatus()}
                </div>

                {/* Email */}
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-surface-900 dark:text-surface-200 mb-1.5">
                        Email
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="input w-full"
                        placeholder="you@example.com"
                        required
                        disabled={isLoading}
                    />
                </div>

                {/* Password */}
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-surface-900 dark:text-surface-200 mb-1.5">
                        Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="input w-full pr-10"
                            placeholder="Min. 6 characters"
                            required
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {renderPasswordStrength()}
                </div>

                {/* Confirm Password */}
                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-surface-900 dark:text-surface-200 mb-1.5">
                        Confirm Password
                    </label>
                    <div className="relative">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className={`input w-full pr-10 ${
                                formData.confirmPassword && formData.password !== formData.confirmPassword
                                    ? 'border-red-500 focus:ring-red-500'
                                    : formData.confirmPassword && formData.password === formData.confirmPassword
                                    ? 'border-green-500 focus:ring-green-500'
                                    : ''
                            }`}
                            placeholder="Confirm your password"
                            required
                            disabled={isLoading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                        >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                        <div className="flex items-center gap-1 mt-1 text-red-600 dark:text-red-400 text-xs">
                            <XCircle className="w-3 h-3" />
                            <span>Passwords do not match</span>
                        </div>
                    )}
                </div>

                {/* Submit button */}
                <button
                    type="submit"
                    disabled={isLoading || usernameStatus === 'checking' || usernameStatus === 'taken' || usernameStatus === 'invalid'}
                    className="btn-primary w-full py-2.5"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Creating account...</span>
                        </>
                    ) : (
                        <span>Create Account</span>
                    )}
                </button>
            </form>
        </div>
    );
}
