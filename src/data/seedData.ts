import {
  PlayerProfile,
  StaffMember,
  FanItem,
  SponsorItem,
  ClubEvent,
  formatReplaceTag,
} from '../utils/rosterLogic';

export const TEAM_LOGOS = {
  greenGoldCrest: '/assets/aistudio/IMG_9744_b7c11861.png',
  redNjStickCrest: '/assets/aistudio/IMG_9741_aca1b68a.png',
  instagramScreenshot: '/assets/aistudio/IMG_9669_e858d093.png',
};

export const SOCIAL_LINKS = {
  instagramUrl: 'https://www.instagram.com/njveteranhockey/?hl=en',
  instagramHandle: '@njveteranhockey',
  instagramEmbedUrl: 'https://www.instagram.com/njveteranhockey/embed',
  facebookUrl:
    'https://www.facebook.com/profile.php?id=61594324051761&ref=PROFILE_EDIT_xav_ig_profile_page_web#',
  facebookName: 'Garden State Warriors Veterans Hockey',
  facebookPageId: '61594324051761',
  facebookEmbedUrl:
    'https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fprofile.php%3Fid%3D61594324051761&tabs=timeline%2Cevents&width=500&height=650&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true',
};

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  replaceInstruction: string;
  dateLabel: string;
}

export const HERO_SLIDE_DECK: HeroSlide[] = [
  {
    id: 'slide-1',
    title: 'Team Photo Slide #1 (Temporary Placeholder)',
    subtitle: '[Insert caption for Team Photo Slide #1 - text]',
    tag: 'Slide 01 · @njveteranhockey',
    replaceInstruction: formatReplaceTag(
      'team photos from their social media page(s) (@njveteranhockey on Instagram / Facebook)',
      'images'
    ),
    dateLabel: 'Garden State Warriors',
  },
  {
    id: 'slide-2',
    title: 'Team Photo Slide #2 (Temporary Placeholder)',
    subtitle: '[Insert caption for Team Photo Slide #2 - text]',
    tag: 'Slide 02 · @njveteranhockey',
    replaceInstruction: formatReplaceTag(
      'team photos from their social media page(s) (@njveteranhockey on Instagram / Facebook)',
      'images'
    ),
    dateLabel: 'Garden State Warriors',
  },
  {
    id: 'slide-3',
    title: 'Team Photo Slide #3 (Temporary Placeholder)',
    subtitle: '[Insert caption for Team Photo Slide #3 - text]',
    tag: 'Slide 03 · @njveteranhockey',
    replaceInstruction: formatReplaceTag(
      'team photos from their social media page(s) (@njveteranhockey on Instagram / Facebook)',
      'images'
    ),
    dateLabel: 'Garden State Warriors',
  },
  {
    id: 'slide-4',
    title: 'Team Photo Slide #4 (Temporary Placeholder)',
    subtitle: '[Insert caption for Team Photo Slide #4 - text]',
    tag: 'Slide 04 · @njveteranhockey',
    replaceInstruction: formatReplaceTag(
      'team photos from their social media page(s) (@njveteranhockey on Instagram / Facebook)',
      'images'
    ),
    dateLabel: 'Garden State Warriors',
  },
];

export const MILITARY_BRANCHES = [
  {
    id: 'army',
    name: 'U.S. Army',
    motto: 'This We’ll Defend',
  },
  {
    id: 'marines',
    name: 'U.S. Marine Corps',
    motto: 'Semper Fidelis',
  },
  {
    id: 'navy',
    name: 'U.S. Navy',
    motto: 'Non Sibi Sed Patriae',
  },
  {
    id: 'airforce',
    name: 'U.S. Air Force',
    motto: 'Aim High ... Fly-Fight-Win',
  },
  {
    id: 'spaceforce',
    name: 'U.S. Space Force',
    motto: 'Semper Supra',
  },
  {
    id: 'coastguard',
    name: 'U.S. Coast Guard',
    motto: 'Semper Paratus',
  },
];

/**
 * Temporary placeholders shown when the verified Google Sheet has no Board/Coach entries yet.
 * Automatically replaced as soon as rows are added to the Google Sheet.
 */
