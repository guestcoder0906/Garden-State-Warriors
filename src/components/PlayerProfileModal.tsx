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

  const hasVal = (v?: string) => {
    if (!v) return false;
    const t = v.trim();
    if (!t || t === '--' || t === '—') return false;
    if (t.startsWith('[') && t.endsWith(']')) return false;
    return true;
  };

  const showJerseyOrPosBox = hasVal(player.jerseyNumber) || hasVal(player.position);
  const showRoleBadge =
    hasVal(player.roleBadge) &&
    player.roleBadge !== 'Player' &&
    player.roleBadge !== 'None';
  const showNameBox = hasVal(player.name) || showRoleBadge;
  const showBranchBox = hasVal(player.branch);
  const showPositionOrRankBox =
    hasVal(player.position) || hasVal(player.rank) || hasVal(player.tierTab);
  const showEraOrHometownBox = hasVal(player.yearsOfService) || hasVal(player.hometown);
  const showPreferredContact = hasVal(player.preferredContact);
  const showPhone = hasVal(player.phone);
  const showEmail = hasVal(player.email);
  const showContactBox = showPreferredContact || showPhone || showEmail;

  const showAnySpecBox =
    showJerseyOrPosBox ||
    showNameBox ||
    showBranchBox ||
    showPositionOrRankBox ||
    showEraOrHometownBox ||
    showContactBox;

  const showJerseyPhoto = hasVal(player.jerseyPhotoUrl);
  const showMilitaryPhoto = hasVal(player.militaryPhotoUrl);
  const showAnyPhoto = showJerseyPhoto || showMilitaryPhoto;

  const showBio = hasVal(player.bio);
  const showMeaning = hasVal(player.whatWarriorsMeans);
  const showExperience = hasVal(player.experience);
  // Additional Questions / Info is internal only and stored in Google Sheets from the form, not displayed in player profile UI
  const showBioOrMeaning = showBio || showMeaning || showExperience;

  const validMedia = (player.mediaGallery || []).filter((m) => hasVal(m.url));
  const showMediaSection = validMedia.length > 0;

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
              {hasVal(player.name) && (
                <h2
                  id="player-profile-title"
                  className="text-xl font-bold tracking-wide text-white font-display uppercase"
                >
                  {player.name}
                </h2>
              )}
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
          {/* Top Military & Jersey Spec Grid (Only renders boxes for non-empty cells) */}
          {showAnySpecBox && (
            <div className="grid grid-cols-12 gap-3 items-stretch">
              {showJerseyOrPosBox && (
                <div className="col-span-3 sm:col-span-2 bg-[#142019] border border-white/10 rounded-xl flex flex-col items-center justify-center p-3 text-center">
                  {hasVal(player.jerseyNumber) && (
                    <span className="text-2xl md:text-3xl font-extrabold text-white font-mono-tabular leading-none">
                      #{player.jerseyNumber}
                    </span>
                  )}
                  {hasVal(player.position) && (
                    <span className="text-sm font-bold text-[#EAB308] font-display mt-1">
                      {player.position}
                    </span>
                  )}
                </div>
              )}

              <div
                className={`${
                  showJerseyOrPosBox ? 'col-span-9 sm:col-span-10' : 'col-span-12'
                } grid grid-cols-1 sm:grid-cols-2 gap-3`}
              >
                {showNameBox && (
                  <div className="bg-[#881616] border border-red-400/25 rounded-xl px-4 py-2.5 flex items-center justify-between">
                    {hasVal(player.name) && (
                      <div>
                        <span className="text-[11px] text-red-200/80 block">Player Name</span>
                        <span className="text-base font-bold text-white font-display tracking-wide">
                          {player.name}
                        </span>
                      </div>
                    )}
                    {showRoleBadge && (
                      <span className="text-xs font-semibold text-[#FACC15] font-mono-tabular">
                        {player.roleBadge}
                      </span>
                    )}
                  </div>
                )}

                {showBranchBox && (
                  <div className="bg-[#142019] border border-white/10 rounded-xl px-4 py-2.5 flex items-center">
                    <div>
                      <span className="text-[11px] text-neutral-400 block">Branch of Service</span>
                      <span className="text-sm font-semibold text-white">{player.branch}</span>
                    </div>
                  </div>
                )}

                {showPositionOrRankBox && (
                  <div className="bg-[#142019] border border-white/10 rounded-xl px-4 py-2.5 flex items-center">
                    <div>
                      <span className="text-[11px] text-neutral-400 block">
                        {[
                          hasVal(player.position) && 'Position',
                          hasVal(player.rank) && 'Rank',
                          hasVal(player.tierTab) && 'Roster Tab',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span className="text-sm font-semibold text-white font-mono-tabular">
                        {[
                          hasVal(player.position) && player.position,
                          hasVal(player.rank) && player.rank,
                          hasVal(player.tierTab) && player.tierTab,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  </div>
                )}

                {showEraOrHometownBox && (
                  <div className="bg-[#142019] border border-white/10 rounded-xl px-4 py-2.5 flex items-center">
                    <div>
                      <span className="text-[11px] text-neutral-400 block">
                        {hasVal(player.yearsOfService) && hasVal(player.hometown)
                          ? 'Service Era & Hometown'
                          : hasVal(player.hometown)
                          ? 'Hometown'
                          : 'Service Era'}
                      </span>
                      <span className="text-sm font-semibold text-white font-mono-tabular">
                        {[
                          hasVal(player.yearsOfService) && player.yearsOfService,
                          hasVal(player.hometown) && player.hometown,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  </div>
                )}

                {showContactBox && (
                  <div className="bg-[#142019] border border-white/10 rounded-xl px-4 py-2.5 flex items-center">
                    <div>
                      <span className="text-[11px] text-neutral-400 block">Contact Information</span>
                      <span className="text-sm font-semibold text-white font-mono-tabular">
                        {[
                          hasVal(player.preferredContact) && `Preferred: ${player.preferredContact}`,
                          hasVal(player.phone) && player.phone,
                          hasVal(player.email) && player.email,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Photo Section: Only renders Jersey Photo and/or Military Photo when their URL cells are non-empty */}
          {showAnyPhoto && (
            <div
              className={`grid grid-cols-1 ${
                showJerseyPhoto && showMilitaryPhoto ? 'sm:grid-cols-2' : 'max-w-md mx-auto'
              } gap-5`}
            >
              {showJerseyPhoto && (
                <div className="bg-[#101914] border border-white/10 rounded-xl overflow-hidden flex flex-col">
                  <div className="relative aspect-square w-full bg-[#090F0B] flex items-center justify-center overflow-hidden">
                    <img
                      src={player.jerseyPhotoUrl}
                      alt={player.name ? `${player.name} Jersey Portrait` : 'Jersey Portrait'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="px-4 py-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs text-neutral-300">
                    <span>Garden State Warriors Uniform</span>
                    <span className="font-mono-tabular text-[#EAB308]">
                      {[
                        hasVal(player.jerseyNumber) && `#${player.jerseyNumber}`,
                        hasVal(player.position) && player.position,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                  </div>
                </div>
              )}

              {showMilitaryPhoto && (
                <div className="bg-[#101914] border border-white/10 rounded-xl overflow-hidden flex flex-col">
                  <div className="relative aspect-square w-full bg-[#090F0B] flex items-center justify-center overflow-hidden">
                    <img
                      src={player.militaryPhotoUrl}
                      alt={player.name ? `${player.name} Military Service` : 'Military Service'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="px-4 py-2.5 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs text-neutral-300">
                    <span>Military Service Photo</span>
                    {(hasVal(player.rank) || hasVal(player.branch)) && (
                      <span className="font-mono-tabular text-neutral-400">
                        {[hasVal(player.rank) && player.rank, hasVal(player.branch) && player.branch]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Player Bio, What the Warriors Means to Them & Additional Questions/Info (Only rendered when non-empty) */}
          {showBioOrMeaning && (
            <div className="space-y-5 bg-[#101914] border border-white/10 rounded-xl p-5">
              {showBio && (
                <div>
                  <h3 className="text-sm font-bold text-[#EAB308] font-display uppercase tracking-wider mb-1.5">
                    Player Bio
                  </h3>
                  <p className="text-sm text-neutral-200 leading-relaxed">{player.bio}</p>
                </div>
              )}

              {showMeaning && (
                <div className={showBio ? 'border-t border-white/10 pt-4' : ''}>
                  <h3 className="text-sm font-bold text-[#EF4444] font-display uppercase tracking-wider mb-1.5">
                    What the Warriors Means to Them
                  </h3>
                  <q className="text-sm text-neutral-200 leading-relaxed italic">
                    {player.whatWarriorsMeans}
                  </q>
                </div>
              )}

              {showExperience && (
                <div className={showBio || showMeaning ? 'border-t border-white/10 pt-4' : ''}>
                  <h3 className="text-sm font-bold text-[#EAB308] font-display uppercase tracking-wider mb-1.5">
                    Hockey Experience
                  </h3>
                  <p className="text-sm text-neutral-200 leading-relaxed">{player.experience}</p>
                </div>
              )}
            </div>
          )}

          {/* Player Profile Media Section (Only rendered when MediaUrlsCsv has items) */}
          {showMediaSection && (
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {validMedia.map((media) => (
                  <div
                    key={media.id}
                    className="bg-[#0B120E] border border-white/10 rounded-lg overflow-hidden flex flex-col justify-between"
                  >
                    <div className="aspect-video bg-[#142019] flex flex-col items-center justify-center text-center relative overflow-hidden">
                      {media.type === 'video' ? (
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
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
