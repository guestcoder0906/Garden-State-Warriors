import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PlayerProfile } from '../utils/rosterLogic';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl.includes('YOUR_PROJECT_ID') &&
  !supabaseAnonKey.includes('YOUR_SUPABASE');

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function isSupabaseConfigured(): boolean {
  return isConfigured;
}

/**
 * Fetches globally saved player profiles from Supabase if configured.
 */
export async function fetchSupabasePlayers(): Promise<PlayerProfile[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('gsw_players')
      .select('*')
      .order('created_at', { ascending: true });
    if (error || !data) return null;
    return data.map((row: any) => ({
      id: String(row.id),
      name: row.name,
      jerseyNumber: row.jersey_number || '00',
      position: row.position || 'F',
      branch: row.branch || 'U.S. Armed Forces',
      rank: row.rank || 'VET',
      tierTab: row.tier_tab || 'Veterans Roster',
      yearsOfService: row.years_of_service || 'Veteran',
      roleBadge: row.role_badge || 'Player',
      shortCaption: `${row.rank || 'VET'} · ${row.branch} · #${row.jersey_number} ${row.position}`,
      bio: row.bio || '',
      whatWarriorsMeans: row.what_warriors_means || '',
      jerseyPhotoUrl: row.jersey_photo_url || undefined,
      militaryPhotoUrl: row.military_photo_url || undefined,
      jerseyPhotoPlaceholder:
        row.jersey_photo_placeholder ||
        `[Replace with ${row.name}'s jersey portrait photo - image]`,
      militaryPhotoPlaceholder:
        row.military_photo_placeholder ||
        `[Replace with ${row.name}'s military service photo - image]`,
      mediaGallery: Array.isArray(row.media_gallery) ? row.media_gallery : [],
    }));
  } catch {
    return null;
  }
}

/**
 * Saves a newly submitted Player Profile globally to Supabase when configured.
 */
export async function insertSupabasePlayer(player: PlayerProfile): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('gsw_players').insert([
      {
        name: player.name,
        jersey_number: player.jerseyNumber,
        position: player.position,
        branch: player.branch,
        rank: player.rank,
        tier_tab: player.tierTab,
        years_of_service: player.yearsOfService,
        role_badge: player.roleBadge || 'Player',
        bio: player.bio,
        what_warriors_means: player.whatWarriorsMeans,
        jersey_photo_url: player.jerseyPhotoUrl || null,
        military_photo_url: player.militaryPhotoUrl || null,
        media_gallery: player.mediaGallery || [],
      },
    ]);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Saves a contact form inquiry or event RSVP to Supabase when configured.
 */
export async function insertSupabaseSubmission(
  type: 'contact' | 'rsvp' | 'fan_submission',
  payload: Record<string, any>
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('gsw_submissions').insert([
      {
        submission_type: type,
        payload,
      },
    ]);
    return !error;
  } catch {
    return false;
  }
}