export const INITIAL_BOARD_AND_STAFF: StaffMember[] = [
  {
    id: 'board-1',
    name: '[Insert President Name - text]',
    role: 'President',
    category: 'Board',
    caption: '[Insert small caption for President - text]',
    photoPlaceholder: formatReplaceTag('President stand-in photo', 'image'),
    isPlaceholder: true,
  },
  {
    id: 'board-2',
    name: '[Insert Vice President Name - text]',
    role: 'Vice President',
    category: 'Board',
    caption: '[Insert small caption for Vice President - text]',
    photoPlaceholder: formatReplaceTag('Vice President stand-in photo', 'image'),
    isPlaceholder: true,
  },
  {
    id: 'board-3',
    name: '[Insert Secretary Name - text]',
    role: 'Secretary',
    category: 'Board',
    caption: '[Insert small caption for Secretary - text]',
    photoPlaceholder: formatReplaceTag('Secretary stand-in photo', 'image'),
    isPlaceholder: true,
  },
  {
    id: 'board-4',
    name: '[Insert Treasurer Name - text]',
    role: 'Treasurer',
    category: 'Board',
    caption: '[Insert small caption for Treasurer - text]',
    photoPlaceholder: formatReplaceTag('Treasurer stand-in photo', 'image'),
    isPlaceholder: true,
  },
  {
    id: 'coach-1',
    name: '[Insert Coach #1 Name - text]',
    role: 'Coach #1',
    category: 'Coach',
    caption: '[Insert small caption for Coach #1 - text]',
    photoPlaceholder: formatReplaceTag('Coach #1 stand-in photo', 'image'),
    isPlaceholder: true,
  },
  {
    id: 'coach-2',
    name: '[Insert Coach #2 Name - text]',
    role: 'Coach #2',
    category: 'Coach',
    caption: '[Insert small caption for Coach #2 - text]',
    photoPlaceholder: formatReplaceTag('Coach #2 stand-in photo', 'image'),
    isPlaceholder: true,
  },
];

/**
 * Temporary placeholders shown when the verified Google Sheet (`1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s`)
 * has 0 player entries (only the header row). Automatically replaced when rows are added.
 */
export const INITIAL_PLAYERS: PlayerProfile[] = [
  {
    id: 'captain-1',
    name: 'Captain #1 (Temporary Placeholder)',
    jerseyNumber: '',
    position: '',
    branch: '',
    rank: '',
    tierTab: 'Captains',
    yearsOfService: '',
    roleBadge: 'Captain',
    shortCaption: '[Insert small caption for Captain #1 - text]',
    bio: '[Insert player bio for Captain #1 - text]',
    whatWarriorsMeans: '[Insert Player Testimony #1 - text]',
    isTestimonyFeatured: true,
    jerseyPhotoPlaceholder: formatReplaceTag('Captain #1 stand-in photo', 'image'),
    militaryPhotoPlaceholder: formatReplaceTag('Captain #1 military photo', 'image'),
    mediaGallery: [],
    isPlaceholder: true,
  },
  {
    id: 'captain-2',
    name: 'Captain #2 (Temporary Placeholder)',
    jerseyNumber: '',
    position: '',
    branch: '',
    rank: '',
    tierTab: 'Captains',
    yearsOfService: '',
    roleBadge: 'Captain',
    shortCaption: '[Insert small caption for Captain #2 - text]',
    bio: '[Insert player bio for Captain #2 - text]',
    whatWarriorsMeans: '[Insert Player Testimony #2 - text]',
    isTestimonyFeatured: true,
    jerseyPhotoPlaceholder: formatReplaceTag('Captain #2 stand-in photo', 'image'),
    militaryPhotoPlaceholder: formatReplaceTag('Captain #2 military photo', 'image'),
    mediaGallery: [],
    isPlaceholder: true,
  },
  {
    id: 'captain-3',
    name: 'Captain #3 (Temporary Placeholder)',
    jerseyNumber: '',
    position: '',
    branch: '',
    rank: '',
    tierTab: 'Captains',
    yearsOfService: '',
    roleBadge: 'Alternate Captain',
    shortCaption: '[Insert small caption for Captain #3 - text]',
    bio: '[Insert player bio for Captain #3 - text]',
    whatWarriorsMeans: '[Insert Player Testimony #3 - text]',
    isTestimonyFeatured: true,
    jerseyPhotoPlaceholder: formatReplaceTag('Captain #3 stand-in photo', 'image'),
    militaryPhotoPlaceholder: formatReplaceTag('Captain #3 military photo', 'image'),
    mediaGallery: [],
    isPlaceholder: true,
  },
  {
    id: 'captain-4',
    name: 'Captain #4 (Temporary Placeholder)',
    jerseyNumber: '',
    position: '',
    branch: '',
    rank: '',
    tierTab: 'Captains',
    yearsOfService: '',
    roleBadge: 'Alternate Captain',
    shortCaption: '[Insert small caption for Captain #4 - text]',
    bio: '[Insert player bio for Captain #4 - text]',
    whatWarriorsMeans: '[Insert player testimony for Captain #4 - text]',
    isTestimonyFeatured: false,
    jerseyPhotoPlaceholder: formatReplaceTag('Captain #4 stand-in photo', 'image'),
    militaryPhotoPlaceholder: formatReplaceTag('Captain #4 military photo', 'image'),
    mediaGallery: [],
    isPlaceholder: true,
  },
];

