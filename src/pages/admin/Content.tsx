import { useEffect, useState, useCallback } from 'react';
import {
    Search,
    FileText,
    MessageSquare,
    Trash2,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Eye,
} from 'lucide-react';
import {
    getPostsForModeration,
    getCommentsForModeration,
    deletePostAsAdmin,
    deleteCommentAsAdmin,
} from '../../services';

type ContentType = 'posts' | 'comments';

interface PostItem {
    id: string;
    title: string | null;
    content: string;
    created_at: string;
    author: {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
    };
    category: {
        id: string;
        name: string;
        color: string | null;
    } | null;
}

interface CommentItem {
    id: string;
    content: string;
    created_at: string;
    author: {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
    };
    post: {
        id: string;
        title: string | null;
    };
}

export default function AdminContent() {
    const [contentType, setContentType] = useState<ContentType>('posts');
    const [posts, setPosts] = useState<PostItem[]>([]);
    const [comments, setComments] = useState<CommentItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const pageSize = 15;

    const loadContent = useCallback(async () => {
        setLoading(true);
        try {
            if (contentType === 'posts') {
                const { posts: data, total: count } = await getPostsForModeration({
                    page,
                    pageSize,
                    search,
                });
                setPosts(data as PostItem[]);
                setTotal(count);
            } else {
                const { comments: data, total: count } = await getCommentsForModeration({
                    page,
                    pageSize,
                    search,
                });
                setComments(data as CommentItem[]);
                setTotal(count);
            }
        } catch (err) {
            console.error('Failed to load content:', err);
        } finally {
            setLoading(false);
        }
    }, [contentType, page, search]);

    useEffect(() => {
        loadContent();
    }, [loadContent]);

    const handleDeletePost = async (postId: string) => {
        if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            return;
        }
        setDeleting(postId);
        try {
            await deletePostAsAdmin(postId);
            loadContent();
        } catch (err) {
            console.error('Failed to delete post:', err);
            alert('Failed to delete post');
        } finally {
            setDeleting(null);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
            return;
        }
        setDeleting(commentId);
        try {
            await deleteCommentAsAdmin(commentId);
            loadContent();
        } catch (err) {
            console.error('Failed to delete comment:', err);
            alert('Failed to delete comment');
        } finally {
            setDeleting(null);
        }
    };

    const truncateHtml = (html: string, maxLength: number = 200) => {
        const text = html.replace(/<[^>]*>/g, '');
        return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Content Moderation</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Review and moderate posts and comments</p>
            </div>

            {/* Tabs and Search */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex bg-gray-100 dark:bg-surface-800 rounded-lg p-1">
                    <button
                        onClick={() => {
                            setContentType('posts');
                            setPage(1);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${contentType === 'posts'
                                ? 'bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                    >
                        <FileText className="w-4 h-4" />
                        Posts
                    </button>
                    <button
                        onClick={() => {
                            setContentType('comments');
                            setPage(1);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${contentType === 'comments'
                                ? 'bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        Comments
                    </button>
                </div>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        placeholder={`Search ${contentType}...`}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Content Table */}
            <div className="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-gray-100 dark:border-surface-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-surface-800 border-b border-gray-100 dark:border-surface-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {contentType === 'posts' ? 'Post' : 'Comment'}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Author
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {contentType === 'posts' ? 'Category' : 'On Post'}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-surface-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        Loading...
                                    </td>
                                </tr>
                            ) : contentType === 'posts' && posts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        No posts found
                                    </td>
                                </tr>
                            ) : contentType === 'comments' && comments.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        No comments found
                                    </td>
                                </tr>
                            ) : contentType === 'posts' ? (
                                posts.map((post) => (
                                    <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-surface-800">
                                        <td className="px-6 py-4 max-w-md">
                                            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                                {post.title || 'Untitled'}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                                {truncateHtml(post.content)}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <img
                                                    src={post.author.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author.display_name)}`}
                                                    alt=""
                                                    className="w-8 h-8 rounded-full"
                                                />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{post.author.display_name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">@{post.author.username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {post.category ? (
                                                <span
                                                    className="inline-flex px-2 py-1 rounded-full text-xs font-medium"
                                                    style={{
                                                        backgroundColor: `${post.category.color}20`,
                                                        color: post.category.color || '#666',
                                                    }}
                                                >
                                                    {post.category.name}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 dark:text-gray-500 text-sm">None</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(post.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <a
                                                    href={`/post/${post.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                                                    title="View post"
                                                >
                                                    <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                                </a>
                                                <button
                                                    onClick={() => handleDeletePost(post.id)}
                                                    disabled={deleting === post.id}
                                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-500 dark:text-red-400"
                                                    title="Delete post"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                comments.map((comment) => (
                                    <tr key={comment.id} className="hover:bg-gray-50 dark:hover:bg-surface-800">
                                        <td className="px-6 py-4 max-w-md">
                                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                                                {truncateHtml(comment.content)}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <img
                                                    src={comment.author.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author.display_name)}`}
                                                    alt=""
                                                    className="w-8 h-8 rounded-full"
                                                />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{comment.author.display_name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">@{comment.author.username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <a
                                                href={`/post/${comment.post.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                                            >
                                                {comment.post.title || 'View post'}
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(comment.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteComment(comment.id)}
                                                disabled={deleting === comment.id}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-500 dark:text-red-400"
                                                title="Delete comment"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-surface-700 flex items-center justify-between">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 border border-gray-200 dark:border-surface-700 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-800 disabled:opacity-50"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            </button>
                            <span className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 border border-gray-200 dark:border-surface-700 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-800 disabled:opacity-50"
                            >
                                <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
