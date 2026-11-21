import { createPrimaryPalette } from '@/lib/branding';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/services/supabase';

// Feature module access levels: disabled, all users, or premium only
export type FeatureAccess = 'disabled' | 'all' | 'premium_only';

export interface SiteSettings {
  site_name: string;
  site_tagline: string;
  site_description: string;
  primary_color: string;
  logo_url: string;
  logo_dark_url: string;
  favicon_url: string;
  support_email: string;
  support_url: string;
  // Feature modules
  feature_live_room: FeatureAccess;
  feature_activations: FeatureAccess;
  feature_roadmap: FeatureAccess;
  feature_showcase: FeatureAccess;
}

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: import.meta.env.VITE_APP_NAME || 'Roost',
  site_tagline: import.meta.env.VITE_APP_TAGLINE || 'Learn, Build, Grow Together',
  site_description: import.meta.env.VITE_APP_DESCRIPTION || 'A community platform for learning, building, and growing together.',
  primary_color: '#0ea5e9',
  logo_url: '',
  logo_dark_url: '',
  favicon_url: '',
  support_email: '',
  support_url: '',
  feature_live_room: 'premium_only',
  feature_activations: 'premium_only',
  feature_roadmap: 'all',
  feature_showcase: 'all',
};

interface SiteSettingsContextType {
  settings: SiteSettings;
  isLoading: boolean;
  refresh: () => Promise<void>;
  updateSettings: (updates: Partial<SiteSettings>) => Promise<void>;
  uploadBrandingAsset: (file: File, type: 'logo' | 'logo_dark' | 'favicon') => Promise<string>;
  isFeatureEnabled: (feature: 'live_room' | 'activations' | 'roadmap' | 'showcase', isPremium?: boolean) => boolean;
  getFeatureAccess: (feature: 'live_room' | 'activations' | 'roadmap' | 'showcase') => FeatureAccess;
}

const SiteSettingsContext = createContext<SiteSettingsContextType | null>(null);

function applyPrimaryColor(hex: string) {
  const palette = createPrimaryPalette(hex);
  if (!palette) return;
  for (const [shade, { color, rgb }] of Object.entries(palette)) {
    document.documentElement.style.setProperty(`--color-primary-${shade}`, color);
    document.documentElement.style.setProperty(`--color-primary-${shade}-rgb`, rgb);
  }
}

function applyFavicon(url: string) {
  if (!url) return;
  const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
    || document.createElement('link');
  link.rel = 'icon';
  link.href = url;
  if (!link.parentNode) {
    document.head.appendChild(link);
  }
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value');

      if (error) {
        console.error('Error fetching site settings:', error);
        return;
      }

      if (data && data.length > 0) {
        const dbSettings: Partial<SiteSettings> = {};
        for (const row of data) {
          if (row.key in DEFAULT_SETTINGS) {
            (dbSettings as Record<string, string>)[row.key] = row.value || '';
          }
        }
        const merged = { ...DEFAULT_SETTINGS, ...dbSettings };

        // Use env vars as fallback for empty DB values
        if (!merged.site_name) merged.site_name = DEFAULT_SETTINGS.site_name;
        if (!merged.site_tagline) merged.site_tagline = DEFAULT_SETTINGS.site_tagline;

        setSettings(merged);
        applyPrimaryColor(merged.primary_color);
        applyFavicon(merged.favicon_url);

        // Update document title
        document.title = `${merged.site_name} - Community Platform`;
      }
    } catch (error) {
      console.error('Error loading site settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (updates: Partial<SiteSettings>) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/site-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update settings');
    }

    // Apply changes immediately
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    applyPrimaryColor(newSettings.primary_color);
    applyFavicon(newSettings.favicon_url);
    document.title = `${newSettings.site_name} - Community Platform`;
  }, [settings]);

  const uploadBrandingAsset = useCallback(async (file: File, type: 'logo' | 'logo_dark' | 'favicon'): Promise<string> => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const response = await fetch(`${API_URL}/api/site-settings/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to upload file');
    }

    const data = await response.json();

    // Update local state
    const key = data.key as keyof SiteSettings;
    setSettings(prev => ({ ...prev, [key]: data.url }));

    if (key === 'favicon_url') {
      applyFavicon(data.url);
    }

    return data.url;
  }, []);

  const getFeatureAccess = useCallback((feature: 'live_room' | 'activations' | 'roadmap' | 'showcase'): FeatureAccess => {
    const key = `feature_${feature}` as keyof SiteSettings;
    const value = settings[key] as string;
    if (value === 'disabled' || value === 'all' || value === 'premium_only') return value;
    return DEFAULT_SETTINGS[key] as FeatureAccess;
  }, [settings]);

  const isFeatureEnabled = useCallback((feature: 'live_room' | 'activations' | 'roadmap' | 'showcase', isPremium = false): boolean => {
    const access = getFeatureAccess(feature);
    if (access === 'disabled') return false;
    if (access === 'all') return true;
    return isPremium; // premium_only
  }, [getFeatureAccess]);

  return (
    <SiteSettingsContext.Provider value={{ settings, isLoading, refresh: fetchSettings, updateSettings, uploadBrandingAsset, isFeatureEnabled, getFeatureAccess }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext);
  if (!context) {
    throw new Error('useSiteSettings must be used within SiteSettingsProvider');
  }
  return context;
}