export const INITIAL_FANS: FanItem[] = [
  {
    id: 'fan-1',
    title: 'Families of Players (Temporary Placeholder)',
    category: 'Family',
    relatedPlayer: 'Families',
    caption: '[Insert caption for families of players on the team - text]',
    photoPlaceholder: formatReplaceTag(
      'compilation of families of players on the team',
      'images'
    ),
  },
  {
    id: 'fan-2',
    title: 'Friends of Players (Temporary Placeholder)',
    category: 'Friends',
    relatedPlayer: 'Friends',
    caption: '[Insert caption for friends of players on the team - text]',
    photoPlaceholder: formatReplaceTag(
      'compilation of friends of players on the team',
      'images'
    ),
  },
  {
    id: 'fan-3',
    title: 'Pets of Players (Temporary Placeholder)',
    category: 'Pets',
    relatedPlayer: 'Pets',
    caption: '[Insert caption for pets of players on the team - text]',
    photoPlaceholder: formatReplaceTag(
      'compilation of pets of players on the team',
      'images'
    ),
  },
];

export const INITIAL_SPONSORS: SponsorItem[] = [
  {
    id: 'sp-1',
    name: 'Sponsor / Supporter #1 (Temporary Placeholder)',
    tier: 'Sponsor',
    description: '[Insert description of Sponsor / Supporter #1 - text]',
    placeholderNote: formatReplaceTag('Sponsor #1 logo', 'image'),
  },
  {
    id: 'sp-2',
    name: 'Sponsor / Supporter #2 (Temporary Placeholder)',
    tier: 'Sponsor',
    description: '[Insert description of Sponsor / Supporter #2 - text]',
    placeholderNote: formatReplaceTag('Sponsor #2 logo', 'image'),
  },
  {
    id: 'sp-3',
    name: 'Sponsor / Supporter #3 (Temporary Placeholder)',
    tier: 'Supporter',
    description: '[Insert description of Sponsor / Supporter #3 - text]',
    placeholderNote: formatReplaceTag('Sponsor #3 logo', 'image'),
  },
  {
    id: 'sp-4',
    name: 'Sponsor / Supporter #4 (Temporary Placeholder)',
    tier: 'Supporter',
    description: '[Insert description of Sponsor / Supporter #4 - text]',
    placeholderNote: formatReplaceTag('Sponsor #4 logo', 'image'),
  },
];

/**
 * Temporary event placeholders with zero fake descriptions — uses exact [Insert description of this event - text]
 * format until populated from the Google Sheet or viewed directly in the embedded social media iframes.
 */
export const INITIAL_EVENTS: ClubEvent[] = [
  {
    id: 'ev-placeholder-1',
    title: '[Insert Event #1 Title - text]',
    date: '[Insert event date - text]',
    time: '[Insert event time - text]',
    location: '[Insert event location - text]',
    category: 'Upcoming Event',
    description: '[Insert description of this event - text]',
    placeholderBanner: formatReplaceTag('Event #1 flyer or photo from social media', 'image'),
    isPlaceholder: true,
  },
  {
    id: 'ev-placeholder-2',
    title: '[Insert Event #2 Title - text]',
    date: '[Insert event date - text]',
    time: '[Insert event time - text]',
    location: '[Insert event location - text]',
    category: 'Upcoming Event',
    description: '[Insert description of this event - text]',
    placeholderBanner: formatReplaceTag('Event #2 flyer or photo from social media', 'image'),
    isPlaceholder: true,
  },
];
