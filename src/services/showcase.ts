import { supabase } from './supabase';
import type {
    Showcase,
    ShowcaseInsert,
    ShowcaseUpdate,
    ShowcaseImage,
    ShowcaseImageInsert,
    ShowcaseTag,
    ShowcaseReview,
    ShowcaseReviewInsert,
    ShowcaseReviewUpdate,
    ShowcaseStatus,
    Profile,
} from '@/types/database';
import type {
    ShowcaseWithDetails,
    ShowcaseCardData,
    ShowcaseReviewWithAuthor,
    ShowcaseForModeration,
    ShowcaseFilters,
    ShowcasePaginationOptions,
    ShowcaseStats,
} from '@/types/showcase';

// =============================================================================
// SHOWCASE CRUD
// =============================================================================

/**
 * Create a new showcase submission
 */
export async function createShowcase(
    data: Omit<ShowcaseInsert, 'status' | 'vote_count' | 'review_count' | 'average_rating'>
): Promise<Showcase> {
    const { data: showcase, error } = await supabase
        .from('showcases')
        .insert({
            ...data,
            status: 'pending',
            vote_count: 0,
            review_count: 0,
            average_rating: 0,
        } as never)
        .select()
        .single();

    if (error) {
        console.error('Error creating showcase:', error);
        throw error;
    }

    return showcase as Showcase;
}

/**
 * Update an existing showcase
 */
export async function updateShowcase(
    id: string,
    updates: ShowcaseUpdate
): Promise<Showcase> {
    const { data, error } = await supabase
        .from('showcases')
        .update({ ...updates, updated_at: new Date().toISOString() } as never)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating showcase:', error);
        throw error;
    }

    return data as Showcase;
}

/**
 * Delete a showcase
 */
export async function deleteShowcase(id: string): Promise<void> {
    const { error } = await supabase.from('showcases').delete().eq('id', id);

    if (error) {
        console.error('Error deleting showcase:', error);
        throw error;
    }
}

/**
 * Get a single showcase by ID with full details
 */
