import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Shield,
  Heart,
  MapPin,
  ExternalLink,
  Search,
  Users,
  Camera,
  Menu,
  X,
} from 'lucide-react';
import {
  PlayerProfile,
  StaffMember,
  FanItem,
  SponsorItem,
  ClubEvent,
  filterPlayers,
  formatReplaceTag,
} from './utils/rosterLogic';
import {
  TEAM_LOGOS,
  SOCIAL_LINKS,
  HERO_SLIDE_DECK,
  MILITARY_BRANCHES,
  INITIAL_BOARD_AND_STAFF,
  INITIAL_PLAYERS,
  INITIAL_FANS,
  INITIAL_SPONSORS,
  INITIAL_EVENTS,
} from './data/seedData';
import { syncVerifiedGoogleSheet } from './services/googleWorkspace';
import {
  fetchSupabasePlayers,
  isSupabaseConfigured,
} from './services/supabaseClient';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { BecomeWarriorForm } from './components/BecomeWarriorForm';

type TopSection =
  | 'home'
  | 'about'
  | 'events'
  | 'donate'
  | 'media'
  | 'contact'
  | 'become-warrior';

type AboutSubTab = 'mission' | 'board-staff' | 'players' | 'fans';

export default function App() {
  // Navigation State
  const [activeSection, setActiveSection] = useState<TopSection>('home');
  const [aboutSubTab, setAboutSubTab] = useState<AboutSubTab>('mission');
  const [aboutDropdownOpen, setAboutDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Slide Deck State on Home Page
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoPlaySlides, setAutoPlaySlides] = useState(true);

  // Verified Roster, Staff, Fans, Sponsors & Events State
  // Defaults to Temporary Placeholders when the Google Sheet is empty, and replaces them automatically when rows exist
  const [players, setPlayers] = useState<PlayerProfile[]>(INITIAL_PLAYERS);
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_BOARD_AND_STAFF);
  const [fans, setFans] = useState<FanItem[]>(INITIAL_FANS);
  const [sponsors, setSponsors] = useState<SponsorItem[]>(INITIAL_SPONSORS);
  const [events, setEvents] = useState<ClubEvent[]>(INITIAL_EVENTS);
  const [dynamicTabs, setDynamicTabs] = useState<string[]>([
    'Captains',
    'Alpha',
    'Bravo',
    'Charlie',
    'Veterans Roster',
  ]);

  // Players Filtering State (Rank tabs, Tier tabs, Search)
  const [selectedTierTab, setSelectedTierTab] = useState<string>('All');
  const [selectedRankFilter, setSelectedRankFilter] = useState<string>('All');
  const [playerSearchQuery, setPlayerSearchQuery] = useState<string>('');

  // Fans Filtering State
  const [fanCategoryFilter, setFanCategoryFilter] = useState<'All' | 'Family' | 'Friends' | 'Pets'>('All');

  // Selected Player for Full Profile Modal
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<PlayerProfile | null>(null);

  // Donate State
  const [selectedDonationAmount, setSelectedDonationAmount] = useState<number>(50);
  const [customDonationAmount, setCustomDonationAmount] = useState<string>('');

  // Dynamic Auto-Sync from Verified Google Sheet (`1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s`) via Apps Script / gviz
  useEffect(() => {
    let mounted = true;

    const runSync = async () => {
      const sheetData = await syncVerifiedGoogleSheet();
      if (mounted && sheetData) {
        // If sheet has rows, show live entries; if a section in the sheet is empty, show temporary placeholders
        setPlayers(
          sheetData.players.length > 0 ? sheetData.players : INITIAL_PLAYERS
        );
        setStaff(
          sheetData.staff.length > 0 ? sheetData.staff : INITIAL_BOARD_AND_STAFF
        );
        setEvents(
          sheetData.events.length > 0 ? sheetData.events : INITIAL_EVENTS
        );
        setFans(
          sheetData.fans && sheetData.fans.length > 0 ? sheetData.fans : INITIAL_FANS
        );
        setSponsors(
          sheetData.sponsors && sheetData.sponsors.length > 0 ? sheetData.sponsors : INITIAL_SPONSORS
        );
        if (sheetData.detectedTabs.length > 0) {
          setDynamicTabs(sheetData.detectedTabs);
        }
      }

      if (isSupabaseConfigured()) {
        const remotePlayers = await fetchSupabasePlayers();
        if (mounted && remotePlayers && remotePlayers.length > 0) {
          setPlayers(remotePlayers);
        }
      }
    };

    runSync();
    const interval = setInterval(runSync, 10000);
    const onFocus = () => runSync();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') runSync();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeSection, aboutSubTab]);

  // Slide deck autoplay
  useEffect(() => {
    if (!autoPlaySlides || activeSection !== 'home') return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDE_DECK.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [autoPlaySlides, activeSection]);

  // Unique Military Ranks dynamically derived from current roster (only non-empty ranks)
  const availableRanks = useMemo(() => {
    const ranks = Array.from(
      new Set(players.map((p) => (p.rank || '').trim()).filter(Boolean))
    );
    return ['All', ...ranks];
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return filterPlayers(players, {
      tierTab: selectedTierTab,
      rankFilter: selectedRankFilter,
      searchQuery: playerSearchQuery,
    });
  }, [players, selectedTierTab, selectedRankFilter, playerSearchQuery]);

  // 4 Captains & 3 Testimonies
  const fourCaptains = useMemo(() => {
    const caps = players.filter(
      (p) =>
        p.roleBadge === 'Captain' ||
        p.roleBadge === 'Alternate Captain' ||
        p.tierTab === 'Captains'
    );
    return (caps.length > 0 ? caps : players).slice(0, 4);
  }, [players]);

  const threeTestimonies = useMemo(() => {
    const featured = players.filter((p) => p.isTestimonyFeatured);
    return (featured.length >= 3 ? featured : players).slice(0, 3);
  }, [players]);

  const boardMembers = useMemo(
    () => staff.filter((s) => s.category === 'Board').slice(0, 4),
    [staff]
  );
  const coaches = useMemo(
    () => staff.filter((s) => s.category === 'Coach').slice(0, 2),
    [staff]
  );

  const filteredFans = useMemo(() => {
    if (fanCategoryFilter === 'All') return fans;
    return fans.filter((f) => f.category === fanCategoryFilter);
  }, [fans, fanCategoryFilter]);

  const navigateToAboutSub = (sub: AboutSubTab) => {
    setActiveSection('about');
    setAboutSubTab(sub);
    setAboutDropdownOpen(false);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToSection = (sec: TopSection) => {
    setActiveSection(sec);
    setAboutDropdownOpen(false);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const donateHref =
    import.meta.env.VITE_PAYPAL_DONATE_URL ||
    import.meta.env.VITE_STRIPE_DONATE_URL ||
    SOCIAL_LINKS.instagramUrl;

  // Optional toggle for Facebook embed plugin (requires browser Facebook session)
  const [showFacebookPluginIframe, setShowFacebookPluginIframe] = useState(false);

  /**
   * Reusable Live Social Media Viewing iFrames Grid (Instagram @njveteranhockey + Facebook Page 61594324051761)
   * Requires zero API keys — displays live scrollable posts directly in the website.
   */
  const renderLiveSocialViewingGrid = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* 1. Instagram Live Scrollable Viewing iFrame (@njveteranhockey) */}
      <div className="lg:col-span-7 bg-[#0D1611] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-xl">
        <div className="px-4 py-3 bg-[#09100C] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={TEAM_LOGOS.redNjStickCrest}
              alt="Instagram @njveteranhockey"
              className="w-6 h-6 rounded-full object-contain"
              referrerPolicy="no-referrer"
            />
            <span className="text-xs font-bold text-white font-mono-tabular">
              Live Instagram Feed · {SOCIAL_LINKS.instagramHandle}
            </span>
          </div>
          <a
            href={SOCIAL_LINKS.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#EAB308] hover:underline inline-flex items-center gap-1"
          >
            <span>Open Instagram</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="w-full h-[580px] bg-white overflow-y-auto">
          <iframe
            title="Garden State Warriors Instagram Live Posts (@njveteranhockey)"
            src={SOCIAL_LINKS.instagramEmbedUrl}
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>
      </div>

      {/* 2. Facebook Official Page & Events Viewer (Page ID 61594324051761) */}
      <div className="lg:col-span-5 bg-[#0D1611] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl">
        <div className="px-4 py-3 bg-[#09100C] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={TEAM_LOGOS.greenGoldCrest}
              alt="Facebook Garden State Warriors"
              className="w-6 h-6 rounded-full object-contain"
              referrerPolicy="no-referrer"
            />
            <span className="text-xs font-bold text-white font-mono-tabular">
              Facebook · Posts & Events
            </span>
          </div>
          <a
            href={SOCIAL_LINKS.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#EAB308] hover:underline inline-flex items-center gap-1"
          >
            <span>Open Facebook</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {showFacebookPluginIframe ? (
          <div className="w-full h-[580px] bg-[#09100C] flex flex-col">
            <iframe
              title="Garden State Warriors Facebook Live Posts & Events"
              src={SOCIAL_LINKS.facebookEmbedUrl}
              className="w-full flex-1 border-0 bg-white"
              loading="lazy"
              allow="encrypted-media"
            />
            <div className="p-2.5 bg-[#09100C] border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
              <span>Note: Facebook requires an active Facebook login in your browser.</span>
              <button
                type="button"
                onClick={() => setShowFacebookPluginIframe(false)}
                className="text-[#EAB308] hover:underline font-semibold"
              >
                Back to Feed Preview
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={TEAM_LOGOS.redNjStickCrest}
                  alt="Garden State Warriors Facebook"
                  className="w-12 h-12 rounded-full object-contain border border-white/15"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h3 className="text-base font-bold text-white font-display uppercase">
                    {SOCIAL_LINKS.facebookName}
                  </h3>
                  <p className="text-xs text-[#EAB308] font-mono-tabular">
                    Official Facebook Page & Events
                  </p>
                </div>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                Veteran Hockey Club, run by veterans. Garden State Warriors Disabled Veterans
                Hockey Club Inc. is a registered 501(c)(3) tax-exempt public charity.
              </p>

              <div className="rounded-xl overflow-hidden border border-white/10 bg-[#070C09]">
                <img
                  src={TEAM_LOGOS.instagramScreenshot}
                  alt="Garden State Warriors Social Feed Preview"
                  className="w-full h-64 object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={SOCIAL_LINKS.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-[#EAB308] text-[#070C09] font-bold text-xs hover:bg-[#FACC15] transition-colors flex items-center justify-center gap-1.5"
              >
                <span>View All Posts & Events on Facebook</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setShowFacebookPluginIframe(true)}
                className="w-full py-2 px-4 rounded-xl bg-white/[0.06] hover:bg-white/10 text-neutral-200 font-semibold text-xs transition-colors"
              >
                Load Embedded Facebook iFrame Viewer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#070C09] text-[#F4F6F4] selection:bg-[#EAB308] selection:text-[#070C09]">
      {/* SLEEK STICKY HEADER (Constrained to max-w-5xl) */}
      <header className="sticky top-0 z-40 bg-[#070C09]/90 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          {/* Brand Crest & Name */}
          <button
            type="button"
            onClick={() => navigateToSection('home')}
            className="flex items-center gap-2 text-left whitespace-nowrap shrink-0 group focus:outline-none"
          >
            <img
              src={TEAM_LOGOS.greenGoldCrest}
              alt="Garden State Warriors Crest"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-full transition-transform duration-200 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            <span className="text-sm sm:text-lg md:text-xl font-extrabold tracking-wider text-white font-display uppercase">
              Garden State Warriors
            </span>
          </button>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-6 text-xs uppercase tracking-wider font-semibold"
          >
            <button
              type="button"
              onClick={() => navigateToSection('home')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                activeSection === 'home'
                  ? 'border-[#EAB308] text-[#EAB308]'
                  : 'border-transparent text-neutral-300 hover:text-white'
              }`}
            >
              Home
            </button>

            {/* About Us Dropdown: Mission, Board and Staff, Players, Fans */}
            <div
              className="relative"
              onMouseEnter={() => setAboutDropdownOpen(true)}
              onMouseLeave={() => setAboutDropdownOpen(false)}
            >
              <button
                type="button"
                aria-expanded={aboutDropdownOpen}
                onClick={() => {
                  if (activeSection !== 'about') {
                    navigateToAboutSub('mission');
                  } else {
                    setAboutDropdownOpen((prev) => !prev);
                  }
                }}
                className={`flex items-center gap-1 whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors uppercase ${
                  activeSection === 'about'
                    ? 'border-[#EAB308] text-[#EAB308]'
                    : 'border-transparent text-neutral-300 hover:text-white'
                }`}
              >
                <span>About Us</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {aboutDropdownOpen && (
                <div className="absolute left-0 top-full pt-2 w-52 z-50">
                  <div className="bg-[#0D1611] border border-white/15 rounded-xl shadow-2xl py-1.5 overflow-hidden">
                    {(
                      [
                        { id: 'mission', label: 'Mission' },
                        { id: 'board-staff', label: 'Board and Staff' },
                        { id: 'players', label: 'Players' },
                        { id: 'fans', label: 'Fans' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateToAboutSub(item.id)}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center justify-between hover:bg-white/[0.06] transition-colors ${
                          activeSection === 'about' && aboutSubTab === item.id
                            ? 'text-[#EAB308] bg-white/[0.04]'
                            : 'text-neutral-200'
                        }`}
                      >
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigateToSection('events')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors uppercase ${
                activeSection === 'events'
                  ? 'border-[#EAB308] text-[#EAB308]'
                  : 'border-transparent text-neutral-300 hover:text-white'
              }`}
            >
              Events
            </button>

            <button
              type="button"
              onClick={() => navigateToSection('donate')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors uppercase ${
                activeSection === 'donate'
                  ? 'border-[#EAB308] text-[#EAB308]'
                  : 'border-transparent text-neutral-300 hover:text-white'
              }`}
            >
              Donate
            </button>

            <button
              type="button"
              onClick={() => navigateToSection('media')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors uppercase ${
                activeSection === 'media'
                  ? 'border-[#EAB308] text-[#EAB308]'
                  : 'border-transparent text-neutral-300 hover:text-white'
              }`}
            >
              Media
            </button>

            <button
              type="button"
              onClick={() => navigateToSection('contact')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors uppercase ${
                activeSection === 'contact'
                  ? 'border-[#EAB308] text-[#EAB308]'
                  : 'border-transparent text-neutral-300 hover:text-white'
              }`}
            >
              Contact
            </button>
          </nav>

          {/* Primary CTA + Mobile Hamburger */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigateToSection('become-warrior')}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-[#EAB308] text-[#070C09] font-bold text-[11px] sm:text-xs hover:bg-[#FACC15] transition-colors whitespace-nowrap shrink-0"
            >
              Become a Warrior
            </button>

            <button
              type="button"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 sm:p-2 rounded-lg bg-white/[0.06] text-white hover:bg-white/10"
            >
              {mobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0B130E] border-b border-white/10 px-4 py-4 space-y-1.5">
            <button
              type="button"
              onClick={() => navigateToSection('home')}
              className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-white hover:bg-white/5"
            >
              Home
            </button>
            <div className="pl-3 border-l border-[#EAB308]/40 space-y-1 py-1">
              <span className="text-[11px] font-mono-tabular text-[#EAB308] uppercase block px-2">
                About Us
              </span>
              <button
                type="button"
                onClick={() => navigateToAboutSub('mission')}
                className="block w-full text-left py-1.5 px-2 rounded text-xs text-neutral-200 hover:bg-white/5"
              >
                Mission
              </button>
              <button
                type="button"
                onClick={() => navigateToAboutSub('board-staff')}
                className="block w-full text-left py-1.5 px-2 rounded text-xs text-neutral-200 hover:bg-white/5"
              >
                Board and Staff
              </button>
              <button
                type="button"
                onClick={() => navigateToAboutSub('players')}
                className="block w-full text-left py-1.5 px-2 rounded text-xs text-neutral-200 hover:bg-white/5"
              >
                Players
              </button>
              <button
                type="button"
                onClick={() => navigateToAboutSub('fans')}
                className="block w-full text-left py-1.5 px-2 rounded text-xs text-neutral-200 hover:bg-white/5"
              >
                Fans
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigateToSection('events')}
              className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-white hover:bg-white/5"
            >
              Events
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('donate')}
              className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-white hover:bg-white/5"
            >
              Donate
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('media')}
              className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-white hover:bg-white/5"
            >
              Media
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('contact')}
              className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-white hover:bg-white/5"
            >
              Contact
            </button>
          </div>
        )}
      </header>

      {/* SLEEK, BALANCED MAIN CONTENT CONTAINER (max-w-5xl) */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 md:py-10">
        {/* ===================================================================
            1. HOME PAGE
           =================================================================== */}
        {activeSection === 'home' && (
          <div className="space-y-12">
            {/* Dual Crest Team Header Banner (Matches Wireframe IMG_9668) */}
            <section className="relative rounded-2xl bg-gradient-to-b from-[#112017] via-[#0C1610] to-[#09100C] border border-white/10 p-6 sm:p-8 shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Left Official Crest: Green & Gold */}
                <div className="md:col-span-3 flex justify-center md:justify-start">
                  <div className="p-2 rounded-full bg-[#070C09] border border-[#EAB308]/40 shadow-lg">
                    <img
                      src={TEAM_LOGOS.greenGoldCrest}
                      alt="Garden State Warriors Veterans Hockey Club Est. 2026 Crest"
                      className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                {/* Center Team Name & Identity */}
                <div className="md:col-span-6 text-center space-y-2.5">
                  <div className="text-[11px] font-mono-tabular text-[#EAB308] uppercase tracking-widest">
                    Est. 2026 · New Jersey · 501(c)(3) Public Charity
                  </div>
                  <h1
                    className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white font-display uppercase tracking-wider leading-none"
                    style={{ textWrap: 'balance' }}
                  >
                    Garden State Warriors
                  </h1>
                  <p className="text-xs sm:text-sm text-neutral-300">
                    Disabled Veterans Hockey Club Inc.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => navigateToAboutSub('players')}
                      className="px-4 py-2 rounded-lg bg-[#EAB308] text-[#070C09] font-bold text-xs hover:bg-[#FACC15] transition-colors"
                    >
                      View Roster
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToSection('donate')}
                      className="px-4 py-2 rounded-lg bg-[#881616] text-white font-bold text-xs hover:bg-[#991B1B] transition-colors inline-flex items-center gap-1.5"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span>Donate</span>
                    </button>
                  </div>
                </div>

                {/* Right Official Crest: Red NJ Silhouette & Crossed Sticks */}
                <div className="md:col-span-3 flex justify-center md:justify-end">
                  <div className="p-2 rounded-full bg-[#070C09] border border-[#991B1B]/60 shadow-lg">
                    <img
                      src={TEAM_LOGOS.redNjStickCrest}
                      alt="Garden State Warriors NJ Stick Logo"
                      className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* SLIDE DECK OF TEAM PHOTOS */}
            <section aria-label="Slide Deck of Team Photos" className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                    Slide Deck of Team Photos ({currentSlide + 1} / {HERO_SLIDE_DECK.length})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Previous team photo slide"
                    onClick={() =>
                      setCurrentSlide(
                        (prev) => (prev - 1 + HERO_SLIDE_DECK.length) % HERO_SLIDE_DECK.length
                      )
                    }
                    className="p-1.5 rounded-lg bg-[#0E1712] border border-white/10 text-white hover:border-[#EAB308]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoPlaySlides(!autoPlaySlides)}
                    className="px-2.5 py-1 rounded-lg bg-[#0E1712] border border-white/10 text-[11px] text-neutral-300 hover:text-white font-mono-tabular"
                  >
                    {autoPlaySlides ? 'Pause' : 'Play'}
                  </button>
                  <button
                    type="button"
                    aria-label="Next team photo slide"
                    onClick={() =>
                      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDE_DECK.length)
                    }
                    className="p-1.5 rounded-lg bg-[#0E1712] border border-white/10 text-white hover:border-[#EAB308]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {(() => {
                const slide = HERO_SLIDE_DECK[currentSlide];
                return (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#122218] via-[#0C1610] to-[#140B0C] min-h-[300px] sm:min-h-[340px] flex flex-col justify-between p-6 sm:p-8 shadow-xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-300 font-mono-tabular z-10">
                      <span className="text-[#EAB308] font-semibold">{slide.tag}</span>
                      <span>{slide.dateLabel}</span>
                    </div>

                    <div className="my-auto py-5 flex flex-col items-center text-center max-w-2xl mx-auto z-10 space-y-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={TEAM_LOGOS.greenGoldCrest}
                          alt="Garden State Warriors Crest"
                          className="w-12 h-12 object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <Camera className="w-6 h-6 text-[#EAB308]" />
                        <img
                          src={TEAM_LOGOS.redNjStickCrest}
                          alt="Warriors NJ Stick Crest"
                          className="w-12 h-12 object-contain rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <h2
                        className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase tracking-wide"
                        style={{ textWrap: 'balance' }}
                      >
                        {slide.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-mono-tabular">
                        {slide.subtitle}
                      </p>

                      <div className="mt-2 px-3.5 py-2 rounded-lg bg-black/60 border border-[#EAB308]/35 text-[11px] text-amber-200/90 font-mono-tabular">
                        {slide.replaceInstruction}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 z-10 pt-2">
                      {HERO_SLIDE_DECK.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-label={`Go to slide ${idx + 1}: ${s.title}`}
                          onClick={() => setCurrentSlide(idx)}
                          className={`h-1.5 rounded-full transition-all ${
                            idx === currentSlide
                              ? 'w-7 bg-[#EAB308]'
                              : 'w-2 bg-white/25 hover:bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* UNDERNEATH SLIDE DECK: EXACT INTRO PARAGRAPH */}
            <section className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-6">
              <div className="max-w-2xl mx-auto space-y-3">
                <h2
                  className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white font-display uppercase tracking-wide"
                  style={{ textWrap: 'balance' }}
                >
                  Veteran Hockey, run by veterans.
                </h2>
                <p className="text-sm sm:text-base text-[#EAB308] font-semibold leading-relaxed">
                  Garden State Warriors Disabled Veterans Hockey Club is a registered 501(c)(3)
                  tax-exempt public charity.
                </p>
                <p className="text-[11px] text-amber-200/80 font-mono-tabular pt-1">
                  {formatReplaceTag(
                    'additional introductory story once written by the club',
                    'text'
                  )}
                </p>
              </div>

              {/* 6 U.S. Armed Forces Branches */}
              <div className="pt-5 border-t border-white/[0.08]">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  {MILITARY_BRANCHES.map((b) => (
                    <div
                      key={b.id}
                      className="bg-[#080E0B] border border-white/[0.08] rounded-xl p-3 flex flex-col items-center justify-center text-center"
                    >
                      <Shield className="w-5 h-5 text-[#EAB308] mb-1" />
                      <span className="text-xs font-bold text-white font-display uppercase tracking-wider">
                        {b.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 mt-0.5">{b.motto}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* AT BOTTOM OF HOME PAGE: THANKS SPONSORS AND SUPPORTERS (LISTED) */}
            <section
              aria-label="Sponsors and Supporters"
              className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5"
            >
              <div className="text-center max-w-xl mx-auto space-y-1.5">
                <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                  501(c)(3) Partners
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white font-display uppercase">
                  Thanks Sponsors and Supporters
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sponsors.map((sp) => (
                  <div
                    key={sp.id}
                    className="bg-[#080E0B] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-mono-tabular text-[#EAB308]">
                        {sp.tier}
                      </span>
                      <h3 className="text-lg font-bold text-white font-display uppercase">
                        {sp.name}
                      </h3>
                      <p className="text-xs text-neutral-300 leading-relaxed font-mono-tabular">
                        {sp.description}
                      </p>
                    </div>
                    {sp.logoUrl && !sp.logoUrl.startsWith('[') ? (
                      <img
                        src={sp.logoUrl}
                        alt={sp.name}
                        className="h-14 w-auto object-contain rounded bg-black/40 p-2 border border-white/10"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="p-2 rounded bg-black/40 border border-[#EAB308]/25 text-[11px] text-amber-200/90 font-mono-tabular">
                        {sp.placeholderNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            2. ABOUT US SECTION (Dropdown: Mission, Board and Staff, Players, Fans)
           =================================================================== */}
        {activeSection === 'about' && (
          <div className="space-y-8">
            {/* About Us Sub-Navigation Bar */}
            <div className="bg-[#0D1611] border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                  About Us · Garden State Warriors
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase">
                  {aboutSubTab === 'mission' && 'Our Mission'}
                  {aboutSubTab === 'board-staff' && 'Board and Staff'}
                  {aboutSubTab === 'players' && 'Players, Captains & Testimonies'}
                  {aboutSubTab === 'fans' && 'Fans: Friends, Families & Pets'}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 bg-[#070C09] p-1 rounded-lg border border-white/10">
                {(
                  [
                    { id: 'mission', label: 'Mission' },
                    { id: 'board-staff', label: 'Board and Staff' },
                    { id: 'players', label: 'Players' },
                    { id: 'fans', label: 'Fans' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAboutSubTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      aboutSubTab === tab.id
                        ? 'bg-[#EAB308] text-[#070C09]'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ---------------------------------------------------------------
                ABOUT SUB-TAB 1: MISSION
               --------------------------------------------------------------- */}
            {aboutSubTab === 'mission' && (
              <div className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 sm:p-10 space-y-6 max-w-3xl mx-auto">
                <div className="flex items-center gap-3">
                  <img
                    src={TEAM_LOGOS.greenGoldCrest}
                    alt="Garden State Warriors Crest"
                    className="w-12 h-12 object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                      501(c)(3) Public Charity
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase">
                      Our Mission
                    </h2>
                  </div>
                </div>

                <div className="p-6 rounded-xl bg-[#070C09] border border-[#EAB308]/40 space-y-2">
                  <p className="text-base sm:text-lg font-bold text-[#EAB308] font-mono-tabular">
                    [Insert = Mission statement eventually]
                  </p>
                </div>

                <p className="text-sm text-neutral-300 leading-relaxed">
                  Veteran Hockey, run by veterans. Garden State Warriors Disabled Veterans Hockey
                  Club Inc. is a registered 501(c)(3) tax-exempt public charity.
                </p>
              </div>
            )}

            {/* ---------------------------------------------------------------
                ABOUT SUB-TAB 2: BOARD AND STAFF (4 Board + 2 Coaches)
               --------------------------------------------------------------- */}
            {aboutSubTab === 'board-staff' && (
              <div className="space-y-10">
                {/* 4 Board Officers: President, Vice President, Secretary, Treasurer */}
                <section className="space-y-5">
                  <div className="text-center max-w-xl mx-auto space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#EAB308] font-display uppercase tracking-wide">
                      Board of Directors
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-300">
                      President, Vice President, Secretary, and Treasurer.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {boardMembers.map((member) => (
                      <div
                        key={member.id}
                        className="bg-[#0D1611] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
                      >
                        <div className="aspect-square bg-gradient-to-b from-[#17281E] to-[#080E0B] p-5 flex flex-col items-center justify-center text-center relative">
                          {member.photoUrl ? (
                            <img
                              src={member.photoUrl}
                              alt={member.role}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <>
                              <img
                                src={TEAM_LOGOS.greenGoldCrest}
                                alt={member.role}
                                className="w-16 h-16 object-contain mb-3"
                                referrerPolicy="no-referrer"
                              />
                              <span className="text-xs font-bold text-[#EAB308] font-mono-tabular uppercase">
                                {member.role}
                              </span>
                              <span className="mt-2 text-[10px] text-amber-200/90 font-mono-tabular bg-black/50 p-1.5 rounded border border-[#EAB308]/30">
                                {member.photoPlaceholder}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="p-4 text-center space-y-1.5 border-t border-white/10 bg-[#0A110D]">
                          <span className="text-xs font-bold text-[#EAB308] uppercase font-display tracking-wider block">
                            {member.role}
                          </span>
                          <h3 className="text-xs font-bold text-white font-mono-tabular">
                            {member.name}
                          </h3>
                          <p className="text-[11px] text-neutral-300 leading-relaxed pt-1 font-mono-tabular">
                            {member.caption}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 2 Coaches */}
                <section className="space-y-5 pt-4 border-t border-white/10">
                  <div className="text-center max-w-xl mx-auto space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#EF4444] font-display uppercase tracking-wide">
                      Coaches
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
                    {coaches.map((coach) => (
                      <div
                        key={coach.id}
                        className="bg-[#0D1611] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
                      >
                        <div className="aspect-square bg-gradient-to-b from-[#6B1414]/60 to-[#080E0B] p-5 flex flex-col items-center justify-center text-center">
                          {coach.photoUrl ? (
                            <img
                              src={coach.photoUrl}
                              alt={coach.role}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <>
                              <img
                                src={TEAM_LOGOS.redNjStickCrest}
                                alt={coach.role}
                                className="w-16 h-16 object-contain rounded-full mb-3"
                                referrerPolicy="no-referrer"
                              />
                              <span className="text-xs font-bold text-white font-mono-tabular uppercase">
                                {coach.role}
                              </span>
                              <span className="mt-2 text-[10px] text-amber-200/90 font-mono-tabular bg-black/50 p-1.5 rounded border border-[#EAB308]/30">
                                {coach.photoPlaceholder}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="p-4 text-center space-y-1.5 border-t border-white/10 bg-[#0A110D]">
                          <span className="text-xs font-bold text-red-300 uppercase font-display tracking-wider block">
                            {coach.role}
                          </span>
                          <h3 className="text-xs font-bold text-white font-mono-tabular">
                            {coach.name}
                          </h3>
                          <p className="text-[11px] text-neutral-300 leading-relaxed pt-1 font-mono-tabular">
                            {coach.caption}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ---------------------------------------------------------------
                ABOUT SUB-TAB 3: PLAYERS (4 Captains + 3 Testimonies + Dynamic Sheet Tabs)
               --------------------------------------------------------------- */}
            {aboutSubTab === 'players' && (
              <div className="space-y-12">
                {/* Part A: 4 Captains */}
                <section className="space-y-5">
                  <div className="border-b border-white/10 pb-3">
                    <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                      4 Captains
                    </span>
                    <h2 className="text-2xl font-bold text-white font-display uppercase mt-0.5">
                      Team Captains
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {fourCaptains.map((cap) => (
                      <div
                        key={cap.id}
                        className="bg-[#0D1611] border border-white/10 hover:border-[#EAB308]/40 rounded-2xl overflow-hidden flex flex-col justify-between transition-colors"
                      >
                        <div>
                          <div className="aspect-square bg-gradient-to-br from-[#7F1D1D]/55 via-[#132219] to-[#080E0B] p-4 flex flex-col items-center justify-center text-center">
                            {cap.jerseyPhotoUrl ? (
                              <img
                                src={cap.jerseyPhotoUrl}
                                alt={cap.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <>
                                <img
                                  src={TEAM_LOGOS.redNjStickCrest}
                                  alt={cap.name}
                                  className="w-16 h-16 object-contain rounded-full mb-2.5"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="text-xs font-bold text-[#EAB308] font-mono-tabular uppercase">
                                  {cap.roleBadge || 'Captain'}
                                  {cap.jerseyNumber ? ` · #${cap.jerseyNumber}` : ''}
                                </span>
                                <span className="mt-2 text-[10px] text-amber-200/90 font-mono-tabular bg-black/50 p-1.5 rounded border border-[#EAB308]/30">
                                  {cap.jerseyPhotoPlaceholder}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="p-4 space-y-1.5">
                            <h3 className="text-sm font-bold text-white font-display uppercase">
                              {cap.name}
                            </h3>
                            <p className="text-xs text-neutral-300 leading-relaxed font-mono-tabular">
                              {cap.shortCaption}
                            </p>
                          </div>
                        </div>

                        <div className="px-4 py-3 border-t border-white/10 bg-[#0A110D] flex items-center justify-between">
                          <span className="text-[11px] text-neutral-400 font-mono-tabular">
                            {cap.rank || cap.tierTab}
                          </span>
                          <button
                            type="button"
                            aria-label={`View Captain Profile for ${cap.name}`}
                            onClick={() => setSelectedPlayerProfile(cap)}
                            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-[#EAB308] hover:text-[#070C09] text-xs font-bold text-white transition-colors"
                          >
                            View Profile
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Part B: 3 Player Testimonies */}
                <section className="space-y-5 bg-[#0D1611] border border-white/10 rounded-2xl p-6">
                  <div className="border-b border-white/10 pb-3">
                    <span className="text-[11px] text-[#EF4444] font-mono-tabular uppercase tracking-wider">
                      3 Player Testimonies
                    </span>
                    <h2 className="text-2xl font-bold text-white font-display uppercase mt-0.5">
                      Player Testimonies
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {threeTestimonies.map((testimonyPlayer, idx) => (
                      <div
                        key={testimonyPlayer.id}
                        className="bg-[#080E0B] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={TEAM_LOGOS.greenGoldCrest}
                              alt={testimonyPlayer.name}
                              className="w-10 h-10 object-contain rounded-full shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <span className="text-[11px] text-[#EAB308] font-mono-tabular block">
                                Testimony 0{idx + 1}
                              </span>
                              <h3 className="text-sm font-bold text-white font-display uppercase">
                                {testimonyPlayer.name}
                              </h3>
                            </div>
                          </div>

                          <p className="text-xs text-neutral-300 italic leading-relaxed font-mono-tabular">
                            {testimonyPlayer.whatWarriorsMeans}
                          </p>
                        </div>

                        <div className="pt-2.5 border-t border-white/10 flex items-center justify-between">
                          <span className="text-[11px] text-neutral-400 font-mono-tabular">
                            {testimonyPlayer.jerseyNumber
                              ? `#${testimonyPlayer.jerseyNumber}`
                              : 'Warrior'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedPlayerProfile(testimonyPlayer)}
                            className="text-xs font-bold text-[#EAB308] hover:underline"
                          >
                            View Profile →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Part C: Auto-Updating Roster from Verified Google Sheets Tabs */}
                <section className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-3">
                    <div>
                      <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                        Auto-Updated from Google Sheets
                      </span>
                      <h2 className="text-2xl font-bold text-white font-display uppercase mt-0.5">
                        Roster & Rank Tabs ({filteredPlayers.length})
                      </h2>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={playerSearchQuery}
                        onChange={(e) => setPlayerSearchQuery(e.target.value)}
                        placeholder="Search player, #number, rank..."
                        aria-label="Search players"
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#0D1611] border border-white/15 text-xs text-white focus:border-[#EAB308] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Sheet Tabs & Military Rank Filters */}
                  <div className="space-y-2.5 bg-[#0D1611] border border-white/10 rounded-xl p-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-neutral-400 font-mono-tabular mr-1.5">
                        Sheet Tabs:
                      </span>
                      {['All', ...dynamicTabs].map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setSelectedTierTab(tab)}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                            selectedTierTab === tab
                              ? 'bg-[#EAB308] text-[#070C09]'
                              : 'bg-[#070C09] text-neutral-300 hover:text-white'
                          }`}
                        >
                          {tab === 'All' ? 'All Tabs' : tab}
                        </button>
                      ))}
                    </div>

                    {availableRanks.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                        <span className="text-[11px] text-neutral-400 font-mono-tabular mr-1.5">
                          Ranks:
                        </span>
                        {availableRanks.map((rk) => (
                          <button
                            key={rk}
                            type="button"
                            onClick={() => setSelectedRankFilter(rk)}
                            className={`px-2.5 py-1 rounded text-xs font-mono-tabular transition-colors whitespace-nowrap shrink-0 ${
                              selectedRankFilter === rk
                                ? 'bg-[#881616] text-white font-bold'
                                : 'bg-[#070C09] text-neutral-300 hover:text-white'
                            }`}
                          >
                            {rk === 'All' ? 'All Ranks' : rk}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Roster Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPlayers.map((player) => (
                      <div
                        key={player.id}
                        className="bg-[#0D1611] border border-white/10 hover:border-[#EAB308]/40 rounded-2xl overflow-hidden flex flex-col justify-between transition-all"
                      >
                        <div>
                          <div className="aspect-[4/3] bg-gradient-to-br from-[#16271C] via-[#0F1B14] to-[#080E0B] p-4 flex flex-col items-center justify-center text-center">
                            {player.jerseyPhotoUrl ? (
                              <img
                                src={player.jerseyPhotoUrl}
                                alt={player.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <>
                                <img
                                  src={TEAM_LOGOS.greenGoldCrest}
                                  alt={player.name}
                                  className="w-14 h-14 object-contain mb-2"
                                  referrerPolicy="no-referrer"
                                />
                                {player.jerseyNumber && (
                                  <span className="text-lg font-extrabold text-white font-mono-tabular">
                                    #{player.jerseyNumber}{' '}
                                    {player.position ? `· ${player.position}` : ''}
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          <div className="p-4 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono-tabular">
                              <span>
                                {[player.rank, player.branch].filter(Boolean).join(' · ') ||
                                  (player.isPlaceholder ? 'Temporary Placeholder' : 'Warrior')}
                              </span>
                              <span>{player.tierTab}</span>
                            </div>
                            <h3 className="text-base font-bold text-white font-display uppercase">
                              {player.name}
                            </h3>
                            <p className="text-xs text-neutral-300 line-clamp-2 font-mono-tabular">
                              {player.shortCaption}
                            </p>
                          </div>
                        </div>

                        <div className="px-4 py-3 bg-[#0A110D] border-t border-white/10 flex items-center justify-between">
                          <span className="text-[11px] text-neutral-400 font-mono-tabular">
                            Profile & Media
                          </span>
                          <button
                            type="button"
                            aria-label={`View Roster Profile for ${player.name}`}
                            onClick={() => setSelectedPlayerProfile(player)}
                            className="px-3 py-1 rounded-lg bg-[#EAB308] text-[#070C09] text-xs font-bold hover:bg-[#FACC15] transition-colors"
                          >
                            View Profile
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ---------------------------------------------------------------
                ABOUT SUB-TAB 4: FANS (Friends, Families & Pets Compilation)
               --------------------------------------------------------------- */}
            {aboutSubTab === 'fans' && (
              <div className="space-y-6">
                <div className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                      Friends, Families & Pets of the Team
                    </span>
                    <h2 className="text-2xl font-bold text-white font-display uppercase">
                      Garden State Warriors Fans Compilation
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['All', 'Family', 'Friends', 'Pets'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFanCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          fanCategoryFilter === cat
                            ? 'bg-[#EAB308] text-[#070C09]'
                            : 'bg-[#070C09] text-neutral-300 hover:text-white border border-white/10'
                        }`}
                      >
                        {cat === 'All' ? 'All' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {filteredFans.map((fan) => (
                    <div
                      key={fan.id}
                      className="bg-[#0D1611] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
                    >
                      <div className="aspect-video bg-gradient-to-br from-[#16271C] to-[#080E0B] p-5 flex flex-col items-center justify-center text-center">
                        {fan.photoUrl ? (
                          <img
                            src={fan.photoUrl}
                            alt={fan.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <>
                            <Users className="w-8 h-8 text-[#EAB308] mb-2" />
                            <span className="text-sm font-bold text-white font-display uppercase">
                              {fan.title}
                            </span>
                            <span className="mt-2 text-[10px] text-amber-200/90 font-mono-tabular bg-black/50 p-2 rounded border border-[#EAB308]/30">
                              {fan.photoPlaceholder}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="p-4 space-y-1.5 border-t border-white/10 bg-[#0A110D]">
                        <div className="text-[11px] text-[#EAB308] font-mono-tabular">
                          {fan.category}
                        </div>
                        <h3 className="text-base font-bold text-white font-display uppercase">
                          {fan.title}
                        </h3>
                        <p className="text-xs text-neutral-300 leading-relaxed font-mono-tabular">
                          {fan.caption}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            3. EVENTS & SOCIAL MEDIA POSTS SECTION
               - Scrollable Live Viewing iFrames for Instagram & Facebook (No API Key Needed)
               - Event Cards with [Insert description of this event - text] Placeholders
           =================================================================== */}
        {activeSection === 'events' && (
          <div className="space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                Live Social Media Posts & Events
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display uppercase tracking-wide">
                Events & Social Media Feed
              </h1>
              <p className="text-xs sm:text-sm text-neutral-300">
                Scroll through live up-to-date posts and events directly from{' '}
                <span className="text-[#EAB308] font-mono-tabular">
                  {SOCIAL_LINKS.instagramHandle}
                </span>{' '}
                and Facebook below.
              </p>
            </div>

            {/* Live Scrollable Social Media Viewing iFrames (Instagram + Facebook) */}
            {renderLiveSocialViewingGrid()}

            {/* Event Entries (Shows [Insert description of this event - text] placeholders until populated) */}
            <div className="max-w-3xl mx-auto space-y-4 pt-4 border-t border-white/10">
              <h2 className="text-xl sm:text-2xl font-bold text-[#EAB308] font-display uppercase tracking-wide text-center">
                Event Listings
              </h2>
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-[#111915] border border-white/10 rounded-2xl overflow-hidden shadow-lg"
                >
                  <div className="p-5 border-b border-white/10 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-2 shrink-0 overflow-hidden">
                      {ev.imageUrl ? (
                        <img
                          src={ev.imageUrl}
                          alt={ev.title}
                          className="w-full h-full object-cover rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <img
                          src={TEAM_LOGOS.redNjStickCrest}
                          alt={ev.title}
                          className="w-full h-full object-contain rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-bold text-white font-mono-tabular">
                        {ev.title}
                      </h3>
                      <p className="text-xs text-neutral-400 font-mono-tabular">
                        {ev.date}
                        {ev.time ? ` · ${ev.time}` : ''}
                      </p>
                      <p className="text-xs text-[#EAB308] flex items-center gap-1 font-mono-tabular">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{ev.location}</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed font-mono-tabular">
                      {ev.description}
                    </p>
                    {!ev.imageUrl && (
                      <div className="p-2.5 rounded-lg bg-black/40 border border-[#EAB308]/30 text-[11px] text-amber-200/90 font-mono-tabular">
                        {ev.placeholderBanner}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================
            4. DONATE PAGE (501(c)(3) Tax-Exempt Support)
           =================================================================== */}
        {activeSection === 'donate' && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <img
                  src={TEAM_LOGOS.greenGoldCrest}
                  alt="Garden State Warriors Crest"
                  className="w-12 h-12 object-contain"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                    501(c)(3) Tax-Exempt Public Charity
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase">
                    Support Garden State Warriors
                  </h1>
                </div>
              </div>

              <p className="text-sm text-neutral-300 leading-relaxed">
                Veteran Hockey, run by veterans. Garden State Warriors Disabled Veterans Hockey
                Club Inc. is a registered 501(c)(3) tax-exempt public charity.
              </p>

              <div className="space-y-3">
                <span className="text-xs font-semibold text-neutral-300 block">
                  Select Donation Amount:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[25, 50, 100, 250].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setSelectedDonationAmount(amt);
                        setCustomDonationAmount('');
                      }}
                      className={`py-2.5 rounded-xl font-mono-tabular font-bold text-sm border transition-colors ${
                        selectedDonationAmount === amt && !customDonationAmount
                          ? 'bg-[#EAB308] text-[#070C09] border-[#EAB308]'
                          : 'bg-[#070C09] text-white border-white/15 hover:border-[#EAB308]/50'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                <div className="pt-2">
                  <label className="block text-xs text-neutral-400 mb-1">
                    Or Enter Custom Amount ($ USD):
                  </label>
                  <input
                    type="number"
                    min="5"
                    value={customDonationAmount}
                    onChange={(e) => setCustomDonationAmount(e.target.value)}
                    placeholder="Custom amount..."
                    className="w-full px-3.5 py-2 rounded-lg bg-[#070C09] border border-white/15 text-sm text-white font-mono-tabular"
                  />
                </div>
              </div>

              <a
                href={donateHref}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-[#881616] hover:bg-[#991B1B] text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4" />
                <span>
                  Donate ${customDonationAmount ? customDonationAmount : selectedDonationAmount}
                </span>
              </a>
            </div>
          </div>
        )}

        {/* ===================================================================
            5. MEDIA PAGE (Live Scrollable Instagram & Facebook Viewing iFrames)
           =================================================================== */}
        {activeSection === 'media' && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                Official Social Media Viewing Feeds
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display uppercase">
                Garden State Warriors Media
              </h1>
              <p className="text-xs sm:text-sm text-neutral-300">
                Browse live up-to-date posts directly from{' '}
                <span className="text-[#EAB308] font-mono-tabular">
                  {SOCIAL_LINKS.instagramHandle}
                </span>{' '}
                and Facebook.
              </p>
            </div>

            {renderLiveSocialViewingGrid()}
          </div>
        )}

        {/* ===================================================================
            6. CONTACT PAGE
           =================================================================== */}
        {activeSection === 'contact' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-5">
              <div className="flex justify-center items-center gap-3">
                <img
                  src={TEAM_LOGOS.greenGoldCrest}
                  alt="Garden State Warriors Crest"
                  className="w-14 h-14 object-contain"
                  referrerPolicy="no-referrer"
                />
                <img
                  src={TEAM_LOGOS.redNjStickCrest}
                  alt="Garden State Warriors NJ Stick Logo"
                  className="w-14 h-14 object-contain rounded-full"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                  Official Club Channels
                </span>
                <h1 className="text-3xl font-extrabold text-white font-display uppercase">
                  Contact Garden State Warriors
                </h1>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Reach out directly through our official Instagram and Facebook pages.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <a
                  href={SOCIAL_LINKS.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl bg-[#080E0B] border border-white/10 hover:border-[#EAB308]/50 flex flex-col items-center gap-1.5 transition-colors"
                >
                  <span className="text-xs text-[#EAB308] font-mono-tabular">Instagram</span>
                  <span className="text-base font-bold text-white">
                    {SOCIAL_LINKS.instagramHandle}
                  </span>
                  <span className="text-[11px] text-neutral-400 inline-flex items-center gap-1">
                    Message on Instagram <ExternalLink className="w-3 h-3" />
                  </span>
                </a>

                <a
                  href={SOCIAL_LINKS.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl bg-[#080E0B] border border-white/10 hover:border-[#EAB308]/50 flex flex-col items-center gap-1.5 transition-colors"
                >
                  <span className="text-xs text-[#EAB308] font-mono-tabular">Facebook</span>
                  <span className="text-base font-bold text-white">
                    Garden State Warriors
                  </span>
                  <span className="text-[11px] text-neutral-400 inline-flex items-center gap-1">
                    Visit Facebook Page <ExternalLink className="w-3 h-3" />
                  </span>
                </a>
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-[#EAB308]/30 text-[11px] text-amber-200/90 font-mono-tabular">
                {formatReplaceTag(
                  'official club email address and home rink mailing address',
                  'text'
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            7. BECOME A WARRIOR (Verified Eligibility & Onboarding)
           =================================================================== */}
        {activeSection === 'become-warrior' && <BecomeWarriorForm />}
      </main>

      {/* SLEEK INSTITUTIONAL FOOTER */}
      <footer className="bg-[#050907] border-t border-white/[0.08] py-8 px-4 sm:px-6 mt-12">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={TEAM_LOGOS.greenGoldCrest}
              alt="Garden State Warriors Primary Logo"
              className="w-11 h-11 object-contain"
              referrerPolicy="no-referrer"
            />
            <img
              src={TEAM_LOGOS.redNjStickCrest}
              alt="Garden State Warriors Secondary Logo"
              className="w-11 h-11 object-contain rounded-full"
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="text-sm font-bold text-white font-display uppercase block">
                Garden State Warriors Disabled Veterans Hockey Club Inc.
              </span>
              <span className="text-[11px] text-neutral-400">
                Veteran Hockey, run by veterans · Registered 501(c)(3) Public Charity
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-neutral-300">
            <a
              href={SOCIAL_LINKS.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#EAB308] transition-colors"
            >
              Instagram ({SOCIAL_LINKS.instagramHandle})
            </a>
            <span aria-hidden="true">·</span>
            <a
              href={SOCIAL_LINKS.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#EAB308] transition-colors"
            >
              Facebook
            </a>
          </div>
        </div>
      </footer>

      {/* PLAYER PROFILE MODAL */}
      <PlayerProfileModal
        player={selectedPlayerProfile}
        onClose={() => setSelectedPlayerProfile(null)}
      />
    </div>
  );
}
