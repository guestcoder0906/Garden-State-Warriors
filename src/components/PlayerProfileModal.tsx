import React, { useEffect, useState } from 'react';
import { X, Film, ExternalLink } from 'lucide-react';
import { PlayerProfile } from '../utils/rosterLogic';
import { TEAM_LOGOS, SOCIAL_LINKS } from '../data/seedData';
import { SheetImage } from './SheetImage';

interface PlayerProfileModalProps {
  player: PlayerProfile | null;
  onClose: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  onClose,
}) => {
  const [jerseyFailed, setJerseyFailed] = useState(false);
  const [profileFailed, setProfileFailed] = useState(false);
  const [militaryFailed, setMilitaryFailed] = useState(false);

  useEffect(() => {
    setJerseyFailed(false);
    setProfileFailed(false);
    setMilitaryFailed(false);
  }, [player?.id, player?.jerseyPhotoUrl, player?.profilePictureUrl, player?.militaryPhotoUrl]);

  // Lock background page scroll while modal is open & support Escape to close
  useEffect(() => {
    if (!player) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [player, onClose]);

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
  // Contact Information (Phone, Email, Preferred Contact) is internal only and stored in Google Sheets from the form, not displayed in public UI

  const showAnySpecBox =
    showJerseyOrPosBox ||
    showNameBox ||
    showBranchBox ||
    showPositionOrRankBox ||
    showEraOrHometownBox;

  const showJerseyPhoto = hasVal(player.jerseyPhotoUrl) && !jerseyFailed;
  const showProfilePicture = hasVal(player.profilePictureUrl) && !profileFailed;
  const showMilitaryPhoto = hasVal(player.militaryPhotoUrl) && !militaryFailed;
  const photoCount = [showJerseyPhoto, showProfilePicture, showMilitaryPhoto].filter(Boolean).length;
  const showAnyPhoto = photoCount > 0;

  const showBio = hasVal(player.bio);
  const showMeaning = hasVal(player.whatWarriorsMeans);
  const showExperience = hasVal(player.experience);
  // Additional Questions / Info is internal only and stored in Google Sheets from the form, not displayed in player profile UI
  const showBioOrMeaning = showBio || showMeaning || showExperience;

  const validMedia = (player.mediaGallery || []).filter((m) => hasVal(m.url));
  const showMediaSection = validMedia.length > 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 p-0 sm:p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-profile-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-[#0B120E] border-t sm:border border-white/15 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[94dvh] sm:max-h-[90dvh] flex flex-col"
      >
        {/* Top bar (Sticky inside modal, never clipped on mobile) */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 bg-[#101A14] border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <img
              src={TEAM_LOGOS.greenGoldCrest}
              alt="Garden State Warriors Crest"
              width={36}
              height={36}
              loading="eager"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shrink-0 border border-[#EAB308]/35 bg-[#050907]"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] sm:text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider block truncate">
                Garden State Warriors · Verified Roster Profile
              </span>
              {hasVal(player.name) && (
                <h2
                  id="player-profile-title"
                  className="text-lg sm:text-xl font-bold tracking-wide text-white font-display uppercase truncate"
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
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Profile Body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 md:p-7 space-y-5 sm:space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Top Military & Jersey Spec Grid (Full-width responsive on mobile, 12-col on sm+) */}
          {showAnySpecBox && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
              {showJerseyOrPosBox && (
                <div className="sm:col-span-3 md:col-span-2 bg-[#142019] border border-white/10 rounded-xl flex sm:flex-col items-center justify-center gap-2.5 sm:gap-1 p-3 text-center">
                  {hasVal(player.jerseyNumber) && (
                    <span className="text-2xl md:text-3xl font-extrabold text-white font-mono-tabular leading-none">
                      #{player.jerseyNumber}
                    </span>
                  )}
                  {hasVal(player.position) && (
                    <span className="text-sm font-bold text-[#EAB308] font-display">
                      {player.position}
                    </span>
                  )}
                </div>
              )}

              <div
                className={`${
                  showJerseyOrPosBox ? 'sm:col-span-9 md:col-span-10' : 'sm:col-span-12'
                } grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0`}
              >
                {showNameBox && (
                  <div className="bg-[#881616] border border-red-400/25 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 min-w-0">
                    {hasVal(player.name) && (
                      <div className="min-w-0">
                        <span className="text-[11px] text-red-200/80 block">Player Name</span>
                        <span className="text-base font-bold text-white font-display tracking-wide break-words">
                          {player.name}
                        </span>
                      </div>
                    )}
                    {showRoleBadge && (
                      <span className="text-xs font-semibold text-[#FACC15] font-mono-tabular shrink-0">
                        {player.roleBadge}
                      </span>
                    )}
                  </div>
                )}

                {showBranchBox && (
                  <div className="bg-[#142019] border border-white/10 rounded-xl px-4 py-2.5 flex items-center min-w-0">
                    <div className="min-w-0">
                      <span className="text-[11px] text-neutral-400 block">Branch of Service</span>
                      <span className="text-sm font-semibold text-white break-words">{player.branch}</span>
                    </div>
                  </div>
                )}

                {showPositionOrRankBox && (
                  <div className="bg-[#142019] border border-white/10 rounded-xl px-4 py-2.5 flex items-center min-w-0">
                    <div className="min-w-0">
                      <span className="text-[11px] text-neutral-400 block">
                        {[
                          hasVal(player.position) && 'Position',
                          hasVal(player.rank) && 'Rank',
                          hasVal(player.tierTab) && 'Roster Tab',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span className="text-sm font-semibold text-white font-mono-tabular break-words">
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
                  <div className="bg-[#142019] border border-white/10 rounded-xl px-4 py-2.5 flex items-center min-w-0">
                    <div className="min-w-0">
                      <span className="text-[11px] text-neutral-400 block">
                        {hasVal(player.yearsOfService) && hasVal(player.hometown)
                          ? 'Service Era & Hometown'
                          : hasVal(player.hometown)
                          ? 'Hometown'
                          : 'Service Era'}
                      </span>
                      <span className="text-sm font-semibold text-white font-mono-tabular break-words">
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
              </div>
            </div>
          )}

          {/* Photo Section */}
          {showAnyPhoto && (
            <div
              className={`grid grid-cols-1 ${
                photoCount === 3
                  ? 'sm:grid-cols-3'
                  : photoCount === 2
                  ? 'sm:grid-cols-2'
                  : 'max-w-md mx-auto w-full'
              } gap-4 sm:gap-5`}
            >
              {showJerseyPhoto && (
                <div className="bg-[#101914] border border-white/10 rounded-xl overflow-hidden flex flex-col">
                  <SheetImage
                    src={player.jerseyPhotoUrl}
                    alt={player.name ? `${player.name} Jersey Portrait` : 'Jersey Portrait'}
                    wrapperClassName="aspect-[4/3] sm:aspect-square w-full bg-[#090F0B] flex items-center justify-center overflow-hidden"
                    className="w-full h-full object-cover"
                    hideWhenBroken={false}
                    onStatusChange={(s) => {
                      if (s === 'error') setJerseyFailed(true);
                    }}
                  />
                </div>
              )}

              {showProfilePicture && (
                <div className="bg-[#101914] border border-white/10 rounded-xl overflow-hidden flex flex-col">
                  <SheetImage
                    src={player.profilePictureUrl}
                    alt={player.name ? `${player.name} Profile Picture` : 'Profile Picture'}
                    wrapperClassName="aspect-[4/3] sm:aspect-square w-full bg-[#090F0B] flex items-center justify-center overflow-hidden"
                    className="w-full h-full object-cover"
                    hideWhenBroken={false}
                    onStatusChange={(s) => {
                      if (s === 'error') setProfileFailed(true);
                    }}
                  />
                </div>
              )}

              {showMilitaryPhoto && (
                <div className="bg-[#101914] border border-white/10 rounded-xl overflow-hidden flex flex-col">
                  <SheetImage
                    src={player.militaryPhotoUrl}
                    alt={player.name ? `${player.name} Military Service` : 'Military Service'}
                    wrapperClassName="aspect-[4/3] sm:aspect-square w-full bg-[#090F0B] flex items-center justify-center overflow-hidden"
                    className="w-full h-full object-cover"
                    hideWhenBroken={false}
                    onStatusChange={(s) => {
                      if (s === 'error') setMilitaryFailed(true);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Player Bio, What the Warriors Means to Them & Hockey Experience */}
          {showBioOrMeaning && (
            <div className="space-y-4 sm:space-y-5 bg-[#101914] border border-white/10 rounded-xl p-4 sm:p-5">
              {showBio && (
                <div>
                  <h3 className="text-sm font-bold text-[#EAB308] font-display uppercase tracking-wider mb-1.5">
                    Player Bio
                  </h3>
                  <p className="text-sm text-neutral-200 leading-relaxed break-words">{player.bio}</p>
                </div>
              )}

              {showMeaning && (
                <div className={showBio ? 'border-t border-white/10 pt-4' : ''}>
                  <h3 className="text-sm font-bold text-[#EF4444] font-display uppercase tracking-wider mb-1.5">
                    What the Warriors Means to Them
                  </h3>
                  <q className="text-sm text-neutral-200 leading-relaxed italic break-words block">
                    {player.whatWarriorsMeans}
                  </q>
                </div>
              )}

              {showExperience && (
                <div className={showBio || showMeaning ? 'border-t border-white/10 pt-4' : ''}>
                  <h3 className="text-sm font-bold text-[#EAB308] font-display uppercase tracking-wider mb-1.5">
                    Hockey Experience
                  </h3>
                  <p className="text-sm text-neutral-200 leading-relaxed break-words">{player.experience}</p>
                </div>
              )}
            </div>
          )}

          {/* Player Profile Media Section */}
          {showMediaSection && (
            <div className="bg-[#101914] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white font-display uppercase tracking-wide flex items-center gap-2">
                  <Film className="w-4 h-4 text-[#EAB308] shrink-0" />
                  <span>Player Media Section</span>
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
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <SheetImage
                          src={media.url}
                          alt={media.caption}
                          wrapperClassName="w-full h-full overflow-hidden"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Crest & Social Links */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <img
                  src={TEAM_LOGOS.greenGoldCrest}
                  alt="Garden State Warriors Crest"
                  width={40}
                  height={40}
                  className="w-10 h-10 object-cover rounded-full shrink-0 border border-[#EAB308]/35 bg-[#050907]"
                />
                <img
                  src={TEAM_LOGOS.redNjStickCrest}
                  alt="Warriors Secondary Logo"
                  width={40}
                  height={40}
                  className="w-10 h-10 object-cover rounded-full shrink-0 bg-[#050907]"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white font-display uppercase break-words">
                  Garden State Disabled Veterans Hockey Club Inc.
                </p>
                <p className="text-[11px] text-neutral-400 break-words">
                  Operating as Garden State Warriors Hockey Club · 501(c)(3) · EIN: 43-2191074
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
              <a
                href={SOCIAL_LINKS.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 min-h-[40px] rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <span>{SOCIAL_LINKS.instagramHandle}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={SOCIAL_LINKS.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 min-h-[40px] rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
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
