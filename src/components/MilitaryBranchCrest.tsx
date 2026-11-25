import React from 'react';

interface MilitaryBranchCrestProps {
  branchId: string;
  className?: string;
}

/**
 * Custom heraldic SVG crests for all 6 U.S. Armed Forces branches:
 * Army, Marine Corps, Navy, Air Force, Space Force, and Coast Guard.
 */
export const MilitaryBranchCrest: React.FC<MilitaryBranchCrestProps> = ({
  branchId,
  className = 'w-11 h-11',
}) => {
  switch (branchId) {
    case 'army':
      // U.S. Army: Black & gold pentagonal emblem with beveled 5-point Army star
      return (
        <svg viewBox="0 0 64 64" className={className} role="img" aria-label="U.S. Army Crest">
          <defs>
            <linearGradient id="armyGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="50%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#A16207" />
            </linearGradient>
          </defs>
          <rect
            x="9"
            y="8"
            width="46"
            height="48"
            rx="6"
            fill="#0A0A0A"
            stroke="url(#armyGold)"
            strokeWidth="3"
          />
          <rect
            x="13"
            y="12"
            width="38"
            height="40"
            rx="4"
            fill="none"
            stroke="#EAB308"
            strokeOpacity="0.45"
            strokeWidth="1.2"
          />
          {/* Outer Gold Star */}
          <polygon
            points="32,15 36.8,26.2 49,27.3 39.7,35.3 42.5,47.2 32,40.9 21.5,47.2 24.3,35.3 15,27.3 27.2,26.2"
            fill="url(#armyGold)"
          />
          {/* Inner Black Beveled Star */}
          <polygon
            points="32,19 35.6,27.4 44.8,28.2 37.8,34.2 39.9,43.2 32,38.4 24.1,43.2 26.2,34.2 19.2,28.2 28.4,27.4"
            fill="#141414"
            stroke="#FACC15"
            strokeWidth="1"
          />
          {/* Highlight facet lines */}
          <line x1="32" y1="19" x2="32" y2="32.5" stroke="#FDE047" strokeWidth="1" opacity="0.85" />
          <line x1="44.8" y1="28.2" x2="32" y2="32.5" stroke="#FDE047" strokeWidth="0.9" opacity="0.65" />
          <line x1="19.2" y1="28.2" x2="32" y2="32.5" stroke="#FDE047" strokeWidth="0.9" opacity="0.65" />
        </svg>
      );

    case 'marines':
      // U.S. Marine Corps: Scarlet & gold medallion with Eagle, Globe, and Anchor motif
      return (
        <svg viewBox="0 0 64 64" className={className} role="img" aria-label="U.S. Marine Corps Crest">
          <defs>
            <linearGradient id="usmcGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="50%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="27" fill="#7F1D1D" stroke="url(#usmcGold)" strokeWidth="3" />
          <circle cx="32" cy="32" r="23" fill="none" stroke="#FACC15" strokeWidth="1" strokeOpacity="0.5" />
          {/* Fouled Anchor (diagonal) */}
          <line x1="20" y1="20" x2="44" y2="45" stroke="url(#usmcGold)" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="23" y1="17" x2="17" y2="23" stroke="url(#usmcGold)" strokeWidth="2.4" strokeLinecap="round" />
          <path
            d="M36 46 Q45 48 47 38"
            fill="none"
            stroke="url(#usmcGold)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          {/* Globe */}
          <circle cx="32" cy="33" r="10.5" fill="#991B1B" stroke="url(#usmcGold)" strokeWidth="2" />
          <ellipse cx="32" cy="33" rx="10.5" ry="4" fill="none" stroke="#FDE047" strokeWidth="1" />
          <ellipse cx="32" cy="33" rx="4.5" ry="10.5" fill="none" stroke="#FDE047" strokeWidth="1" />
          <line x1="22" y1="33" x2="42" y2="33" stroke="#FDE047" strokeWidth="1" />
          {/* Eagle perched atop globe */}
          <path
            d="M17 20 C22 18 27 21 32 23 C37 21 42 18 47 20 C43 24 38 25 32 25 C26 25 21 24 17 20 Z"
            fill="url(#usmcGold)"
          />
          <circle cx="32" cy="18.5" r="2.2" fill="#FEF08A" />
        </svg>
      );

    case 'navy':
      // U.S. Navy: Deep navy & gold rope-bordered crest with fouled anchor & eagle wings
      return (
        <svg viewBox="0 0 64 64" className={className} role="img" aria-label="U.S. Navy Crest">
          <defs>
            <linearGradient id="navyGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#A16207" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="27" fill="#0A1E3F" stroke="url(#navyGold)" strokeWidth="3" />
          <circle
            cx="32"
            cy="32"
            r="23"
            fill="none"
            stroke="#FACC15"
            strokeDasharray="3 2"
            strokeWidth="1.2"
            opacity="0.7"
          />
          {/* Anchor */}
          <circle cx="32" cy="17" r="3" fill="none" stroke="url(#navyGold)" strokeWidth="2.2" />
          <line x1="24" y1="23" x2="40" y2="23" stroke="url(#navyGold)" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="32" y1="20" x2="32" y2="46" stroke="url(#navyGold)" strokeWidth="2.8" strokeLinecap="round" />
          <path
            d="M18 37 C19 46 25 49 32 49 C39 49 45 46 46 37"
            fill="none"
            stroke="url(#navyGold)"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <polygon points="16,38 20,34 21,39" fill="url(#navyGold)" />
          <polygon points="48,38 44,34 43,39" fill="url(#navyGold)" />
          {/* Federal Shield overlay */}
          <path
            d="M25 27 H39 V34 C39 39 32 43 32 43 C32 43 25 39 25 34 Z"
            fill="#1D4ED8"
            stroke="#FDE047"
            strokeWidth="1.4"
          />
          <rect x="26" y="28" width="12" height="3.5" fill="#EAB308" />
        </svg>
      );

    case 'airforce':
      // U.S. Air Force: Ultramarine & silver Air Force wings, delta apex, and star
      return (
        <svg viewBox="0 0 64 64" className={className} role="img" aria-label="U.S. Air Force Crest">
          <defs>
            <linearGradient id="afSilver" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="27" fill="#0F295C" stroke="url(#afSilver)" strokeWidth="2.8" />
          <circle cx="32" cy="32" r="23.5" fill="none" stroke="#60A5FA" strokeOpacity="0.45" strokeWidth="1" />
          {/* Left Wings */}
          <path d="M12 24 L27 28 L27 32 L14 30 Z" fill="url(#afSilver)" />
          <path d="M14 31.5 L27 33.5 L27 37 L17 36 Z" fill="url(#afSilver)" />
          <path d="M17.5 37.5 L27 38.5 L27 41.5 L21 41 Z" fill="url(#afSilver)" />
          {/* Right Wings */}
          <path d="M52 24 L37 28 L37 32 L50 30 Z" fill="url(#afSilver)" />
          <path d="M50 31.5 L37 33.5 L37 37 L47 36 Z" fill="url(#afSilver)" />
          <path d="M46.5 37.5 L37 38.5 L37 41.5 L43 41 Z" fill="url(#afSilver)" />
          {/* Center Apex Triangle & Star */}
          <polygon points="32,12 40,34 32,29 24,34" fill="url(#afSilver)" />
          <polygon
            points="32,33 34.4,39.5 41.2,39.8 35.8,43.8 37.7,50.5 32,46.6 26.3,50.5 28.2,43.8 22.8,39.8 29.6,39.5"
            fill="#F8FAFC"
            stroke="#60A5FA"
            strokeWidth="0.9"
          />
        </svg>
      );

    case 'spaceforce':
      // U.S. Space Force: Midnight slate/navy hexagon crest, starry orbit & silver Delta
      return (
        <svg viewBox="0 0 64 64" className={className} role="img" aria-label="U.S. Space Force Crest">
          <defs>
            <linearGradient id="ussfSilver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>
          </defs>
          <polygon
            points="32,6 54,18 54,46 32,58 10,46 10,18"
            fill="#091020"
            stroke="url(#ussfSilver)"
            strokeWidth="2.8"
          />
          <polygon
            points="32,10 50,20 50,44 32,54 14,44 14,20"
            fill="none"
            stroke="#38BDF8"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          {/* Stars */}
          <circle cx="20" cy="24" r="1.1" fill="#E2E8F0" />
          <circle cx="44" cy="23" r="1.2" fill="#E2E8F0" />
          <circle cx="21" cy="40" r="1" fill="#E2E8F0" />
          <circle cx="43" cy="39" r="1.1" fill="#E2E8F0" />
          {/* Orbital ring */}
          <ellipse
            cx="32"
            cy="35"
            rx="15"
            ry="6"
            transform="rotate(-22 32 35)"
            fill="none"
            stroke="#7DD3FC"
            strokeWidth="1.6"
          />
          {/* Delta */}
          <polygon points="32,15 43,46 32,39 21,46" fill="url(#ussfSilver)" />
          <polygon points="32,19 38,41 32,37 26,41" fill="#1E293B" />
          {/* Polaris star */}
          <polygon points="32,27 33.4,30.5 37,31.5 33.4,32.5 32,36 30.6,32.5 27,31.5 30.6,30.5" fill="#FFFFFF" />
        </svg>
      );

    case 'coastguard':
    default:
      // U.S. Coast Guard: Crossed anchors with scarlet, white & navy shield
      return (
        <svg viewBox="0 0 64 64" className={className} role="img" aria-label="U.S. Coast Guard Crest">
          <circle cx="32" cy="32" r="27" fill="#0A2342" stroke="#F8FAFC" strokeWidth="2.8" />
          <circle cx="32" cy="32" r="23.5" fill="none" stroke="#EF4444" strokeWidth="1.6" />
          {/* Crossed gold anchors behind shield */}
          <line x1="18" y1="18" x2="46" y2="46" stroke="#EAB308" strokeWidth="3" strokeLinecap="round" />
          <line x1="46" y1="18" x2="18" y2="46" stroke="#EAB308" strokeWidth="3" strokeLinecap="round" />
          <circle cx="17" cy="17" r="2.2" fill="none" stroke="#EAB308" strokeWidth="1.8" />
          <circle cx="47" cy="17" r="2.2" fill="none" stroke="#EAB308" strokeWidth="1.8" />
          {/* Center Shield */}
          <path
            d="M21 19 H43 V33 C43 42 32 48 32 48 C32 48 21 42 21 33 Z"
            fill="#F8FAFC"
            stroke="#EAB308"
            strokeWidth="1.6"
          />
          {/* Blue chief */}
          <path d="M22 20 H42 V27 H22 Z" fill="#1D4ED8" />
          {/* Scarlet stripes */}
          <rect x="24" y="29" width="3.5" height="12" rx="1" fill="#DC2626" />
          <rect x="30.25" y="29" width="3.5" height="16" rx="1" fill="#DC2626" />
          <rect x="36.5" y="29" width="3.5" height="12" rx="1" fill="#DC2626" />
        </svg>
      );
  }
};