export async function getShowcaseById(
    id: string,
    userId?: string
): Promise<ShowcaseWithDetails | null> {
    const { data, error } = await supabase
        .from('showcases')
        .select(`
            *,
            author:profiles!showcases_author_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('id', id)
        .single();

    if (error || !data) {
        console.error('Error fetching showcase:', error);
        return null;
    }

    // Fetch images
    const { data: images } = await supabase
        .from('showcase_images')
        .select('*')
        .eq('showcase_id', id)
        .order('display_order', { ascending: true });

    // Fetch tags via junction table
    const { data: tagRelations } = await supabase
        .from('showcase_tag_relations')
        .select('tag_id, showcase_tags(*)')
        .eq('showcase_id', id);

    const tags = tagRelations?.map((r) => r.showcase_tags).filter(Boolean) as ShowcaseTag[] || [];

    // Check if current user has voted
    let userHasVoted = false;
    let userReview: ShowcaseReviewWithAuthor | null = null;

    if (userId) {
        const { data: voteData } = await supabase
            .from('reactions')
            .select('id')
            .eq('user_id', userId)
            .eq('reactable_type', 'showcase')
            .eq('reactable_id', id)
            .single();

        userHasVoted = !!voteData;

        // Get user's review if any
        const { data: reviewData } = await supabase
            .from('showcase_reviews')
            .select(`
                *,
                author:profiles!showcase_reviews_author_id_fkey(id, username, display_name, avatar_url)
            `)
            .eq('showcase_id', id)
            .eq('author_id', userId)
            .single();

        userReview = reviewData as ShowcaseReviewWithAuthor | null;
    }

    return {
        ...data,
        author: data.author as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>,
        images: (images || []) as ShowcaseImage[],
        tags,
        user_has_voted: userHasVoted,
        user_review: userReview,
    } as ShowcaseWithDetails;
}

/**
 * Get approved showcases for the discovery page
 */
export async function getApprovedShowcases(
    filters: ShowcaseFilters = {},
    pagination: ShowcasePaginationOptions = {}
): Promise<{ showcases: ShowcaseCardData[]; total: number; hasMore: boolean }> {
    const { category, tagIds, sortBy = 'newest', search } = filters;
    const { page = 1, pageSize = 12 } = pagination;
    const offset = (page - 1) * pageSize;

    let query = supabase
        .from('showcases')
        .select(`
            id, title, tagline, thumbnail_url, category, vote_count, review_count, average_rating, launch_date, is_featured,
            author:profiles!showcases_author_id_fkey(id, username, display_name, avatar_url)
        `, { count: 'exact' })
        .in('status', ['approved', 'featured']);

    // Apply filters
    if (category) {
        query = query.eq('category', category);
    }

    if (search) {
        query = query.or(`title.ilike.%${search}%,tagline.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sortBy) {
        case 'votes':
            query = query.order('vote_count', { ascending: false });
            break;
        case 'rating':
            query = query.order('average_rating', { ascending: false });
            break;
        case 'featured':
            query = query.order('is_featured', { ascending: false }).order('featured_at', { ascending: false, nullsFirst: false });
            break;
        case 'newest':
        default:
            query = query.order('launch_date', { ascending: false, nullsFirst: false });
            break;
    }

    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching showcases:', error);
        return { showcases: [], total: 0, hasMore: false };
    }

    // If filtering by tags, we need to post-filter
    let showcases = data as ShowcaseCardData[];

    if (tagIds && tagIds.length > 0) {
        // Fetch tag relations for all showcases
        const showcaseIds = showcases.map((s) => s.id);
        const { data: tagRelations } = await supabase
            .from('showcase_tag_relations')
            .select('showcase_id, tag_id')
            .in('showcase_id', showcaseIds)
            .in('tag_id', tagIds);

        const showcasesWithTags = new Set(tagRelations?.map((r) => r.showcase_id) || []);
        showcases = showcases.filter((s) => showcasesWithTags.has(s.id));
    }

    // Fetch tags for each showcase
    const showcaseIds = showcases.map((s) => s.id);
    if (showcaseIds.length > 0) {
        const { data: allTagRelations } = await supabase
            .from('showcase_tag_relations')
            .select('showcase_id, showcase_tags(id, name, slug, color)')
            .in('showcase_id', showcaseIds);

        const tagsByShowcase = new Map<string, Pick<ShowcaseTag, 'id' | 'name' | 'slug' | 'color'>[]>();
        allTagRelations?.forEach((r) => {
            if (!tagsByShowcase.has(r.showcase_id)) {
                tagsByShowcase.set(r.showcase_id, []);
            }
            if (r.showcase_tags) {
                tagsByShowcase.get(r.showcase_id)!.push(r.showcase_tags as Pick<ShowcaseTag, 'id' | 'name' | 'slug' | 'color'>);
            }
        });

        showcases = showcases.map((s) => ({
            ...s,
            tags: tagsByShowcase.get(s.id) || [],
        }));
    }

    return {
        showcases,
        total: count || 0,
        hasMore: offset + showcases.length < (count || 0),
    };
}

/**
 * Get featured showcases
 */
