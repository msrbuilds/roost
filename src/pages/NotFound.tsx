import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <main className="min-h-screen grid place-items-center p-6 bg-surface-50 dark:bg-surface-950">
            <div className="text-center">
                <p className="text-sm font-semibold text-primary-600">404</p>
                <h1 className="mt-2 text-3xl font-bold text-surface-900 dark:text-white">Page not found</h1>
                <p className="mt-3 text-surface-500">The page may have moved or no longer exists.</p>
                <Link to="/" className="btn-primary inline-flex mt-6">Return home</Link>
            </div>
        </main>
    );
}
