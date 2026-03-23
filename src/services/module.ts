import { supabase } from './supabase';
import type { Module, ModuleInsert, ModuleUpdate } from '@/types';
import type { ModuleWithProgress, RecordingWithCompletion, GroupAssetWithDetails } from '@/types';

/**
 * Fetch all modules for a group with progress data for the current user
 */
export async function getModulesWithProgress(
    groupId: string,
    userId: string
): Promise<ModuleWithProgress[]> {
    // Fetch modules
    const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .eq('group_id', groupId)
        .order('display_order', { ascending: true });

    if (modulesError) {
        console.error('Error fetching modules:', modulesError);
        throw modulesError;
    }

    if (!modules || modules.length === 0) return [];

    const moduleIds = modules.map((m) => m.id);

    // Fetch recording counts per module
    const { data: recordings, error: recError } = await supabase
        .from('recordings')
        .select('id, module_id')
        .in('module_id', moduleIds);

    if (recError) {
        console.error('Error fetching recording counts:', recError);
        throw recError;
    }

    // Fetch user completions
    const { data: completions, error: compError } = await supabase
        .from('lesson_completions')
        .select('recording_id, module_id')
        .eq('user_id', userId)
        .in('module_id', moduleIds);

    if (compError) {
        console.error('Error fetching completions:', compError);
        throw compError;
    }

    // Build counts per module
    const recordingCounts: Record<string, number> = {};
    const completionCounts: Record<string, number> = {};

    for (const rec of recordings || []) {
        if (rec.module_id) {
            recordingCounts[rec.module_id] = (recordingCounts[rec.module_id] || 0) + 1;
        }
    }

    for (const comp of completions || []) {
        completionCounts[comp.module_id] = (completionCounts[comp.module_id] || 0) + 1;
    }

    return modules.map((mod) => {
        const recording_count = recordingCounts[mod.id] || 0;
        const completed_count = completionCounts[mod.id] || 0;
        return {
            ...mod,
            recording_count,
            completed_count,
            progress_percentage: recording_count > 0
                ? Math.round((completed_count / recording_count) * 100)
                : 0,
        };
    });
}

/**
 * Fetch a single module by ID
 */
export async function getModuleById(moduleId: string): Promise<Module | null> {
    const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('id', moduleId)
        .single();

    if (error) {
        console.error('Error fetching module:', error);
        return null;
    }

    return data;
}

/**
 * Create a new module
 */
export async function createModule(module: ModuleInsert): Promise<Module> {
    const { data, error } = await supabase
        .from('modules')
        .insert(module as never)
        .select()
        .single();

    if (error) {
        console.error('Error creating module:', error);
        throw error;
    }

    return data;
}

/**
 * Update a module
 */
export async function updateModule(moduleId: string, updates: ModuleUpdate): Promise<Module> {
    const { data, error } = await supabase
        .from('modules')
        .update(updates as never)
        .eq('id', moduleId)
        .select()
        .single();

    if (error) {
        console.error('Error updating module:', error);
        throw error;
    }

    return data;
}

/**
 * Delete a module
 */
export async function deleteModule(moduleId: string): Promise<void> {
    const { error } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);

    if (error) {
        console.error('Error deleting module:', error);
        throw error;
    }
}

/**
 * Reorder modules by updating display_order
 */
export async function reorderModules(groupId: string, orderedIds: string[]): Promise<void> {
    const updates = orderedIds.map((id, index) => ({
        id,
        group_id: groupId,
        display_order: index,
    }));

    for (const update of updates) {
        const { error } = await supabase
            .from('modules')
            .update({ display_order: update.display_order } as never)
            .eq('id', update.id);

        if (error) {
            console.error('Error reordering module:', error);
            throw error;
        }
    }
}

/**
 * Fetch recordings for a module with completion status
 */
export async function getModuleRecordings(
    moduleId: string,
    userId?: string
): Promise<RecordingWithCompletion[]> {
    const { data: recordings, error } = await supabase
        .from('recordings')
        .select(`
            *,
            publisher:profiles!published_by(id, username, display_name, avatar_url)
        `)
        .eq('module_id', moduleId)
        .order('display_order', { ascending: true });

    if (error) {
        console.error('Error fetching module recordings:', error);
        throw error;
    }

    if (!recordings || recordings.length === 0) return [];

    // Fetch completion status if userId provided
    let completedIds: Set<string> = new Set();
    if (userId) {
        const { data: completions } = await supabase
            .from('lesson_completions')
            .select('recording_id')
            .eq('user_id', userId)
            .eq('module_id', moduleId);

        if (completions) {
            completedIds = new Set(completions.map((c) => c.recording_id));
        }
    }

    return recordings.map((rec) => ({
        ...rec,
        is_completed: completedIds.has(rec.id),
    }));
}

