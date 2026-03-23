import { useEffect, useState, useCallback } from 'react';
import {
    Search,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Crown,
    Ban,
    UserCheck,
    MoreVertical,
    ChevronLeft,
    ChevronRight,
    Star,
} from 'lucide-react';
import { BanUserModal } from '../../components/admin';
import {
    getUsers,
    unbanUser,
    updateUserRole,
    updateMembershipType,
    checkIsSuperadmin,
} from '../../services';
import type { UserWithBanInfo } from '../../services';
import type { UserRole } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';

const ROLE_COLORS: Record<string, string> = {
    user: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    moderator: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    admin: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    superadmin: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
};

const ROLE_ICONS: Record<string, typeof Shield> = {
    user: Shield,
    moderator: ShieldCheck,
    admin: ShieldAlert,
    superadmin: Crown,
};

export default function AdminUsers() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserWithBanInfo[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const [loading, setLoading] = useState(true);
    const [isSuperadmin, setIsSuperadmin] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserWithBanInfo | null>(null);
    const [showBanModal, setShowBanModal] = useState(false);
    const [actionMenuUser, setActionMenuUser] = useState<string | null>(null);
    const pageSize = 20;

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const { users: data, total: count } = await getUsers({
                page,
                pageSize,
                search,
                role: roleFilter,
                showBanned: true,
            });
            setUsers(data);
            setTotal(count);
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            setLoading(false);
        }
    }, [page, search, roleFilter]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        if (currentUser) {
            checkIsSuperadmin(currentUser.id).then(setIsSuperadmin);
        }
    }, [currentUser]);

    const handleBan = (user: UserWithBanInfo) => {
        setSelectedUser(user);
        setShowBanModal(true);
        setActionMenuUser(null);
    };

    const handleUnban = async (userId: string) => {
        if (!currentUser) return;
        try {
            await unbanUser(userId, currentUser.id);
            loadUsers();
        } catch (err) {
            console.error('Failed to unban user:', err);
        }
        setActionMenuUser(null);
    };

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        try {
            await updateUserRole(userId, newRole);
            loadUsers();
        } catch (err) {
            console.error('Failed to update role:', err);
            alert(err instanceof Error ? err.message : 'Failed to update role');
        }
        setActionMenuUser(null);
    };

    const handleMembershipChange = async (userId: string, newType: 'free' | 'premium') => {
        try {
            await updateMembershipType(userId, newType);
            loadUsers();
        } catch (err) {
            console.error('Failed to update membership:', err);
            alert(err instanceof Error ? err.message : 'Failed to update membership');
        }
        setActionMenuUser(null);
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Manage users, roles, and bans</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Search users..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => {
                        setRoleFilter(e.target.value as UserRole | 'all');
                        setPage(1);
                    }}
                    className="px-4 py-2.5 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                    <option value="all">All Roles</option>
                    <option value="user">Users</option>
                    <option value="moderator">Moderators</option>
                    <option value="admin">Admins</option>
                    <option value="superadmin">Superadmins</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-gray-100 dark:border-surface-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-surface-800 border-b border-gray-100 dark:border-surface-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Membership
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Joined
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-surface-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        Loading...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        No users found
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => {
                                    const RoleIcon = ROLE_ICONS[user.role || 'user'];
                                    const isCurrentUser = user.id === currentUser?.id;

                                    return (
                                        <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-surface-800">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}`}
                                                        alt={user.display_name}
                                                        className="w-10 h-10 rounded-full object-cover"
                                                    />
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-gray-100">{user.display_name}</p>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.role || 'user']}`}>
                                                    <RoleIcon className="w-3.5 h-3.5" />
                                                    {(user.role || 'user').charAt(0).toUpperCase() + (user.role || 'user').slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.membership_type === 'premium' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                        <Star className="w-3.5 h-3.5" />
                                                        Premium
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                                        Free
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.is_banned ? (
                                                    <div>
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                                            <Ban className="w-3.5 h-3.5" />
                                                            Banned
                                                        </span>
                                                        {user.ban_expires_at && (
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                Until {new Date(user.ban_expires_at).toLocaleDateString()}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                                        <UserCheck className="w-3.5 h-3.5" />
                                                        Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {!isCurrentUser && (
                                                    <div className="relative inline-block">
                                                        <button
                                                            onClick={() => setActionMenuUser(actionMenuUser === user.id ? null : user.id)}
                                                            className="p-2 hover:bg-gray-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                                                        >
                                                            <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                                        </button>

                                                        {actionMenuUser === user.id && (
                                                            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-surface-800 rounded-lg shadow-lg border border-gray-100 dark:border-surface-700 z-10">
                                                                {user.is_banned ? (
                                                                    <button
                                                                        onClick={() => handleUnban(user.id)}
                                                                        className="w-full px-4 py-2 text-left text-sm text-green-600 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-surface-700 flex items-center gap-2"
                                                                    >
                                                                        <UserCheck className="w-4 h-4" />
                                                                        Unban User
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleBan(user)}
                                                                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-surface-700 flex items-center gap-2"
                                                                    >
                                                                        <Ban className="w-4 h-4" />
                                                                        Ban User
                                                                    </button>
                                                                )}
                                                                <hr className="my-1 border-gray-100 dark:border-surface-700" />
                                                                {user.membership_type === 'premium' ? (
                                                                    <button
                                                                        onClick={() => handleMembershipChange(user.id, 'free')}
                                                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700 flex items-center gap-2"
                                                                    >
                                                                        <Star className="w-4 h-4" />
                                                                        Remove Premium
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleMembershipChange(user.id, 'premium')}
                                                                        className="w-full px-4 py-2 text-left text-sm text-amber-600 dark:text-amber-400 hover:bg-gray-50 dark:hover:bg-surface-700 flex items-center gap-2"
                                                                    >
                                                                        <Star className="w-4 h-4" />
                                                                        Make Premium
                                                                    </button>
                                                                )}
                                                                {isSuperadmin && user.role !== 'superadmin' && (
                                                                    <>
                                                                        <hr className="my-1 border-gray-100 dark:border-surface-700" />
                                                                        <div className="px-4 py-1 text-xs text-gray-500 dark:text-gray-400">Change Role</div>
                                                                        {(['user', 'moderator', 'admin'] as UserRole[])
                                                                            .filter((r) => r !== user.role)
                                                                            .map((role) => {
                                                                                const Icon = ROLE_ICONS[role];
                                                                                return (
                                                                                    <button
                                                                                        key={role}
                                                                                        onClick={() => handleRoleChange(user.id, role)}
                                                                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700 flex items-center gap-2"
                                                                                    >
                                                                                        <Icon className="w-4 h-4" />
                                                                                        Make {role.charAt(0).toUpperCase() + role.slice(1)}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-surface-700 flex items-center justify-between">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} users
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 border border-gray-200 dark:border-surface-700 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            </button>
                            <span className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 border border-gray-200 dark:border-surface-700 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Ban Modal */}
            {showBanModal && selectedUser && currentUser && (
                <BanUserModal
                    user={selectedUser}
                    adminUserId={currentUser.id}
                    onClose={() => {
                        setShowBanModal(false);
                        setSelectedUser(null);
                    }}
                    onBanned={loadUsers}
                />
            )}
        </div>
    );
}
