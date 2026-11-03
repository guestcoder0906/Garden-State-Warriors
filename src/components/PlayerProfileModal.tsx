import React from 'react';
import { X, Shield, Film, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { PlayerProfile, formatReplaceTag } from '../utils/rosterLogic';
import { TEAM_LOGOS, SOCIAL_LINKS } from '../data/seedData';

interface PlayerProfileModalProps {
  player: PlayerProfile | null;
  onClose: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  onClose,
}) => {
  if (!player) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 overflow-y-auto backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-profile-title"
    >
      <div className="relative w-full max-w-3xl bg-[#0B120E] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#101A14] border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={TEAM_LOGOS.greenGoldCrest}
              alt="Garden State Warriors Crest"
              className="w-9 h-9 rounded-full object-contain"
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                Garden State Warriors · Verified Roster Profile
              </span>
              <h2
                id="player-profile-title"
                className="text-xl font-bold tracking-wide text-white font-display uppercase"
              >
                {player.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player profile"
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Profile Body */}
        <div className="p-6 md:p-7 overflow-y-auto space-y-6">
          {/* Top Military & Jersey Spec Grid (Gracefully handles optional fields) */}
          <div className="grid grid-cols-12 gap-3 items-stretch">
            <div className="col-span-3 sm:col-span-2 bg-[#142019] border border-white/10 rounded-xl flex flex-col items-center justify-center p-3 text-center">
              <span className="text-2xl md:text-3xl font-extrabold text-white font-mono-tabular leading-none">
                {player.jerseyNumber ? `#${player.jerseyNumber}` : '—'}
              </span>
              {player.position && (
                <span className="text-sm font-bold text-[#EAB308] font-display mt-1">
                  {player.position}
                </span>
              )}
            </div>

            <div className="col-span-9 sm:col-span-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#881616] border border-red-400/25 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-red-200/80 block">Player Name</span>
                  <span className="text-base font-bold text-white font-display tracking-wide">
                    {player.name}
                  </span>
                </div>
                {player.roleBadge && player.roleBadge !== 'Player' && player.roleBadge !== 'None' && (
                  <span className="text-xs font-semibold text-[#FACC15] font-mono-tabular">
                    {player.roleBadge}
                  </span>
                )}
              </div>

              <div className="bg-[#142019] border border-white/10 rounded-xl px-4 py-2.5 flex items-center">
                <div>
                  <span className="text-[11px] text-neutral-400 block">Branch of Service</span>
                  <span className="text-sm font-semibold text-white">
                    {player.branch || '[Replace with Military Branch in Google Sheets - text]'}
                  </span>
                </div>
              </div>

              <div className="bg-[#142019] border border-white/10 rounded-xl px-4 py-2.5 flex items-center">
                <div>
                  <span className="text-[11px] text-neutral-400 block">Position</span>
                  <span className="text-sm font-semibold text-white font-mono-tabular">
                    {[player.rank && `Position: ${player.rank}`, player.tierTab]
                      .filter(Boolean)
                      .join(' · ') || 'Veterans Roster'}
                  </span>
                </div>
              </div>

              <div className="bg-[#142019] border border-white/10 rounded-xl px-4 py-2.5 flex items-center">
                <div>
                  <span className="text-[11px] text-neutral-400 block">
                    {player.hometown ? 'Service Era & Hometown' : 'Service Era'}
                  </span>
                  <span className="text-sm font-semibold text-white font-mono-tabular">
                    {[player.yearsOfService, player.hometown].filter(Boolean).join(' · ') ||
                      'U.S. Military Veteran'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dual Photo Section: Jersey Portrait (Left) + Military Service Photo (Right) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Left: Team Jersey Headshot */}
            <div className="bg-[#101914] border border-white/10 rounded-xl overflow-hidden flex flex-col">
              <div className="relative aspect-square w-full bg-gradient-to-br from-[#7F1D1D]/50 via-[#112217] to-[#090F0B] flex flex-col items-center justify-center p-5 text-center">
                {player.jerseyPhotoUrl ? (
                  <img
                    src={player.jerseyPhotoUrl}
                    alt={`${player.name} Jersey Portrait`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <>
                    <img
                      src={TEAM_LOGOS.redNjStickCrest}
                      alt="Garden State Warriors Crest"
                      className="w-24 h-24 object-contain mb-3 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-lg font-bold text-white font-display tracking-wider uppercase">
                      {player.jerseyNumber ? `#${player.jerseyNumber} · ` : ''}
                      {player.name}
                    </span>
                    <p className="mt-3 text-[11px] text-amber-200/90 bg-black/50 border border-[#EAB308]/30 rounded-lg p-2.5 font-mono-tabular">
                      {player.jerseyPhotoPlaceholder}
                    </p>
                  </>
                )}
              </div>
              <div className="px-4 py-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs text-neutral-300">
                <span>Garden State Warriors Uniform</span>
                <span className="font-mono-tabular text-[#EAB308]">
                  {[player.jerseyNumber && `#${player.jerseyNumber}`, player.position]
                    .filter(Boolean)
                    .join(' ')}
                </span>
              </div>
            </div>

            {/* Right: Active Duty / Military Service Photo */}
            <div className="bg-[#101914] border border-white/10 rounded-xl overflow-hidden flex flex-col">
              <div className="relative aspect-square w-full bg-gradient-to-br from-[#19261E] via-[#111C15] to-[#090F0B] flex flex-col items-center justify-center p-5 text-center">
                {player.militaryPhotoUrl ? (
                  <img
                    src={player.militaryPhotoUrl}
                    alt={`${player.name} Military Service`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-[#EAB308]/10 border border-[#EAB308]/35 flex items-center justify-center mb-3">
                      <Shield className="w-10 h-10 text-[#EAB308]" />
                    </div>
                    <span className="text-lg font-bold text-white font-display tracking-wider uppercase">
                      {[player.branch, player.rank].filter(Boolean).join(' · ') ||
                        'Armed Forces Service Record'}
                    </span>
                    <p className="mt-3 text-[11px] text-amber-200/90 bg-black/50 border border-[#EAB308]/30 rounded-lg p-2.5 font-mono-tabular">
                      {player.militaryPhotoPlaceholder}
                    </p>
                  </>
                )}
              </div>
              <div className="px-4 py-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs text-neutral-300">
                <span>Military Service Photo</span>
                <span className="font-mono-tabular text-neutral-400">
                  {player.rank || player.branch || 'Veteran'}
                </span>
              </div>
            </div>
          </div>

          {/* Player Bio & What the Warriors Means to Them */}
          <div className="space-y-5 bg-[#101914] border border-white/10 rounded-xl p-5">
            <div>
              <h3 className="text-sm font-bold text-[#EAB308] font-display uppercase tracking-wider mb-1.5">
                Player Bio
              </h3>
              <p className="text-sm text-neutral-200 leading-relaxed">{player.bio}</p>
            </div>

            <div className="border-t border-white/10 pt-4">
              <h3 className="text-sm font-bold text-[#EF4444] font-display uppercase tracking-wider mb-1.5">
                What the Warriors Means to Them
              </h3>
              <p className="text-sm text-neutral-200 leading-relaxed italic">
                {player.whatWarriorsMeans}
              </p>
            </div>
          </div>

          {/* Player Profile Media Section (Synced from Verified Google Sheet) */}
          <div className="bg-[#101914] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-display uppercase tracking-wide flex items-center gap-2">
                <Film className="w-4 h-4 text-[#EAB308]" />
                Player Media Section
              </h3>
              <span className="text-xs text-neutral-400 font-mono-tabular">
                Synced from Google Sheets
              </span>
            </div>

            {player.mediaGallery.length === 0 ? (
              <div className="p-4 rounded-lg bg-black/30 border border-white/10 text-center">
                <p className="text-xs text-amber-200/90 font-mono-tabular">
                  {formatReplaceTag(
                    `player action photos or video links for ${player.name} in the Google Sheets MediaUrlsCsv column`,
                    'images & video'
                  )}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {player.mediaGallery.map((media) => (
                  <div
                    key={media.id}
                    className="bg-[#0B120E] border border-white/10 rounded-lg overflow-hidden flex flex-col justify-between"
                  >
                    <div className="aspect-video bg-[#142019] flex flex-col items-center justify-center p-4 text-center relative">
                      {media.url ? (
                        media.type === 'video' ? (
                          <video
                            src={media.url}
                            controls
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={media.url}
                            alt={media.caption}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )
                      ) : (
                        <>
                          <ImageIcon className="w-7 h-7 text-[#EAB308] mb-2" />
                          <span className="text-xs font-semibold text-white">
                            {media.caption}
                          </span>
                          {media.placeholderInstruction && (
                            <span className="mt-2 text-[11px] text-amber-200/90 font-mono-tabular bg-black/50 px-2.5 py-1.5 rounded border border-[#EAB308]/30">
                              {media.placeholderInstruction}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Crest & Social Links */}
          <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={TEAM_LOGOS.greenGoldCrest}
                alt="Garden State Warriors Crest"
                className="w-10 h-10 object-contain"
                referrerPolicy="no-referrer"
              />
              <img
                src={TEAM_LOGOS.redNjStickCrest}
                alt="Warriors Secondary Logo"
                className="w-10 h-10 object-contain rounded-full"
                referrerPolicy="no-referrer"
              />
              <div>
                <p className="text-xs font-bold text-white font-display uppercase">
                  Garden State Warriors Disabled Veterans Hockey Club
                </p>
                <p className="text-[11px] text-neutral-400">
                  Registered 501(c)(3) Tax-Exempt Public Charity
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={SOCIAL_LINKS.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1.5 transition-colors"
              >
                <span>{SOCIAL_LINKS.instagramHandle}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={SOCIAL_LINKS.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1.5 transition-colors"
              >
                <span>Facebook</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