export async function getFeaturedShowcases(limit = 3): Promise<ShowcaseCardData[]> {
    const { data, error } = await supabase
        .from('showcases')
        .select(`
            id, title, tagline, thumbnail_url, category, vote_count, review_count, average_rating, launch_date, is_featured,
            author:profiles!showcases_author_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('is_featured', true)
        .eq('status', 'featured')
        .order('featured_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching featured showcases:', error);
        return [];
    }

    return data as ShowcaseCardData[];
}

/**
 * Get user's own showcases (all statuses)
 */
export async function getUserShowcases(userId: string): Promise<Showcase[]> {
    const { data, error } = await supabase
        .from('showcases')
        .select('*')
        .eq('author_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching user showcases:', error);
        return [];
    }

    return data as Showcase[];
}

// =============================================================================
// IMAGE MANAGEMENT
// =============================================================================

/**
 * Add an image to a showcase
 */
export async function addShowcaseImage(
    showcaseId: string,
    imageUrl: string,
    displayOrder = 0,
    caption?: string
): Promise<ShowcaseImage> {
    const { data, error } = await supabase
        .from('showcase_images')
        .insert({
            showcase_id: showcaseId,
            image_url: imageUrl,
            display_order: displayOrder,
            caption,
        } as ShowcaseImageInsert)
        .select()
        .single();

    if (error) {
        console.error('Error adding showcase image:', error);
        throw error;
    }

    return data as ShowcaseImage;
}

/**
 * Remove an image from a showcase
 */
export async function removeShowcaseImage(imageId: string): Promise<void> {
    const { error } = await supabase.from('showcase_images').delete().eq('id', imageId);

    if (error) {
        console.error('Error removing showcase image:', error);
        throw error;
    }
}

/**
 * Reorder showcase images
 */
export async function reorderShowcaseImages(
    showcaseId: string,
    imageIds: string[]
): Promise<void> {
    // Update display_order for each image
    const updates = imageIds.map((id, index) =>
        supabase
            .from('showcase_images')
            .update({ display_order: index } as never)
            .eq('id', id)
            .eq('showcase_id', showcaseId)
    );

    await Promise.all(updates);
}

// =============================================================================
// TAG MANAGEMENT
// =============================================================================

/**
 * Get all available tags
 */
export async function getAllTags(): Promise<ShowcaseTag[]> {
    const { data, error } = await supabase
        .from('showcase_tags')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching tags:', error);
        return [];
    }

    return data as ShowcaseTag[];
}

/**
 * Add a tag to a showcase
 */
export async function addTagToShowcase(showcaseId: string, tagId: string): Promise<void> {
    const { error } = await supabase
        .from('showcase_tag_relations')
        .insert({ showcase_id: showcaseId, tag_id: tagId } as never);

    if (error && error.code !== '23505') { // Ignore duplicate key errors
        console.error('Error adding tag to showcase:', error);
        throw error;
    }
}

/**
 * Remove a tag from a showcase
 */
export async function removeTagFromShowcase(showcaseId: string, tagId: string): Promise<void> {
    const { error } = await supabase
        .from('showcase_tag_relations')
        .delete()
        .eq('showcase_id', showcaseId)
        .eq('tag_id', tagId);

    if (error) {
        console.error('Error removing tag from showcase:', error);
        throw error;
    }
}

/**
 * Set all tags for a showcase (replace existing)
 */
export async function setShowcaseTags(showcaseId: string, tagIds: string[]): Promise<void> {
    // Remove all existing tags
    await supabase
        .from('showcase_tag_relations')
        .delete()
        .eq('showcase_id', showcaseId);

    // Add new tags
    if (tagIds.length > 0) {
        const inserts = tagIds.map((tagId) => ({
            showcase_id: showcaseId,
            tag_id: tagId,
        }));

        const { error } = await supabase
            .from('showcase_tag_relations')
            .insert(inserts as never);

        if (error) {
            console.error('Error setting showcase tags:', error);
            throw error;
        }
    }
}

// =============================================================================
// VOTING
// =============================================================================

/**
 * Vote for a showcase (upvote)
 */
export async function voteForShowcase(showcaseId: string, userId: string): Promise<boolean> {
    const { error } = await supabase.from('reactions').insert({
        user_id: userId,
        reactable_type: 'showcase',
        reactable_id: showcaseId,
        reaction_type: 'like',
    } as never);

    if (error) {
        if (error.code === '23505') {
            // Already voted, remove the vote instead
            await removeVote(showcaseId, userId);
            return false;
        }
        console.error('Error voting for showcase:', error);
        throw error;
    }

    return true;
}

/**
 * Remove vote from a showcase
 */
export async function removeVote(showcaseId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('user_id', userId)
        .eq('reactable_type', 'showcase')
        .eq('reactable_id', showcaseId);

    if (error) {
        console.error('Error removing vote:', error);
        throw error;
    }

    return true;
}

/**
 * Toggle vote (vote if not voted, unvote if voted)
 */
export async function toggleVote(showcaseId: string, userId: string): Promise<boolean> {
    const hasVoted = await hasUserVoted(showcaseId, userId);

    if (hasVoted) {
        await removeVote(showcaseId, userId);
        return false;
    } else {
        await voteForShowcase(showcaseId, userId);
        return true;
    }
}

/**
 * Check if user has voted for a showcase
 */
export async function hasUserVoted(showcaseId: string, userId: string): Promise<boolean> {
    const { data } = await supabase
        .from('reactions')
        .select('id')
        .eq('user_id', userId)
        .eq('reactable_type', 'showcase')
        .eq('reactable_id', showcaseId)
        .single();

    return !!data;
}

/**
 * Get user votes for multiple showcases (batch)
 */
export async function getUserVotesForShowcases(
    userId: string,
    showcaseIds: string[]
): Promise<Set<string>> {
    if (showcaseIds.length === 0) {
        return new Set();
    }

    const { data } = await supabase
        .from('reactions')
        .select('reactable_id')
        .eq('user_id', userId)
        .eq('reactable_type', 'showcase')
        .in('reactable_id', showcaseIds);

    return new Set(data?.map((r) => r.reactable_id) || []);
}

// =============================================================================
// REVIEWS
// =============================================================================

/**
 * Get reviews for a showcase
 */
export async function getShowcaseReviews(showcaseId: string): Promise<ShowcaseReviewWithAuthor[]> {
    const { data, error } = await supabase
        .from('showcase_reviews')
        .select(`
            *,
            author:profiles!showcase_reviews_author_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('showcase_id', showcaseId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching reviews:', error);
        return [];
    }

    return data as ShowcaseReviewWithAuthor[];
}

/**
 * Create a review
 */
export async function createReview(
    showcaseId: string,
    authorId: string,
    content: string,
    rating: number
): Promise<ShowcaseReview> {
    const { data, error } = await supabase
        .from('showcase_reviews')
        .insert({
            showcase_id: showcaseId,
            author_id: authorId,
            content,
            rating,
        } as ShowcaseReviewInsert)
        .select()
        .single();

    if (error) {
        console.error('Error creating review:', error);
        throw error;
    }

    return data as ShowcaseReview;
}

/**
 * Update a review
 */
export async function updateReview(
    reviewId: string,
    content: string,
    rating: number
): Promise<ShowcaseReview> {
    const { data, error } = await supabase
        .from('showcase_reviews')
        .update({
            content,
            rating,
            is_edited: true,
            updated_at: new Date().toISOString(),
        } as ShowcaseReviewUpdate)
        .eq('id', reviewId)
        .select()
        .single();

    if (error) {
        console.error('Error updating review:', error);
        throw error;
    }

    return data as ShowcaseReview;
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<void> {
    const { error } = await supabase.from('showcase_reviews').delete().eq('id', reviewId);

    if (error) {
        console.error('Error deleting review:', error);
        throw error;
    }
}

/**
 * Add maker reply to a review
 */
export async function addMakerReply(reviewId: string, reply: string): Promise<ShowcaseReview> {
    const { data, error } = await supabase
        .from('showcase_reviews')
        .update({
            maker_reply: reply,
            maker_replied_at: new Date().toISOString(),
        } as ShowcaseReviewUpdate)
        .eq('id', reviewId)
        .select()
        .single();

    if (error) {
        console.error('Error adding maker reply:', error);
        throw error;
    }

    return data as ShowcaseReview;
}

// =============================================================================
// ADMIN MODERATION
// =============================================================================

/**
 * Get showcases for moderation (admin view)
 */
export async function getShowcasesForModeration(
    status?: ShowcaseStatus,
    search?: string
): Promise<ShowcaseForModeration[]> {
    // First get showcases with author (required relationship)
    let query = supabase
        .from('showcases')
        .select(`
            *,
            author:profiles!showcases_author_id_fkey(id, username, display_name, avatar_url)
        `)
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    if (search) {
        query = query.ilike('title', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching showcases for moderation:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return [];
    }

    // If we need moderator info, fetch it separately for those that have it
    const showcasesWithModerator = (data || []).map(showcase => ({
        ...showcase,
        moderator: null as { id: string; username: string; display_name: string } | null
    }));

    // Fetch moderator info for showcases that have been moderated
    const moderatedShowcases = showcasesWithModerator.filter(s => s.moderated_by);
    if (moderatedShowcases.length > 0) {
        const moderatorIds = [...new Set(moderatedShowcases.map(s => s.moderated_by).filter((id): id is string => id !== null))];
        const { data: moderators } = await supabase
            .from('profiles')
            .select('id, username, display_name')
            .in('id', moderatorIds);

        if (moderators) {
            const moderatorMap = new Map(moderators.map(m => [m.id, m]));
            showcasesWithModerator.forEach(s => {
                if (s.moderated_by && moderatorMap.has(s.moderated_by)) {
                    s.moderator = moderatorMap.get(s.moderated_by)!;
                }
            });
        }
    }

    return showcasesWithModerator as ShowcaseForModeration[];
}

/**
 * Approve a showcase
 */
export async function approveShowcase(
    showcaseId: string,
    moderatorId: string,
    notes?: string
): Promise<Showcase> {
    const { data, error } = await supabase
        .from('showcases')
        .update({
            status: 'approved',
            moderation_notes: notes || null,
            moderated_by: moderatorId,
            moderated_at: new Date().toISOString(),
            launch_date: new Date().toISOString().split('T')[0], // Set launch date to today
            updated_at: new Date().toISOString(),
        } as ShowcaseUpdate)
        .eq('id', showcaseId)
        .select()
        .single();

    if (error) {
        console.error('Error approving showcase:', error);
        throw error;
    }

    return data as Showcase;
}

/**
 * Reject a showcase
 */
export async function rejectShowcase(
    showcaseId: string,
    moderatorId: string,
    notes: string
): Promise<Showcase> {
    const { data, error } = await supabase
        .from('showcases')
        .update({
            status: 'rejected',
            moderation_notes: notes,
            moderated_by: moderatorId,
            moderated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        } as ShowcaseUpdate)
        .eq('id', showcaseId)
        .select()
        .single();

    if (error) {
        console.error('Error rejecting showcase:', error);
        throw error;
    }

    return data as Showcase;
}

/**
 * Feature a showcase
 */
export async function featureShowcase(
    showcaseId: string,
    moderatorId: string
): Promise<Showcase> {
    const { data, error } = await supabase
        .from('showcases')
        .update({
            status: 'featured',
            is_featured: true,
            featured_at: new Date().toISOString(),
            moderated_by: moderatorId,
            moderated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        } as ShowcaseUpdate)
        .eq('id', showcaseId)
        .select()
        .single();

    if (error) {
        console.error('Error featuring showcase:', error);
        throw error;
    }

    return data as Showcase;
}

/**
 * Unfeature a showcase (back to approved)
 */
export async function unfeatureShowcase(showcaseId: string): Promise<Showcase> {
    const { data, error } = await supabase
        .from('showcases')
        .update({
            status: 'approved',
            is_featured: false,
            featured_at: null,
            updated_at: new Date().toISOString(),
        } as ShowcaseUpdate)
        .eq('id', showcaseId)
        .select()
        .single();

    if (error) {
        console.error('Error unfeaturing showcase:', error);
        throw error;
    }

    return data as Showcase;
}

/**
 * Get showcase statistics for admin dashboard
 */
export async function getShowcaseStats(): Promise<ShowcaseStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [total, pending, approved, rejected, featured, thisMonth] = await Promise.all([
        supabase.from('showcases').select('id', { count: 'exact', head: true }),
        supabase.from('showcases').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('showcases').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('showcases').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('showcases').select('id', { count: 'exact', head: true }).eq('status', 'featured'),
        supabase.from('showcases').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    ]);

    return {
        total: total.count || 0,
        pending: pending.count || 0,
        approved: approved.count || 0,
        rejected: rejected.count || 0,
        featured: featured.count || 0,
        thisMonth: thisMonth.count || 0,
    };
}

// =============================================================================
// ADMIN TAG MANAGEMENT
// =============================================================================

/**
 * Create a new tag (admin only)
 */
export async function createTag(
    name: string,
    slug: string,
    color: string
): Promise<ShowcaseTag> {
    const { data, error } = await supabase
        .from('showcase_tags')
        .insert({ name, slug, color } as never)
        .select()
        .single();

    if (error) {
        console.error('Error creating tag:', error);
        throw error;
    }

    return data as ShowcaseTag;
}

/**
 * Update a tag (admin only)
 */
export async function updateTag(
    tagId: string,
    updates: Partial<Pick<ShowcaseTag, 'name' | 'slug' | 'color'>>
): Promise<ShowcaseTag> {
    const { data, error } = await supabase
        .from('showcase_tags')
        .update(updates as never)
        .eq('id', tagId)
        .select()
        .single();

    if (error) {
        console.error('Error updating tag:', error);
        throw error;
    }

    return data as ShowcaseTag;
}

/**
 * Delete a tag (admin only)
 */
export async function deleteTag(tagId: string): Promise<void> {
    const { error } = await supabase.from('showcase_tags').delete().eq('id', tagId);

    if (error) {
        console.error('Error deleting tag:', error);
        throw error;
    }
}