/**
 * Fetch assets for a module
 */
export async function getModuleAssets(moduleId: string): Promise<GroupAssetWithDetails[]> {
    const { data, error } = await supabase
        .from('group_assets')
        .select(`
            *,
            asset:assets!asset_id(*),
            uploader:profiles!uploaded_by(id, username, display_name, avatar_url)
        `)
        .eq('module_id', moduleId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching module assets:', error);
        throw error;
    }

    return (data || []).map((item: any) => ({
        id: item.id,
        group_id: item.group_id,
        asset_id: item.asset_id,
        uploaded_by: item.uploaded_by,
        created_at: item.created_at,
        module_id: item.module_id,
        filename: item.asset?.filename || '',
        file_url: item.asset?.file_url || '',
        file_size: item.asset?.file_size || null,
        mime_type: item.asset?.mime_type || null,
        asset_type: item.asset?.asset_type || 'other',
        uploader: item.uploader,
    }));
}

/**
 * Mark a lesson as completed
 */
export async function markLessonComplete(
    userId: string,
    recordingId: string,
    moduleId: string
): Promise<void> {
    const { error } = await supabase
        .from('lesson_completions')
        .insert({
            user_id: userId,
            recording_id: recordingId,
            module_id: moduleId,
        } as never);

    if (error) {
        // Ignore unique constraint violation (already completed)
        if (error.code === '23505') return;
        console.error('Error marking lesson complete:', error);
        throw error;
    }
}

/**
 * Mark a lesson as incomplete (remove completion)
 */
export async function markLessonIncomplete(
    userId: string,
    recordingId: string
): Promise<void> {
    const { error } = await supabase
        .from('lesson_completions')
        .delete()
        .eq('user_id', userId)
        .eq('recording_id', recordingId);

    if (error) {
        console.error('Error marking lesson incomplete:', error);
        throw error;
    }
}

/**
 * Get adjacent recordings for navigation (previous and next)
 */
export async function getAdjacentRecordings(
    recordingId: string,
    moduleId: string
): Promise<{ prev: any | null; next: any | null }> {
    const { data: recordings, error } = await supabase
        .from('recordings')
        .select('id, title, display_order, video_platform, video_id')
        .eq('module_id', moduleId)
        .order('display_order', { ascending: true });

    if (error || !recordings) {
        return { prev: null, next: null };
    }

    const currentIndex = recordings.findIndex((r) => r.id === recordingId);
    if (currentIndex === -1) return { prev: null, next: null };

    return {
        prev: currentIndex > 0 ? recordings[currentIndex - 1] : null,
        next: currentIndex < recordings.length - 1 ? recordings[currentIndex + 1] : null,
    };
}

/**
 * Get all user completions for a group (for sidebar display)
 */
export async function getUserCompletionsForGroup(
    userId: string,
    groupId: string
): Promise<Record<string, string[]>> {
    // Get all modules for this group
    const { data: modules } = await supabase
        .from('modules')
        .select('id')
        .eq('group_id', groupId);

    if (!modules || modules.length === 0) return {};

    const moduleIds = modules.map((m) => m.id);

    const { data: completions, error } = await supabase
        .from('lesson_completions')
        .select('recording_id, module_id')
        .eq('user_id', userId)
        .in('module_id', moduleIds);

    if (error || !completions) return {};

    const result: Record<string, string[]> = {};
    for (const comp of completions) {
        if (!result[comp.module_id]) result[comp.module_id] = [];
        result[comp.module_id].push(comp.recording_id);
    }
    return result;
}

/**
 * Get a recording by ID with full details
 */
export async function getRecordingById(recordingId: string): Promise<any | null> {
    const { data, error } = await supabase
        .from('recordings')
        .select(`
            *,
            publisher:profiles!published_by(id, username, display_name, avatar_url)
        `)
        .eq('id', recordingId)
        .single();

    if (error) {
        console.error('Error fetching recording:', error);
        return null;
    }

    return data;
}
