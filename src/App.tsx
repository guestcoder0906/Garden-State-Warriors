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
  isValidWebsiteUrl,
  normalizeWebsiteUrl,
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
import {
  syncVerifiedGoogleSheet,
  submitSponsorToGoogleSheet,
  compressSponsorImageToDataUrl,
} from './services/googleWorkspace';
import { uploadSponsorImageToFirebase } from './services/firebaseStorage';
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
  // Starts empty and updates directly from Google Sheets so empty tabs/cells are not rendered while empty
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [fans, setFans] = useState<FanItem[]>([]);
  const [sponsors, setSponsors] = useState<SponsorItem[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [dynamicTabs, setDynamicTabs] = useState<string[]>([]);

  // Players Filtering State (Position/Rank tabs, Tier tabs, Search)
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

  // Become a Sponsor Direct Website Form State (Connected to Google Apps Script -> Sponsors tab)
  const [sponsorName, setSponsorName] = useState<string>('');
  const [sponsorPhone, setSponsorPhone] = useState<string>('');
  const [sponsorEmail, setSponsorEmail] = useState<string>('');
  const [sponsorPreferredContact, setSponsorPreferredContact] = useState<string[]>([]);
  const [sponsorWebsite, setSponsorWebsite] = useState<string>('');
  const [sponsorWebsiteError, setSponsorWebsiteError] = useState<string>('');
  const [sponsorMessage, setSponsorMessage] = useState<string>('');
  const [sponsorLogoDataUrl, setSponsorLogoDataUrl] = useState<string>('');
  const [sponsorFirebaseLogoUrl, setSponsorFirebaseLogoUrl] = useState<string>('');
  const [sponsorLogoFile, setSponsorLogoFile] = useState<File | null>(null);
  const [sponsorLogoFileName, setSponsorLogoFileName] = useState<string>('');
  const [sponsorLogoUploading, setSponsorLogoUploading] = useState<boolean>(false);
  const [sponsorSubmitting, setSponsorSubmitting] = useState<boolean>(false);
  const [sponsorStatus, setSponsorStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const toggleSponsorContactMethod = (method: string) => {
    setSponsorPreferredContact((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleSponsorWebsiteChange = (val: string) => {
    setSponsorWebsite(val);
    const trimmed = val.trim();
    if (trimmed && !isValidWebsiteUrl(trimmed)) {
      setSponsorWebsiteError('Please enter a valid website URL (e.g., https://example.com or www.example.com).');
    } else {
      setSponsorWebsiteError('');
    }
  };

  const handleSponsorFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSponsorLogoFile(file);
    setSponsorLogoFileName(file.name);
    setSponsorFirebaseLogoUrl('');
    setSponsorLogoUploading(true);
    try {
      const [compressed, firebaseUrl] = await Promise.all([
        compressSponsorImageToDataUrl(file),
        uploadSponsorImageToFirebase(file),
      ]);
      setSponsorLogoDataUrl(compressed);
      if (firebaseUrl) {
        setSponsorFirebaseLogoUrl(firebaseUrl);
      }
    } catch {
      setSponsorStatus({
        type: 'error',
        message: 'Could not process the selected image file. Please try another image.',
      });
    } finally {
      setSponsorLogoUploading(false);
    }
  };

  const handleSponsorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorName.trim() && !sponsorEmail.trim() && !sponsorPhone.trim()) {
      setSponsorStatus({
        type: 'error',
        message: 'Please enter at least your Name, Phone, or Email.',
      });
      return;
    }

    if (sponsorWebsite.trim() && !isValidWebsiteUrl(sponsorWebsite.trim())) {
      setSponsorWebsiteError('Please enter a valid website URL (e.g., https://example.com or www.example.com).');
      setSponsorStatus({
        type: 'error',
        message: 'Website must be a valid website URL (e.g., https://example.com).',
      });
      return;
    }

    setSponsorWebsiteError('');
    setSponsorSubmitting(true);
    setSponsorStatus(null);
    const result = await submitSponsorToGoogleSheet({
      name: sponsorName,
      phone: sponsorPhone,
      email: sponsorEmail,
      preferredContact: sponsorPreferredContact,
      website: sponsorWebsite.trim(),
      message: sponsorMessage.trim(),
      logoUrl: sponsorFirebaseLogoUrl || sponsorLogoDataUrl,
      logoFile: sponsorFirebaseLogoUrl ? null : sponsorLogoFile,
      logoFileName: sponsorLogoFileName,
    });
    setSponsorSubmitting(false);

    if (result.ok) {
      setSponsorStatus({ type: 'success', message: result.message });
      setSponsorName('');
      setSponsorPhone('');
      setSponsorEmail('');
      setSponsorPreferredContact([]);
      setSponsorWebsite('');
      setSponsorWebsiteError('');
      setSponsorMessage('');
      setSponsorLogoDataUrl('');
      setSponsorFirebaseLogoUrl('');
      setSponsorLogoFile(null);
      setSponsorLogoFileName('');
    } else {
      setSponsorStatus({ type: 'error', message: result.message });
    }
  };

  // Dynamic Auto-Sync from Verified Google Sheet (`1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s`) via Apps Script / gviz
  useEffect(() => {
    let mounted = true;

    const runSync = async () => {
      const sheetData = await syncVerifiedGoogleSheet();
      if (mounted && sheetData) {
        setPlayers(sheetData.players);
        setStaff(sheetData.staff);
        setEvents(sheetData.events);
        setFans(sheetData.fans || []);
        setSponsors(sheetData.sponsors || []);
        setDynamicTabs(sheetData.detectedTabs);
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

  // Unique Positions / Ranks dynamically derived from current roster (only non-empty cells)
  const availableRanks = useMemo(() => {
    const vals = Array.from(
      new Set(
        players
          .flatMap((p) => [(p.position || '').trim(), (p.rank || '').trim()])
          .filter(Boolean)
      )
    );
    return vals.length > 0 ? ['All', ...vals] : [];
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return filterPlayers(players, {
      tierTab: selectedTierTab,
      rankFilter: selectedRankFilter,
      searchQuery: playerSearchQuery,
    });
  }, [players, selectedTierTab, selectedRankFilter, playerSearchQuery]);

  // Captains & Testimonies (Only non-empty sheet entries)
  const fourCaptains = useMemo(() => {
    return players.filter(
      (p) =>
        p.roleBadge === 'Captain' ||
        p.roleBadge === 'Alternate Captain' ||
        /^captains?$/i.test(p.tierTab || '')
    );
  }, [players]);

  const threeTestimonies = useMemo(() => {
    return players.filter((p) => Boolean(p.whatWarriorsMeans && p.whatWarriorsMeans.trim()));
  }, [players]);

  const boardMembers = useMemo(
    () => staff.filter((s) => s.category === 'Board'),
    [staff]
  );
  const coaches = useMemo(
    () => staff.filter((s) => s.category === 'Coach'),
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

            {/* AT BOTTOM OF HOME PAGE: THANKS SPONSORS AND SUPPORTERS (Only rendered when Sponsors tab has rows) */}
            {sponsors.length > 0 && (
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
                  {sponsors.map((sp) => {
                    const sponsorMsg = (sp.message || sp.description || '').trim();
                    const hasTextInfo = Boolean(sp.tier || sp.name || sponsorMsg || sp.website);
                    return (
                      <div
                        key={sp.id}
                        className="bg-[#080E0B] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between gap-3"
                      >
                        {hasTextInfo && (
                          <div className="space-y-1.5">
                            {sp.tier && (
                              <span className="text-[11px] font-mono-tabular text-[#EAB308] block">
                                {sp.tier}
                              </span>
                            )}
                            {sp.name && (
                              <h3 className="text-lg font-bold text-white font-display uppercase">
                                {sp.name}
                              </h3>
                            )}
                            {sponsorMsg && (
                              <p className="text-xs text-neutral-300 leading-relaxed font-mono-tabular italic">
                                <q>{sponsorMsg}</q>
                              </p>
                            )}
                            {sp.website && (
                              <a
                                href={normalizeWebsiteUrl(sp.website)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[#EAB308] hover:underline pt-1"
                              >
                                <span>Visit Website</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                        {sp.logoUrl && (
                          <img
                            src={sp.logoUrl}
                            alt={sp.name || 'Sponsor Logo'}
                            className="h-14 w-auto object-contain rounded bg-black/40 p-2 border border-white/10 self-start"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
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
                ABOUT SUB-TAB 2: BOARD AND STAFF (Only renders non-empty sections & cells)
               --------------------------------------------------------------- */}
            {aboutSubTab === 'board-staff' && (
              <div className="space-y-10">
                {boardMembers.length > 0 && (
                  <section className="space-y-5">
                    <div className="text-center max-w-xl mx-auto space-y-1">
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-[#EAB308] font-display uppercase tracking-wide">
                        Board of Directors
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {boardMembers.map((member) => (
                        <div
                          key={member.id}
                          className="bg-[#0D1611] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
                        >
                          {member.photoUrl && (
                            <div className="aspect-square bg-[#080E0B] overflow-hidden">
                              <img
                                src={member.photoUrl}
                                alt={member.name || member.role || 'Board Member'}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}

                          <div className="p-4 text-center space-y-1.5 bg-[#0A110D] flex-1 flex flex-col justify-center">
                            {member.role && (
                              <span className="text-xs font-bold text-[#EAB308] uppercase font-display tracking-wider block">
                                {member.role}
                              </span>
                            )}
                            {member.name && (
                              <h3 className="text-sm font-bold text-white font-mono-tabular">
                                {member.name}
                              </h3>
                            )}
                            {(member.rank || member.branchOrBackground) && (
                              <p className="text-[11px] text-neutral-400 font-mono-tabular">
                                {[member.rank, member.branchOrBackground].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            {member.caption && (
                              <p className="text-[11px] text-neutral-300 leading-relaxed pt-1 font-mono-tabular">
                                {member.caption}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {coaches.length > 0 && (
                  <section
                    className={`space-y-5 ${
                      boardMembers.length > 0 ? 'pt-4 border-t border-white/10' : ''
                    }`}
                  >
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
                          {coach.photoUrl && (
                            <div className="aspect-square bg-[#080E0B] overflow-hidden">
                              <img
                                src={coach.photoUrl}
                                alt={coach.name || coach.role || 'Coach'}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}

                          <div className="p-4 text-center space-y-1.5 bg-[#0A110D] flex-1 flex flex-col justify-center">
                            {coach.role && (
                              <span className="text-xs font-bold text-red-300 uppercase font-display tracking-wider block">
                                {coach.role}
                              </span>
                            )}
                            {coach.name && (
                              <h3 className="text-sm font-bold text-white font-mono-tabular">
                                {coach.name}
                              </h3>
                            )}
                            {(coach.rank || coach.branchOrBackground) && (
                              <p className="text-[11px] text-neutral-400 font-mono-tabular">
                                {[coach.rank, coach.branchOrBackground].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            {coach.caption && (
                              <p className="text-[11px] text-neutral-300 leading-relaxed pt-1 font-mono-tabular">
                                {coach.caption}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ---------------------------------------------------------------
                ABOUT SUB-TAB 3: PLAYERS (Only renders non-empty sections & cells)
               --------------------------------------------------------------- */}
            {aboutSubTab === 'players' && (
              <div className="space-y-12">
                {/* Part A: Team Captains (Only rendered when Captain rows exist in sheet) */}
                {fourCaptains.length > 0 && (
                  <section className="space-y-5">
                    <div className="border-b border-white/10 pb-3">
                      <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                        Team Leadership
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
                            {cap.jerseyPhotoUrl && (
                              <div className="aspect-square bg-[#080E0B] overflow-hidden">
                                <img
                                  src={cap.jerseyPhotoUrl}
                                  alt={cap.name || 'Captain'}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}

                            <div className="p-4 space-y-1.5">
                              {(cap.roleBadge && cap.roleBadge !== 'None' && cap.roleBadge !== 'Player') ||
                              cap.jerseyNumber ? (
                                <span className="text-xs font-bold text-[#EAB308] font-mono-tabular uppercase block">
                                  {[
                                    cap.roleBadge &&
                                    cap.roleBadge !== 'None' &&
                                    cap.roleBadge !== 'Player'
                                      ? cap.roleBadge
                                      : '',
                                    cap.jerseyNumber ? `#${cap.jerseyNumber}` : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              ) : null}
                              {cap.name && (
                                <h3 className="text-sm font-bold text-white font-display uppercase">
                                  {cap.name}
                                </h3>
                              )}
                              {cap.shortCaption && (
                                <p className="text-xs text-neutral-300 leading-relaxed font-mono-tabular">
                                  {cap.shortCaption}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="px-4 py-3 border-t border-white/10 bg-[#0A110D] flex items-center justify-between">
                            <span className="text-[11px] text-neutral-400 font-mono-tabular">
                              {[cap.position, cap.rank, cap.tierTab].filter(Boolean).join(' · ')}
                            </span>
                            <button
                              type="button"
                              aria-label={`View Captain Profile for ${cap.name || 'Captain'}`}
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
                )}

                {/* Part B: Player Testimonies (Only rendered when WhatWarriorMeans cells are non-empty) */}
                {threeTestimonies.length > 0 && (
                  <section className="space-y-5 bg-[#0D1611] border border-white/10 rounded-2xl p-6">
                    <div className="border-b border-white/10 pb-3">
                      <span className="text-[11px] text-[#EF4444] font-mono-tabular uppercase tracking-wider">
                        What the Warriors Means
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
                              {testimonyPlayer.jerseyPhotoUrl ? (
                                <img
                                  src={testimonyPlayer.jerseyPhotoUrl}
                                  alt={testimonyPlayer.name || 'Warrior'}
                                  className="w-10 h-10 object-cover rounded-full shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <img
                                  src={TEAM_LOGOS.greenGoldCrest}
                                  alt={testimonyPlayer.name || 'Warrior'}
                                  className="w-10 h-10 object-contain rounded-full shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <div>
                                <span className="text-[11px] text-[#EAB308] font-mono-tabular block">
                                  Testimony 0{idx + 1}
                                </span>
                                {testimonyPlayer.name && (
                                  <h3 className="text-sm font-bold text-white font-display uppercase">
                                    {testimonyPlayer.name}
                                  </h3>
                                )}
                              </div>
                            </div>

                            {testimonyPlayer.whatWarriorsMeans && (
                              <q className="text-xs text-neutral-300 italic leading-relaxed font-mono-tabular">
                                {testimonyPlayer.whatWarriorsMeans}
                              </q>
                            )}
                          </div>

                          <div className="pt-2.5 border-t border-white/10 flex items-center justify-between">
                            <span className="text-[11px] text-neutral-400 font-mono-tabular">
                              {testimonyPlayer.jerseyNumber
                                ? `#${testimonyPlayer.jerseyNumber}`
                                : testimonyPlayer.position || ''}
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
                )}

                {/* Part C: Auto-Updating Roster from Verified Google Sheets Tabs (Only rendered when players exist) */}
                {players.length > 0 && (
                  <section className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-3">
                      <div>
                        <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                          Auto-Updated from Google Sheets
                        </span>
                        <h2 className="text-2xl font-bold text-white font-display uppercase mt-0.5">
                          Roster & Position Tabs ({filteredPlayers.length})
                        </h2>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={playerSearchQuery}
                          onChange={(e) => setPlayerSearchQuery(e.target.value)}
                          placeholder="Search player, #number, position..."
                          aria-label="Search players"
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#0D1611] border border-white/15 text-xs text-white focus:border-[#EAB308] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Sheet Tabs & Positions Filters (Only rendered if tabs or positions exist) */}
                    {(dynamicTabs.length > 0 || availableRanks.length > 1) && (
                      <div className="space-y-2.5 bg-[#0D1611] border border-white/10 rounded-xl p-3.5">
                        {dynamicTabs.length > 0 && (
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
                        )}

                        {availableRanks.length > 1 && (
                          <div
                            className={`flex flex-wrap items-center gap-1.5 ${
                              dynamicTabs.length > 0 ? 'pt-2 border-t border-white/10' : ''
                            }`}
                          >
                            <span className="text-[11px] text-neutral-400 font-mono-tabular mr-1.5">
                              Positions:
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
                                {rk === 'All' ? 'All Positions' : rk}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Roster Cards Grid (Only renders non-empty cells per player) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredPlayers.map((player) => (
                        <div
                          key={player.id}
                          className="bg-[#0D1611] border border-white/10 hover:border-[#EAB308]/40 rounded-2xl overflow-hidden flex flex-col justify-between transition-all"
                        >
                          <div>
                            {player.jerseyPhotoUrl && (
                              <div className="aspect-[4/3] bg-[#080E0B] overflow-hidden">
                                <img
                                  src={player.jerseyPhotoUrl}
                                  alt={player.name || 'Warrior'}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}

                            <div className="p-4 space-y-1.5">
                              {(player.rank ||
                                player.branch ||
                                player.tierTab ||
                                player.jerseyNumber ||
                                player.position) && (
                                <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono-tabular">
                                  <span>
                                    {[
                                      player.jerseyNumber ? `#${player.jerseyNumber}` : '',
                                      player.position,
                                      player.rank,
                                      player.branch,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                  {player.tierTab && <span>{player.tierTab}</span>}
                                </div>
                              )}
                              {player.name && (
                                <h3 className="text-base font-bold text-white font-display uppercase">
                                  {player.name}
                                </h3>
                              )}
                              {player.bio && (
                                <p className="text-xs text-neutral-300 line-clamp-2 font-mono-tabular">
                                  {player.bio}
                                </p>
                              )}
                              {!player.bio && player.hometown && (
                                <p className="text-xs text-neutral-300 font-mono-tabular">
                                  {player.hometown}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="px-4 py-3 bg-[#0A110D] border-t border-white/10 flex items-center justify-between">
                            <span className="text-[11px] text-neutral-400 font-mono-tabular">
                              {player.roleBadge &&
                              player.roleBadge !== 'None' &&
                              player.roleBadge !== 'Player'
                                ? player.roleBadge
                                : player.yearsOfService || ''}
                            </span>
                            <button
                              type="button"
                              aria-label={`View Roster Profile for ${player.name || 'Player'}`}
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
                )}
              </div>
            )}

            {/* ---------------------------------------------------------------
                ABOUT SUB-TAB 4: FANS (Only renders when Fans tab has rows & non-empty cells)
               --------------------------------------------------------------- */}
            {aboutSubTab === 'fans' && fans.length > 0 && (
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
                      {fan.photoUrl && (
                        <div className="aspect-video bg-[#080E0B] overflow-hidden">
                          <img
                            src={fan.photoUrl}
                            alt={fan.title || 'Fan Photo'}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <div className="p-4 space-y-1.5 bg-[#0A110D] flex-1">
                        {fan.category && (
                          <div className="text-[11px] text-[#EAB308] font-mono-tabular">
                            {fan.category}
                          </div>
                        )}
                        {fan.title && (
                          <h3 className="text-base font-bold text-white font-display uppercase">
                            {fan.title}
                          </h3>
                        )}
                        {fan.relatedPlayer && (
                          <p className="text-xs text-neutral-400 font-mono-tabular">
                            {fan.relatedPlayer}
                          </p>
                        )}
                        {fan.caption && (
                          <p className="text-xs text-neutral-300 leading-relaxed font-mono-tabular">
                            {fan.caption}
                          </p>
                        )}
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
               - Event Listings only rendered when Events tab in Google Sheets has rows
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

            {/* Event Entries (Only rendered when Events tab has rows; only renders non-empty cells) */}
            {events.length > 0 && (
              <div className="max-w-3xl mx-auto space-y-4 pt-4 border-t border-white/10">
                <h2 className="text-xl sm:text-2xl font-bold text-[#EAB308] font-display uppercase tracking-wide text-center">
                  Event Listings
                </h2>
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="bg-[#111915] border border-white/10 rounded-2xl overflow-hidden shadow-lg"
                  >
                    {(ev.imageUrl || ev.title || ev.date || ev.time || ev.location || ev.category) && (
                      <div className="p-5 border-b border-white/10 flex items-center gap-4">
                        {ev.imageUrl && (
                          <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                            <img
                              src={ev.imageUrl}
                              alt={ev.title || 'Event'}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          {ev.category && (
                            <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase">
                              {ev.category}
                            </span>
                          )}
                          {ev.title && (
                            <h3 className="text-base sm:text-lg font-bold text-white font-mono-tabular">
                              {ev.title}
                            </h3>
                          )}
                          {(ev.date || ev.time) && (
                            <p className="text-xs text-neutral-400 font-mono-tabular">
                              {[ev.date, ev.time].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {ev.location && (
                            <p className="text-xs text-[#EAB308] flex items-center gap-1 font-mono-tabular">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{ev.location}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {(ev.description || ev.externalUrl) && (
                      <div className="p-5 space-y-3">
                        {ev.description && (
                          <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed font-mono-tabular">
                            {ev.description}
                          </p>
                        )}
                        {ev.externalUrl && (
                          <a
                            href={ev.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#EAB308] hover:underline"
                          >
                            <span>View Event Link</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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

            {/* BECOME A SPONSOR DIRECT WEBSITE FORM (Connected to Google Sheets via Apps Script) */}
            <section
              aria-labelledby="become-a-sponsor-heading"
              className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6"
            >
              <div className="space-y-1.5 border-b border-white/10 pb-4">
                <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                  501(c)(3) Community Partnership
                </span>
                <h2
                  id="become-a-sponsor-heading"
                  className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase"
                >
                  Become a Sponsor
                </h2>
                <p className="text-xs sm:text-sm text-neutral-300">
                  Submit your sponsor information and logo/flyer below. Once verified by the club,
                  your sponsorship will automatically appear on the Home page.
                </p>
              </div>

              <form onSubmit={handleSponsorSubmit} className="space-y-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="sponsor-name"
                    className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
                  >
                    Name
                  </label>
                  <input
                    id="sponsor-name"
                    type="text"
                    value={sponsorName}
                    onChange={(e) => setSponsorName(e.target.value)}
                    placeholder="Business, organization, or supporter name"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                  />
                </div>

                {/* Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="sponsor-phone"
                      className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
                    >
                      Phone
                    </label>
                    <input
                      id="sponsor-phone"
                      type="tel"
                      value={sponsorPhone}
                      onChange={(e) => setSponsorPhone(e.target.value)}
                      placeholder="(555) 555-5555"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="sponsor-email"
                      className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
                    >
                      Email
                    </label>
                    <input
                      id="sponsor-email"
                      type="email"
                      value={sponsorEmail}
                      onChange={(e) => setSponsorEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Preferred contact (Select all: text, call, email) */}
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                    Preferred contact (Select all that apply)
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    {(['Text', 'Call', 'Email'] as const).map((method) => {
                      const checked = sponsorPreferredContact.includes(method);
                      return (
                        <label
                          key={method}
                          className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors select-none ${
                            checked
                              ? 'bg-[#EAB308]/15 border-[#EAB308] text-[#EAB308]'
                              : 'bg-[#070C09] border-white/15 text-neutral-300 hover:border-white/30'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSponsorContactMethod(method)}
                            className="w-4 h-4 accent-[#EAB308] rounded"
                          />
                          <span className="uppercase tracking-wider">{method}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Website (Regex validated) */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="sponsor-website"
                    className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
                  >
                    Website
                  </label>
                  <input
                    id="sponsor-website"
                    type="text"
                    inputMode="url"
                    value={sponsorWebsite}
                    onChange={(e) => handleSponsorWebsiteChange(e.target.value)}
                    placeholder="https://www.example.com"
                    aria-invalid={Boolean(sponsorWebsiteError)}
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border text-sm text-white focus:outline-none ${
                      sponsorWebsiteError
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-white/15 focus:border-[#EAB308]'
                    }`}
                  />
                  {sponsorWebsiteError && (
                    <p className="text-xs text-red-400 font-mono-tabular">{sponsorWebsiteError}</p>
                  )}
                </div>

                {/* Optional Message (Displayed quoted with <q> on Home page when verified) */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="sponsor-message"
                    className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
                  >
                    Message (Optional)
                  </label>
                  <textarea
                    id="sponsor-message"
                    rows={3}
                    value={sponsorMessage}
                    onChange={(e) => setSponsorMessage(e.target.value)}
                    placeholder="Optional sponsor message or note to display on our Home page..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                  />
                </div>

                {/* Sponsor Logo/flyer image upload */}
                <div className="space-y-2">
                  <label
                    htmlFor="sponsor-logo-upload"
                    className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
                  >
                    Sponsor Logo / Flyer Image Upload
                  </label>
                  <div className="p-4 rounded-xl bg-[#070C09] border border-dashed border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Camera className="w-5 h-5 text-[#EAB308] shrink-0" />
                      <div className="text-xs text-neutral-300">
                        <span className="font-semibold text-white block">
                          {sponsorLogoFileName || 'Choose a logo or flyer image'}
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          PNG, JPG, or WebP
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="sponsor-logo-upload"
                        className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer transition-colors"
                      >
                        Upload Image
                      </label>
                      <input
                        id="sponsor-logo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleSponsorFileChange}
                        className="hidden"
                      />
                      {(sponsorLogoDataUrl || sponsorFirebaseLogoUrl) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSponsorLogoDataUrl('');
                            setSponsorFirebaseLogoUrl('');
                            setSponsorLogoFile(null);
                            setSponsorLogoFileName('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-xs text-red-200 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {sponsorLogoUploading && (
                    <p className="text-xs text-[#EAB308] font-mono-tabular">
                      Uploading image to Firebase Storage...
                    </p>
                  )}

                  {(sponsorLogoDataUrl || sponsorFirebaseLogoUrl) && (
                    <div className="p-3 rounded-xl bg-[#070C09] border border-white/10 inline-flex items-center gap-3">
                      <img
                        src={sponsorLogoDataUrl || sponsorFirebaseLogoUrl}
                        alt="Uploaded Sponsor Logo Preview"
                        className="h-16 w-auto object-contain rounded bg-black/40 p-1.5 border border-white/10"
                      />
                      <span className="text-xs text-neutral-300 font-mono-tabular">
                        {sponsorFirebaseLogoUrl
                          ? 'Uploaded to Firebase Storage & ready for Google Sheets'
                          : 'Image ready for Google Sheets upload'}
                      </span>
                    </div>
                  )}
                </div>

                {sponsorStatus && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-medium border ${
                      sponsorStatus.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/60 border-red-500/40 text-red-200'
                    }`}
                  >
                    {sponsorStatus.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sponsorSubmitting}
                  className="w-full py-3 rounded-xl bg-[#EAB308] hover:bg-[#FACC15] disabled:opacity-50 text-[#070C09] font-extrabold text-sm uppercase tracking-wider transition-colors"
                >
                  {sponsorSubmitting ? 'Submitting Sponsor Info...' : 'Submit Sponsor Application'}
                </button>
              </form>
            </section>
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
