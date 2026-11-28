import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  ExternalLink,
  Search,
  Users,
  Camera,
  Menu,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  PlayerProfile,
  StaffMember,
  FanItem,
  SponsorItem,
  ClubEvent,
  HomeSlide,
  filterPlayers,
  isValidWebsiteUrl,
  normalizeWebsiteUrl,
  splitAndSortEvents,
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
  getCachedSheetSyncResult,
  DynamicSyncResult,
} from './services/googleWorkspace';
import {
  uploadSponsorImageToFirebase,
  extractFirebaseAssetId,
  resolveFirebaseAssetDirect,
  trackPageView,
  trackCustomEvent,
} from './services/firebaseStorage';
import {
  sanitizeFormText,
  containsSpamPatterns,
  isValidEmailAddress,
  isValidPhoneNumber,
  verifyAntiSpamSubmission,
  recordSuccessfulFormSubmission,
} from './utils/formSecurity';
import {
  fetchSupabasePlayers,
  isSupabaseConfigured,
} from './services/supabaseClient';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { BecomeWarriorForm } from './components/BecomeWarriorForm';
import { SponsorsPage } from './components/SponsorsPage';
import { MilitaryBranchCrest } from './components/MilitaryBranchCrest';
import { SheetImage, PlayerPhotoPair, WarriorAvatar } from './components/SheetImage';

type TopSection =
  | 'home'
  | 'about'
  | 'sponsors'
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
  // Instantly hydrates from localStorage cache if available (0ms) and updates live from Google Sheets
  const initialCache = useMemo(() => getCachedSheetSyncResult(), []);
  const lastAppliedSyncSigRef = useRef<string>(
    initialCache ? JSON.stringify(initialCache) : ''
  );
  const [players, setPlayers] = useState<PlayerProfile[]>(() => initialCache?.players || []);
  const [staff, setStaff] = useState<StaffMember[]>(() => initialCache?.staff || []);
  const [fans, setFans] = useState<FanItem[]>(() => initialCache?.fans || []);
  const [sponsors, setSponsors] = useState<SponsorItem[]>(() => initialCache?.sponsors || []);
  const [events, setEvents] = useState<ClubEvent[]>(() => initialCache?.events || []);
  const [pastEvents, setPastEvents] = useState<ClubEvent[]>(() => initialCache?.pastEvents || []);
  const [homeSlides, setHomeSlides] = useState<HomeSlide[]>(() => initialCache?.homeSlides || []);
  const [dynamicTabs, setDynamicTabs] = useState<string[]>(() => initialCache?.detectedTabs || []);
  const [isSheetLoading, setIsSheetLoading] = useState<boolean>(() => !initialCache);

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
  const sponsorFormLoadedAtRef = useRef<number>(Date.now());
  const [sponsorName, setSponsorName] = useState<string>('');
  const [sponsorPhone, setSponsorPhone] = useState<string>('');
  const [sponsorEmail, setSponsorEmail] = useState<string>('');
  const [sponsorPreferredContact, setSponsorPreferredContact] = useState<string[]>([]);
  const [sponsorWebsite, setSponsorWebsite] = useState<string>('');
  const [sponsorWebsiteError, setSponsorWebsiteError] = useState<string>('');
  const [sponsorMessage, setSponsorMessage] = useState<string>('');
  const [sponsorFirebaseLogoUrl, setSponsorFirebaseLogoUrl] = useState<string>('');
  const [sponsorFirebasePreviewUrl, setSponsorFirebasePreviewUrl] = useState<string>('');
  const [sponsorFirebaseAssetId, setSponsorFirebaseAssetId] = useState<string>('');
  const [sponsorLogoFile, setSponsorLogoFile] = useState<File | null>(null);
  const [sponsorLogoFileName, setSponsorLogoFileName] = useState<string>('');
  const [sponsorLogoUploading, setSponsorLogoUploading] = useState<boolean>(false);
  const [sponsorSubmitting, setSponsorSubmitting] = useState<boolean>(false);
  const [sponsorHoneypot, setSponsorHoneypot] = useState<string>('');
  const [sponsorCaptchaToken, setSponsorCaptchaToken] = useState<string>('');
  const [sponsorCaptchaResetCount, setSponsorCaptchaResetCount] = useState<number>(0);
  const [sponsorStatus, setSponsorStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleFirebaseImgError = async (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const imgEl = e.currentTarget;
    if (imgEl.dataset.fbResolved === '1') return;
    const assetId = extractFirebaseAssetId(imgEl.src || '');
    if (!assetId) return;
    imgEl.dataset.fbResolved = '1';
    const directObjUrl = await resolveFirebaseAssetDirect(assetId);
    if (directObjUrl) {
      imgEl.src = directObjUrl;
    }
  };

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
    setSponsorFirebasePreviewUrl('');
    setSponsorFirebaseAssetId('');
    setSponsorStatus(null);
    setSponsorLogoUploading(true);
    try {
      const uploaded = await uploadSponsorImageToFirebase(file, sponsorName, 'sp');
      setSponsorFirebaseLogoUrl(uploaded.url);
      setSponsorFirebasePreviewUrl(uploaded.previewUrl);
      setSponsorFirebaseAssetId(uploaded.assetId);
    } catch (err) {
      setSponsorLogoFile(null);
      setSponsorLogoFileName('');
      setSponsorStatus({
        type: 'error',
        message:
          err instanceof Error
            ? `Could not upload image to Firebase server: ${err.message}`
            : 'Could not upload image to Firebase server. Please try another image.',
      });
    } finally {
      setSponsorLogoUploading(false);
    }
  };

  const handleSponsorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeFormText(sponsorName, 120);
    const cleanPhone = sanitizeFormText(sponsorPhone, 40);
    const cleanEmail = sanitizeFormText(sponsorEmail, 120);
    const cleanWebsite = sanitizeFormText(sponsorWebsite, 200);
    const cleanMessage = sanitizeFormText(sponsorMessage, 1000);

    if (!cleanName) {
      setSponsorStatus({
        type: 'error',
        message: 'Please enter the Sponsor or Organization Name.',
      });
      return;
    }

    if (!cleanEmail && !cleanPhone) {
      setSponsorStatus({
        type: 'error',
        message: 'Please provide at least a valid Email address or Phone number.',
      });
      return;
    }

    if (cleanEmail && !isValidEmailAddress(cleanEmail)) {
      setSponsorStatus({
        type: 'error',
        message: 'Please enter a valid Email address (e.g., name@example.com).',
      });
      return;
    }

    if (cleanPhone && !isValidPhoneNumber(cleanPhone)) {
      setSponsorStatus({
        type: 'error',
        message: 'Please enter a valid Phone number (at least 7 digits).',
      });
      return;
    }

    if (cleanWebsite && !isValidWebsiteUrl(cleanWebsite)) {
      setSponsorWebsiteError('Please enter a valid website URL (e.g., https://example.com or www.example.com).');
      setSponsorStatus({
        type: 'error',
        message: 'Website must be a valid website URL (e.g., https://example.com).',
      });
      return;
    }

    if (containsSpamPatterns(cleanName) || containsSpamPatterns(cleanMessage, true)) {
      setSponsorStatus({
        type: 'error',
        message: 'Spam or invalid links detected in form text fields.',
      });
      return;
    }

    if (sponsorLogoUploading) {
      setSponsorStatus({
        type: 'error',
        message: 'Please wait a moment for your image upload to Firebase server to finish.',
      });
      return;
    }

    const fingerprint = `${cleanName.toLowerCase()}|${cleanEmail.toLowerCase()}|${cleanPhone}`;
    const securityCheck = verifyAntiSpamSubmission({
      formKey: 'sponsor',
      honeypotValue: sponsorHoneypot,
      formLoadedAt: sponsorFormLoadedAtRef.current,
      captchaToken: sponsorCaptchaToken,
      payloadFingerprint: fingerprint,
    });
    if (!securityCheck.ok) {
      setSponsorStatus({
        type: 'error',
        message: securityCheck.error || 'Security check failed.',
      });
      return;
    }

    setSponsorWebsiteError('');
    setSponsorSubmitting(true);
    setSponsorStatus(null);
    const result = await submitSponsorToGoogleSheet({
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      preferredContact: sponsorPreferredContact,
      website: cleanWebsite,
      message: cleanMessage,
      logoUrl: sponsorFirebaseLogoUrl,
      firebaseAssetId: sponsorFirebaseAssetId,
      logoFile: sponsorFirebaseLogoUrl ? null : sponsorLogoFile,
      logoFileName: sponsorLogoFileName,
      captchaToken: sponsorCaptchaToken,
    });
    setSponsorSubmitting(false);

    if (result.ok) {
      recordSuccessfulFormSubmission('sponsor', fingerprint);
      trackCustomEvent('submit_sponsor', {
        has_logo: Boolean(sponsorFirebaseLogoUrl),
        has_website: Boolean(cleanWebsite),
      });
      setSponsorStatus({ type: 'success', message: result.message });
      setSponsorName('');
      setSponsorPhone('');
      setSponsorEmail('');
      setSponsorPreferredContact([]);
      setSponsorWebsite('');
      setSponsorWebsiteError('');
      setSponsorMessage('');
      setSponsorFirebaseLogoUrl('');
      setSponsorFirebasePreviewUrl('');
      setSponsorFirebaseAssetId('');
      setSponsorLogoFile(null);
      setSponsorLogoFileName('');
      setSponsorCaptchaToken('');
      setSponsorCaptchaResetCount((c) => c + 1);
      sponsorFormLoadedAtRef.current = Date.now();
    } else {
      setSponsorStatus({ type: 'error', message: result.message });
    }
  };

  // Track Google Analytics pageviews whenever navigation changes
  useEffect(() => {
    trackPageView(activeSection, activeSection === 'about' ? aboutSubTab : undefined);
  }, [activeSection, aboutSubTab]);

  // Dynamic Auto-Sync from Verified Google Sheet (`1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s`) via Direct gviz + Apps Script
  useEffect(() => {
    let mounted = true;

    const applySheetData = (sheetData: DynamicSyncResult) => {
      if (!mounted) return;
      setIsSheetLoading(false);

      const nextSig = JSON.stringify(sheetData);
      if (nextSig === lastAppliedSyncSigRef.current) {
        return;
      }
      lastAppliedSyncSigRef.current = nextSig;

      setPlayers(sheetData.players);
      setSelectedPlayerProfile((prev) => {
        if (!prev) return null;
        const stillExists = sheetData.players.find(
          (p) => p.name.trim().toLowerCase() === prev.name.trim().toLowerCase()
        );
        return stillExists || null;
      });
      setStaff(sheetData.staff);
      setEvents(sheetData.events);
      setPastEvents(sheetData.pastEvents || []);
      setHomeSlides(sheetData.homeSlides || []);
      setFans(sheetData.fans || []);
      setSponsors(sheetData.sponsors || []);
      setDynamicTabs(sheetData.detectedTabs);
    };

    const runSync = async (forceNoCache = false) => {
      const sheetData = await syncVerifiedGoogleSheet((fastData) => {
        applySheetData(fastData);
      }, forceNoCache);
      if (mounted) {
        if (sheetData) {
          applySheetData(sheetData);
        } else {
          setIsSheetLoading(false);
        }
      }

      if (isSupabaseConfigured()) {
        const remotePlayers = await fetchSupabasePlayers();
        if (mounted && remotePlayers && remotePlayers.length > 0) {
          setPlayers(remotePlayers);
        }
      }
    };

    runSync(false);
    const interval = setInterval(() => runSync(false), 30000);
    const onFocus = () => runSync(true);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') runSync(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const activeHomeSlides = useMemo(
    () => (homeSlides.length > 0 ? homeSlides : HERO_SLIDE_DECK),
    [homeSlides]
  );

  useEffect(() => {
    if (currentSlide >= activeHomeSlides.length) {
      setCurrentSlide(0);
    }
  }, [currentSlide, activeHomeSlides.length]);

  // Slide deck autoplay
  useEffect(() => {
    if (!autoPlaySlides || activeSection !== 'home' || activeHomeSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeHomeSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [autoPlaySlides, activeSection, activeHomeSlides.length]);

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

  const { upcoming: upcomingEvents, past: pastEventsList } = useMemo(
    () => splitAndSortEvents(events, pastEvents),
    [events, pastEvents]
  );

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

  const navigateToSponsorForm = () => {
    setActiveSection('sponsors');
    setAboutDropdownOpen(false);
    setMobileMenuOpen(false);
    setTimeout(() => {
      const el = document.getElementById('become-a-sponsor-form');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 60);
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
        <div className="px-4 py-3 bg-[#09100C] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={TEAM_LOGOS.redNjStickCrest}
              alt="Instagram @njveteranhockey"
              width={24}
              height={24}
              className="w-6 h-6 rounded-full object-contain shrink-0 p-0.5 bg-white"
            />
            <span className="text-xs font-bold text-white font-mono-tabular truncate">
              Live Instagram Feed · {SOCIAL_LINKS.instagramHandle}
            </span>
          </div>
          <a
            href={SOCIAL_LINKS.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#EAB308] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <span>Open Instagram</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="w-full h-[440px] sm:h-[580px] bg-white overflow-y-auto overscroll-contain">
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
        <div className="px-4 py-3 bg-[#09100C] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={TEAM_LOGOS.greenGoldCrest}
              alt="Facebook Garden State Warriors"
              width={24}
              height={24}
              className="w-6 h-6 rounded-full object-contain shrink-0 p-0.5 bg-white border border-[#EAB308]/40"
            />
            <span className="text-xs font-bold text-white font-mono-tabular truncate">
              Facebook · Posts & Events
            </span>
          </div>
          <a
            href={SOCIAL_LINKS.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#EAB308] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <span>Open Facebook</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {showFacebookPluginIframe ? (
          <div className="w-full h-[440px] sm:h-[580px] bg-[#09100C] flex flex-col">
            <iframe
              title="Garden State Warriors Facebook Live Posts & Events"
              src={SOCIAL_LINKS.facebookEmbedUrl}
              className="w-full flex-1 border-0 bg-white"
              loading="lazy"
              allow="encrypted-media"
            />
            <div className="p-2.5 bg-[#09100C] border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
              <span>Note: Facebook requires an active Facebook login in your browser.</span>
              <button
                type="button"
                onClick={() => setShowFacebookPluginIframe(false)}
                className="text-[#EAB308] hover:underline font-semibold whitespace-nowrap shrink-0"
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
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-contain shrink-0 p-1 bg-white border border-white/20"
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
                Veteran Hockey Club, run by veterans. Garden State Warriors Veterans
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
      {/* SLEEK STICKY HEADER (Constrained to max-w-6xl so all single-line nav items fit cleanly) */}
      <header className="sticky top-0 z-40 bg-[#070C09]/95 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Crest & Name */}
          <button
            type="button"
            onClick={() => navigateToSection('home')}
            className="flex items-center gap-2 text-left min-w-0 flex-1 lg:flex-initial group focus:outline-none"
          >
            <img
              src={TEAM_LOGOS.greenGoldCrest}
              alt="Garden State Warriors Crest"
              width={36}
              height={36}
              loading="eager"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-full shrink-0 p-0.5 bg-white border border-[#EAB308]/50 transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-[13px] sm:text-base xl:text-lg font-extrabold tracking-wide sm:tracking-wider text-white font-display uppercase truncate">
              Garden State Warriors
            </span>
          </button>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-4 xl:gap-5 text-xs uppercase tracking-wider font-semibold"
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
              onClick={() => navigateToSection('sponsors')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors uppercase ${
                activeSection === 'sponsors'
                  ? 'border-[#EAB308] text-[#EAB308]'
                  : 'border-transparent text-neutral-300 hover:text-white'
              }`}
            >
              Sponsors
            </button>

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
              className="px-2.5 sm:px-3.5 py-2 rounded-lg bg-[#EAB308] text-[#070C09] font-bold text-[11px] sm:text-xs hover:bg-[#FACC15] transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
            >
              Become a Warrior
            </button>

            <button
              type="button"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-white/[0.06] text-white hover:bg-white/10 shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden bg-[#0B130E] border-b border-white/10 px-4 py-3 space-y-1 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
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
              onClick={() => navigateToSection('sponsors')}
              className="block w-full text-left py-2 px-3 rounded-lg text-sm font-semibold text-white hover:bg-white/5"
            >
              Sponsors
            </button>
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

      {/* SLEEK, BALANCED MAIN CONTENT CONTAINER (max-w-6xl) */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 py-6 sm:py-8 md:py-10">
        {/* ===================================================================
            1. HOME PAGE
           =================================================================== */}
        {activeSection === 'home' && (
          <div className="space-y-8 sm:space-y-12">
            {/* Dual Crest Team Header Banner (Side-by-side crests on mobile, 3-col on md+) */}
            <section className="relative rounded-2xl bg-gradient-to-b from-[#112017] via-[#0C1610] to-[#09100C] border border-white/10 p-5 sm:p-8 shadow-2xl">
              <div className="grid grid-cols-2 md:grid-cols-12 gap-4 sm:gap-6 items-center">
                {/* Left Official Crest */}
                <div className="col-span-1 md:col-span-3 order-1 flex justify-end md:justify-start">
                  <div className="p-1.5 sm:p-2 rounded-full bg-white border-2 border-[#EAB308]/60 shadow-lg shrink-0">
                    <img
                      src={TEAM_LOGOS.greenGoldCrest}
                      alt="Garden State Warriors Primary Logo"
                      width={112}
                      height={112}
                      loading="eager"
                      className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 object-contain shrink-0"
                    />
                  </div>
                </div>

                {/* Right Official Crest (Outlined Variant) */}
                <div className="col-span-1 md:col-span-3 order-2 md:order-3 flex justify-start md:justify-end">
                  <div className="p-1.5 sm:p-2 rounded-full bg-white border-2 border-[#991B1B]/70 shadow-lg shrink-0">
                    <img
                      src={TEAM_LOGOS.redNjStickCrest}
                      alt="Garden State Warriors Outlined Logo"
                      width={112}
                      height={112}
                      loading="eager"
                      className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 object-contain shrink-0"
                    />
                  </div>
                </div>

                {/* Center Team Name & Identity */}
                <div className="col-span-2 md:col-span-6 order-3 md:order-2 text-center space-y-2.5 min-w-0">
                  <div className="text-[11px] font-mono-tabular text-[#EAB308] uppercase tracking-widest">
                    Est. 2026 · 501(c)(3) Public Charity · Federal EIN: 43-2191074
                  </div>
                  <h1
                    className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white font-display uppercase tracking-wider leading-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    Garden State Disabled Veterans Hockey Club Inc.
                  </h1>
                  <p className="text-xs sm:text-sm font-medium text-neutral-200">
                    Operating as <span className="text-[#EAB308] font-semibold">Garden State Warriors Hockey Club</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11px] text-neutral-400 font-mono-tabular">
                    <a
                      href="mailto:matthew@gswarriorshockey.com"
                      className="text-neutral-200 hover:text-[#EAB308] transition-colors break-all"
                    >
                      matthew@gswarriorshockey.com
                    </a>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => navigateToAboutSub('players')}
                      className="px-4 py-2 min-h-[40px] rounded-lg bg-[#EAB308] text-[#070C09] font-bold text-xs hover:bg-[#FACC15] transition-colors"
                    >
                      View Roster
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToSection('donate')}
                      className="px-4 py-2 min-h-[40px] rounded-lg bg-[#881616] text-white font-bold text-xs hover:bg-[#991B1B] transition-colors inline-flex items-center gap-1.5"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span>Donate</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* SLIDE DECK OF TEAM PHOTOS (Auto-synced from Google Sheet "Home Slides" tab) */}
            <section aria-label="Team Photos" className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                    Team Photos ({currentSlide + 1} / {activeHomeSlides.length})
                  </span>
                </div>
                {activeHomeSlides.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Previous team photo slide"
                      onClick={() =>
                        setCurrentSlide(
                          (prev) => (prev - 1 + activeHomeSlides.length) % activeHomeSlides.length
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
                        setCurrentSlide((prev) => (prev + 1) % activeHomeSlides.length)
                      }
                      className="p-1.5 rounded-lg bg-[#0E1712] border border-white/10 text-white hover:border-[#EAB308]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {(() => {
                const slide = activeHomeSlides[currentSlide] || activeHomeSlides[0];
                if (!slide) return null;
                return (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#122218] via-[#0C1610] to-[#140B0C] shadow-xl">
                    {slide.imageUrl ? (
                      <div className="bg-[#070C09]">
                        <SheetImage
                          src={slide.imageUrl}
                          alt={slide.title || slide.caption || 'Garden State Warriors Team Photo'}
                          wrapperClassName="w-full h-[220px] sm:h-[380px] md:h-[440px] flex items-center justify-center overflow-hidden bg-[#060B08]"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                        <Camera className="w-8 h-8 text-[#EAB308] mb-2" />
                      </div>
                    )}

                    {(slide.title || slide.caption || slide.tag || slide.dateLabel || activeHomeSlides.length > 1) && (
                      <div className="p-4 sm:p-5 bg-[#0A110D]/95 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          {(slide.tag || slide.dateLabel) && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-tabular text-neutral-400">
                              {slide.tag && (
                                <span className="text-[#EAB308] font-semibold">{slide.tag}</span>
                              )}
                              {slide.tag && slide.dateLabel && <span aria-hidden="true">·</span>}
                              {slide.dateLabel && <span>{slide.dateLabel}</span>}
                            </div>
                          )}
                          {slide.title && (
                            <h2
                              className="text-lg sm:text-xl font-extrabold text-white font-display uppercase tracking-wide"
                              style={{ textWrap: 'balance' }}
                            >
                              {slide.title}
                            </h2>
                          )}
                          {slide.caption && (
                            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                              {slide.caption}
                            </p>
                          )}
                        </div>

                        {activeHomeSlides.length > 1 && (
                          <div className="flex items-center gap-2 shrink-0 self-center sm:self-auto">
                            {activeHomeSlides.map((s, idx) => (
                              <button
                                key={s.id}
                                type="button"
                                aria-label={`Go to slide ${idx + 1}: ${s.title || 'Team Photo'}`}
                                onClick={() => setCurrentSlide(idx)}
                                className={`h-1.5 rounded-full transition-all ${
                                  idx === currentSlide
                                    ? 'w-7 bg-[#EAB308]'
                                    : 'w-2 bg-white/25 hover:bg-white/50'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>

            {/* UNDERNEATH SLIDE DECK: OFFICIAL MISSION STATEMENT & 501(c)(3) VERIFICATION */}
            <section className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-6">
              <div className="max-w-3xl mx-auto space-y-4">
                <h2
                  className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white font-display uppercase tracking-wide"
                  style={{ textWrap: 'balance' }}
                >
                  Veteran Hockey, run by veterans.
                </h2>
                <p className="text-sm sm:text-base text-[#EAB308] font-semibold leading-relaxed">
                  Garden State Disabled Veterans Hockey Club Inc. (operating as Garden State Warriors Hockey Club) · 501(c)(3) Public Charity · Federal EIN: 43-2191074
                </p>
                <div className="space-y-3 text-left text-sm text-neutral-200 leading-relaxed bg-[#080E0B] border border-white/[0.08] rounded-xl p-5 sm:p-6">
                  <p>
                    The Garden State Disabled Veterans Hockey Club is a veteran/player-led 501(c)(3) nonprofit dedicated to empowering disabled veterans through the sport of hockey. Founded on the principles that this is the players’ team and every voice matters, we foster an environment of respect, accountability, trust, transparency and shared ownership. On the ice we compete. Off the ice we support. Together we continue our mission of service — to each other.
                  </p>
                  <p className="text-neutral-300">
                    The organization was established in 2026 to provide therapeutic recreation, physical rehabilitation, mental wellness support, and community camaraderie to injured, ill, and disabled military veterans residing in New Jersey through the sport of amateur ice hockey. The organization operates to foster national and international amateur sports competition under the guidelines of USA Hockey&apos;s Warrior Hockey discipline, promoting holistic healing, stress management, and peer-to-peer transitional support for veterans dealing with physical injuries, PTSD, and other service-connected challenges.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-neutral-400 font-mono-tabular pt-1">
                  <a
                    href="mailto:matthew@gswarriorshockey.com"
                    className="text-[#EAB308] hover:underline"
                  >
                    matthew@gswarriorshockey.com
                  </a>
                </div>
              </div>

              {/* 6 U.S. Armed Forces Branches */}
              <div className="pt-5 border-t border-white/[0.08]">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  {MILITARY_BRANCHES.map((b) => (
                    <div
                      key={b.id}
                      className="bg-[#080E0B] border border-white/[0.08] rounded-xl p-3 flex flex-col items-center justify-center text-center gap-1.5"
                    >
                      <MilitaryBranchCrest branchId={b.id} className="w-11 h-11" />
                      <span className="text-xs font-bold text-white font-display uppercase tracking-wider">
                        {b.name}
                      </span>
                      <span className="text-[10px] text-neutral-400">{b.motto}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* AT BOTTOM OF HOME PAGE: THANKS SPONSORS AND SUPPORTERS (Also promoted on dedicated Sponsors page) */}
            {isSheetLoading && sponsors.length === 0 && (
              <div
                aria-label="Loading Sponsors"
                className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 flex items-center justify-center gap-2.5 text-neutral-300"
              >
                <Loader2 className="w-5 h-5 text-[#EAB308] animate-spin" />
                <span className="text-xs font-mono-tabular">Loading verified sponsors...</span>
              </div>
            )}
            {sponsors.length > 0 && (
              <section
                aria-label="Sponsors and Supporters"
                className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="space-y-1">
                    <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                      501(c)(3) Partners
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white font-display uppercase">
                      Thanks Sponsors and Supporters
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => navigateToSection('sponsors')}
                      className="px-3.5 py-2 rounded-lg bg-white/[0.08] hover:bg-white/15 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0"
                    >
                      Sponsors Page
                    </button>
                    <button
                      type="button"
                      onClick={navigateToSponsorForm}
                      className="px-3.5 py-2 rounded-lg bg-[#EAB308] hover:bg-[#FACC15] text-[#070C09] text-xs font-extrabold transition-colors whitespace-nowrap shrink-0"
                    >
                      Become a Sponsor
                    </button>
                  </div>
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
                          <SheetImage
                            src={sp.logoUrl}
                            alt={sp.name || 'Sponsor Logo'}
                            wrapperClassName="w-full pt-2"
                            className="h-36 sm:h-44 md:h-48 w-full max-w-md object-contain rounded-xl bg-black/40 p-3 border border-white/10"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Powered by InterServer Backlink at Bottom of Homepage */}
            <div className="pt-4 text-center">
              <a
                href="https://www.interserver.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neutral-400 hover:text-[#EAB308] transition-colors font-mono-tabular underline underline-offset-4"
              >
                Powered by InterServer
              </a>
            </div>
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

              <div className="w-full sm:w-auto flex flex-wrap items-center gap-1.5 bg-[#070C09] p-1 rounded-lg border border-white/10">
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
                    className={`px-3 py-2 min-h-[36px] rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
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
              <div className="bg-[#0D1611] border border-white/10 rounded-2xl p-5 sm:p-10 space-y-6 max-w-3xl mx-auto">
                <div className="flex items-center gap-3">
                  <img
                    src={TEAM_LOGOS.greenGoldCrest}
                    alt="Garden State Warriors Crest"
                    width={48}
                    height={48}
                    className="w-12 h-12 object-contain rounded-full shrink-0 p-1 bg-white border border-[#EAB308]/45"
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

                <div className="p-6 rounded-xl bg-[#070C09] border border-[#EAB308]/40 space-y-4">
                  <p className="text-sm sm:text-base text-neutral-100 leading-relaxed">
                    The Garden State Disabled Veterans Hockey Club is a veteran/player-led 501(c)(3) nonprofit dedicated to empowering disabled veterans through the sport of hockey. Founded on the principles that this is the players’ team and every voice matters, we foster an environment of respect, accountability, trust, transparency and shared ownership. On the ice we compete. Off the ice we support. Together we continue our mission of service — to each other.
                  </p>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    The organization was established in 2026 to provide therapeutic recreation, physical rehabilitation, mental wellness support, and community camaraderie to injured, ill, and disabled military veterans residing in New Jersey through the sport of amateur ice hockey. The organization operates to foster national and international amateur sports competition under the guidelines of USA Hockey&apos;s Warrior Hockey discipline, promoting holistic healing, stress management, and peer-to-peer transitional support for veterans dealing with physical injuries, PTSD, and other service-connected challenges.
                  </p>
                </div>

                <div className="text-xs text-neutral-300 leading-relaxed space-y-1 pt-1">
                  <p className="font-semibold text-[#EAB308]">
                    Garden State Disabled Veterans Hockey Club Inc. (operating as Garden State Warriors Hockey Club)
                  </p>
                  <p className="font-mono-tabular text-neutral-400">
                    501(c)(3) Public Charity · Federal EIN: 43-2191074 ·{' '}
                    <a href="mailto:matthew@gswarriorshockey.com" className="text-[#EAB308] hover:underline">
                      matthew@gswarriorshockey.com
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------
                ABOUT SUB-TAB 2: BOARD AND STAFF (Only renders non-empty sections & cells)
               --------------------------------------------------------------- */}
            {aboutSubTab === 'board-staff' && (
              <div className="space-y-10">
                {isSheetLoading && boardMembers.length === 0 && coaches.length === 0 && (
                  <div
                    aria-label="Loading Board and Staff"
                    className="bg-[#0D1611] border border-white/10 rounded-2xl p-10 flex items-center justify-center gap-3 text-neutral-300"
                  >
                    <Loader2 className="w-6 h-6 text-[#EAB308] animate-spin" />
                    <span className="text-xs font-mono-tabular">Loading Board and Staff...</span>
                  </div>
                )}
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
                            <SheetImage
                              src={member.photoUrl}
                              alt={member.name || member.role || 'Board Member'}
                              wrapperClassName="aspect-square bg-[#080E0B] overflow-hidden"
                              className="w-full h-full object-cover"
                            />
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
                            <SheetImage
                              src={coach.photoUrl}
                              alt={coach.name || coach.role || 'Coach'}
                              wrapperClassName="aspect-square bg-[#080E0B] overflow-hidden"
                              className="w-full h-full object-cover"
                            />
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
                            {(coach.rank || coach.branchOrBackground || coach.serviceEra) && (
                              <p className="text-[11px] text-neutral-400 font-mono-tabular">
                                {[coach.rank, coach.branchOrBackground, coach.serviceEra]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            )}
                            {coach.hometown && (
                              <p className="text-[11px] text-neutral-400 font-mono-tabular">
                                {coach.hometown}
                              </p>
                            )}
                            {coach.caption && (
                              <p className="text-[11px] text-neutral-300 leading-relaxed pt-1 font-mono-tabular">
                                {coach.caption}
                              </p>
                            )}
                            {coach.whatWarriorMeans && (
                              <p className="text-[11px] text-neutral-300 italic leading-relaxed pt-1 font-mono-tabular">
                                <q>{coach.whatWarriorMeans}</q>
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
                {isSheetLoading && players.length === 0 && (
                  <div
                    aria-label="Loading Players"
                    className="bg-[#0D1611] border border-white/10 rounded-2xl p-10 flex items-center justify-center gap-3 text-neutral-300"
                  >
                    <Loader2 className="w-6 h-6 text-[#EAB308] animate-spin" />
                    <span className="text-xs font-mono-tabular">Loading Players & Roster...</span>
                  </div>
                )}
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
                            <PlayerPhotoPair
                              jerseyPhotoUrl={cap.jerseyPhotoUrl}
                              profilePictureUrl={cap.profilePictureUrl}
                              playerName={cap.name}
                              aspectClassName="aspect-square"
                              jerseyAltFallback="Captain Jersey"
                              profileAltFallback="Captain Profile"
                            />

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

                          <div className="px-4 py-3 border-t border-white/10 bg-[#0A110D] flex items-center justify-between gap-2">
                            <span className="text-[11px] text-neutral-400 font-mono-tabular min-w-0 truncate">
                              {[cap.position, cap.rank, cap.tierTab].filter(Boolean).join(' · ')}
                            </span>
                            <button
                              type="button"
                              aria-label={`View Captain Profile for ${cap.name || 'Captain'}`}
                              onClick={() => setSelectedPlayerProfile(cap)}
                              className="px-3 py-1.5 min-h-[36px] rounded-lg bg-white/10 hover:bg-[#EAB308] hover:text-[#070C09] text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0"
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
                              <WarriorAvatar
                                jerseyPhotoUrl={testimonyPlayer.jerseyPhotoUrl}
                                profilePictureUrl={testimonyPlayer.profilePictureUrl}
                                fallbackSrc={TEAM_LOGOS.greenGoldCrest}
                                alt={testimonyPlayer.name || 'Warrior'}
                              />
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
                            <PlayerPhotoPair
                              jerseyPhotoUrl={player.jerseyPhotoUrl}
                              profilePictureUrl={player.profilePictureUrl}
                              playerName={player.name}
                              aspectClassName="aspect-[4/3]"
                              jerseyAltFallback="Warrior Jersey"
                              profileAltFallback="Warrior Profile"
                            />

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

                          <div className="px-4 py-3 bg-[#0A110D] border-t border-white/10 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-neutral-400 font-mono-tabular min-w-0 truncate">
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
                              className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[#EAB308] text-[#070C09] text-xs font-bold hover:bg-[#FACC15] transition-colors whitespace-nowrap shrink-0"
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
                ABOUT SUB-TAB 4: FANS (Shows loading spinner while loading; only renders when Fans tab has rows & non-empty cells)
               --------------------------------------------------------------- */}
            {aboutSubTab === 'fans' && isSheetLoading && fans.length === 0 && (
              <div
                aria-label="Loading Fans"
                className="bg-[#0D1611] border border-white/10 rounded-2xl p-10 flex items-center justify-center gap-3 text-neutral-300"
              >
                <Loader2 className="w-6 h-6 text-[#EAB308] animate-spin" />
                <span className="text-xs font-mono-tabular">Loading Fans...</span>
              </div>
            )}
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
                        <SheetImage
                          src={fan.photoUrl}
                          alt={fan.title || 'Fan Photo'}
                          wrapperClassName="aspect-video bg-[#080E0B] overflow-hidden"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="p-4 space-y-1.5 bg-[#0A110D] flex-1">
                        {(fan.roleLabel || fan.category) && (
                          <div className="text-[11px] text-[#EAB308] font-mono-tabular">
                            {fan.roleLabel || fan.category}
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
            3. EVENTS PAGE
               - Splits sheet events into "Upcoming Events" and "Past Events" (deleted/past, max 3)
               - Media links / social feeds live exclusively on the Media tab
           =================================================================== */}
        {activeSection === 'events' && (
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                Team Schedule & Appearances
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display uppercase tracking-wide">
                Garden State Warriors Events
              </h1>
              <p className="text-xs sm:text-sm text-neutral-300">
                Upcoming games, tournaments, and community appearances, followed by recent past
                events.
              </p>
            </div>

            {isSheetLoading && upcomingEvents.length === 0 && pastEventsList.length === 0 && (
              <div
                aria-label="Loading Event Listings"
                className="bg-[#0D1611] border border-white/10 rounded-2xl p-8 flex items-center justify-center gap-3 text-neutral-300"
              >
                <Loader2 className="w-5 h-5 text-[#EAB308] animate-spin" />
                <span className="text-xs font-mono-tabular">Loading Event Listings...</span>
              </div>
            )}

            {/* 1. UPCOMING EVENTS */}
            <section aria-labelledby="upcoming-events-heading" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider block">
                    On the Calendar
                  </span>
                  <h2
                    id="upcoming-events-heading"
                    className="text-xl sm:text-2xl font-bold text-white font-display uppercase tracking-wide"
                  >
                    Upcoming Events
                  </h2>
                </div>
                {upcomingEvents.length > 0 && (
                  <span className="text-xs text-neutral-400 font-mono-tabular">
                    {upcomingEvents.length}{' '}
                    {upcomingEvents.length === 1 ? 'Upcoming Event' : 'Upcoming Events'}
                  </span>
                )}
              </div>

              {upcomingEvents.length > 0 ? (
                <div className="space-y-4">
                  {upcomingEvents.map((ev) => (
                    <article
                      key={ev.id}
                      className="bg-[#111915] border border-white/10 rounded-2xl overflow-hidden shadow-lg"
                    >
                      {(ev.imageUrl || ev.title || ev.date || ev.time || ev.location || ev.category) && (
                        <div className="p-5 flex items-start sm:items-center gap-4">
                          {ev.imageUrl && (
                            <SheetImage
                              src={ev.imageUrl}
                              alt={ev.title || 'Upcoming Event'}
                              wrapperClassName="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden"
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="space-y-1 min-w-0">
                            {(ev.category || ev.date || ev.time) && (
                              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-tabular">
                                {ev.category && (
                                  <span className="text-[#EAB308] uppercase font-bold">
                                    {ev.category}
                                  </span>
                                )}
                                {ev.category && (ev.date || ev.time) && (
                                  <span className="text-neutral-600" aria-hidden="true">
                                    ·
                                  </span>
                                )}
                                {(ev.date || ev.time) && (
                                  <span className="text-neutral-300">
                                    {[ev.date, ev.time].filter(Boolean).join(' · ')}
                                  </span>
                                )}
                              </div>
                            )}
                            {ev.title && (
                              <h3 className="text-base sm:text-lg font-bold text-white font-display uppercase tracking-wide">
                                {ev.title}
                              </h3>
                            )}
                            {ev.location && (
                              <p className="text-xs text-[#EAB308] flex items-center gap-1 font-mono-tabular">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span>{ev.location}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {(ev.description || ev.externalUrl) && (
                        <div className="px-5 pb-5 pt-3 border-t border-white/10 space-y-3">
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
                              <span>Event Details</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                !isSheetLoading && (
                  <div className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 text-center text-xs sm:text-sm text-neutral-300 font-mono-tabular">
                    No upcoming events are currently scheduled. Check back soon for upcoming games,
                    tournaments, and team appearances.
                  </div>
                )
              )}
            </section>

            {/* 2. PAST EVENTS (Top 3 most recent past or deleted events) */}
            <section aria-labelledby="past-events-heading" className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <span className="text-[11px] text-neutral-400 font-mono-tabular uppercase tracking-wider block">
                    Recent History
                  </span>
                  <h2
                    id="past-events-heading"
                    className="text-xl sm:text-2xl font-bold text-neutral-100 font-display uppercase tracking-wide"
                  >
                    Past Events
                  </h2>
                </div>
                {pastEventsList.length > 0 && (
                  <span className="text-xs text-neutral-400 font-mono-tabular">
                    Showing {pastEventsList.length} most recent
                  </span>
                )}
              </div>

              {pastEventsList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {pastEventsList.map((ev) => (
                    <article
                      key={ev.id}
                      className="bg-[#0C130F] border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        {ev.imageUrl && (
                          <SheetImage
                            src={ev.imageUrl}
                            alt={ev.title || 'Past Event'}
                            wrapperClassName="w-full h-32 rounded-xl bg-black/40 border border-white/10 overflow-hidden mb-1"
                            className="w-full h-full object-cover opacity-90"
                          />
                        )}
                        {(ev.category || ev.date) && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400 font-mono-tabular">
                            {ev.category && (
                              <span className="text-[#EAB308]/90 uppercase font-semibold">
                                {ev.category}
                              </span>
                            )}
                            {ev.category && ev.date && <span aria-hidden="true">·</span>}
                            {ev.date && <span>{ev.date}</span>}
                          </div>
                        )}
                        {ev.title && (
                          <h3 className="text-base font-bold text-white font-display uppercase tracking-wide">
                            {ev.title}
                          </h3>
                        )}
                        {ev.location && (
                          <p className="text-xs text-neutral-300 flex items-center gap-1 font-mono-tabular">
                            <MapPin className="w-3.5 h-3.5 text-[#EAB308]/80 shrink-0" />
                            <span>{ev.location}</span>
                          </p>
                        )}
                        {ev.description && (
                          <p className="text-xs text-neutral-400 leading-relaxed font-mono-tabular line-clamp-3">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                !isSheetLoading && (
                  <div className="bg-[#0C130F] border border-white/[0.08] rounded-2xl p-6 text-center text-xs sm:text-sm text-neutral-400 font-mono-tabular">
                    No past events recorded yet.
                  </div>
                )
              )}
            </section>
          </div>
        )}

        {/* ===================================================================
            4. DONATE PAGE (501(c)(3) Tax-Exempt Support)
           =================================================================== */}
        {activeSection === 'donate' && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="bg-[#0D1611] border border-white/10 rounded-2xl p-5 sm:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <img
                  src={TEAM_LOGOS.greenGoldCrest}
                  alt="Garden State Warriors Crest"
                  width={48}
                  height={48}
                  className="w-12 h-12 object-contain rounded-full shrink-0 p-1 bg-white border border-[#EAB308]/45"
                />
                <div className="min-w-0">
                  <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider block">
                    501(c)(3) Tax-Exempt Public Charity
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase">
                    Support Garden State Warriors
                  </h1>
                </div>
              </div>

              <p className="text-sm text-neutral-300 leading-relaxed">
                Veteran Hockey, run by veterans. Garden State Warriors Veterans Hockey
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

            {/* Sponsorship & Board Fundraising Cross-Promotion */}
            <section
              aria-labelledby="sponsor-promo-heading"
              className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
            >
              <div className="space-y-1.5">
                <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                  Corporate & Community Support
                </span>
                <h2
                  id="sponsor-promo-heading"
                  className="text-xl sm:text-2xl font-extrabold text-white font-display uppercase"
                >
                  Promote Your Business as a Team Sponsor
                </h2>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-xl">
                  View our active sponsors, partnership benefits, and submit your sponsor application
                  on our dedicated Sponsors page.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => navigateToAboutSub('board-staff')}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-colors whitespace-nowrap shrink-0"
                >
                  Board & Staff
                </button>
                <button
                  type="button"
                  onClick={navigateToSponsorForm}
                  className="px-5 py-2.5 rounded-xl bg-[#EAB308] hover:bg-[#FACC15] text-[#070C09] font-extrabold text-xs uppercase tracking-wider transition-colors whitespace-nowrap shrink-0"
                >
                  Go to Sponsors Page
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            SPONSORS & COMMUNITY PARTNERS PAGE
           =================================================================== */}
        {activeSection === 'sponsors' && (
          <SponsorsPage
            sponsors={sponsors}
            isSheetLoading={isSheetLoading}
            onImageError={handleFirebaseImgError}
            onNavigateDonate={() => navigateToSection('donate')}
            onNavigateBoard={() => navigateToAboutSub('board-staff')}
            sponsorName={sponsorName}
            setSponsorName={setSponsorName}
            sponsorPhone={sponsorPhone}
            setSponsorPhone={setSponsorPhone}
            sponsorEmail={sponsorEmail}
            setSponsorEmail={setSponsorEmail}
            sponsorPreferredContact={sponsorPreferredContact}
            toggleSponsorContactMethod={toggleSponsorContactMethod}
            sponsorWebsite={sponsorWebsite}
            handleSponsorWebsiteChange={handleSponsorWebsiteChange}
            sponsorWebsiteError={sponsorWebsiteError}
            sponsorMessage={sponsorMessage}
            setSponsorMessage={setSponsorMessage}
            sponsorHoneypot={sponsorHoneypot}
            setSponsorHoneypot={setSponsorHoneypot}
            sponsorLogoFileName={sponsorLogoFileName}
            sponsorLogoUploading={sponsorLogoUploading}
            sponsorFirebaseLogoUrl={sponsorFirebaseLogoUrl}
            sponsorFirebasePreviewUrl={sponsorFirebasePreviewUrl}
            onSponsorFileChange={handleSponsorFileChange}
            onClearSponsorLogo={() => {
              setSponsorFirebaseLogoUrl('');
              setSponsorFirebasePreviewUrl('');
              setSponsorFirebaseAssetId('');
              setSponsorLogoFile(null);
              setSponsorLogoFileName('');
            }}
            sponsorCaptchaResetCount={sponsorCaptchaResetCount}
            setSponsorCaptchaToken={setSponsorCaptchaToken}
            sponsorStatus={sponsorStatus}
            sponsorSubmitting={sponsorSubmitting}
            onSponsorSubmit={handleSponsorSubmit}
          />
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
            <div className="bg-[#0D1611] border border-white/10 rounded-2xl p-5 sm:p-8 text-center space-y-5">
              <div className="flex justify-center items-center gap-3">
                <img
                  src={TEAM_LOGOS.greenGoldCrest}
                  alt="Garden State Warriors Crest"
                  width={56}
                  height={56}
                  className="w-14 h-14 object-contain rounded-full shrink-0 p-1 bg-white border border-[#EAB308]/45"
                />
                <img
                  src={TEAM_LOGOS.redNjStickCrest}
                  alt="Garden State Warriors Outlined Logo"
                  width={56}
                  height={56}
                  className="w-14 h-14 object-contain rounded-full shrink-0 p-1 bg-white border border-[#991B1B]/50"
                />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] text-[#EAB308] font-mono-tabular uppercase tracking-wider">
                  Official Club Channels
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase">
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

              <div className="p-4 rounded-xl bg-[#080E0B] border border-white/10 text-xs text-neutral-300 space-y-1.5 text-center">
                <p className="font-semibold text-white break-words">
                  Garden State Disabled Veterans Hockey Club Inc. (operating as Garden State Warriors Hockey Club)
                </p>
                <p className="text-neutral-400 font-mono-tabular">
                  501(c)(3) Public Charity · Federal EIN: 43-2191074
                </p>
                <p className="text-neutral-400 font-mono-tabular">
                  <a
                    href="mailto:matthew@gswarriorshockey.com"
                    className="text-[#EAB308] hover:underline break-all"
                  >
                    matthew@gswarriorshockey.com
                  </a>
                </p>
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
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="flex items-center gap-2 shrink-0 pt-0.5 sm:pt-0">
              <img
                src={TEAM_LOGOS.greenGoldCrest}
                alt="Garden State Warriors Primary Logo"
                width={44}
                height={44}
                className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-full shrink-0 p-1 bg-white border border-[#EAB308]/45"
              />
              <img
                src={TEAM_LOGOS.redNjStickCrest}
                alt="Garden State Warriors Outlined Logo"
                width={44}
                height={44}
                className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-full shrink-0 p-1 bg-white border border-[#991B1B]/50"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <span className="text-sm font-bold text-white font-display uppercase block leading-snug break-words">
                Garden State Disabled Veterans Hockey Club Inc.{' '}
                <span className="text-neutral-300 font-sans font-normal normal-case text-xs">
                  (operating as Garden State Warriors Hockey Club)
                </span>
              </span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-300 font-mono-tabular">
                <span>501(c)(3) Public Charity</span>
                <span aria-hidden="true">·</span>
                <span>Federal EIN: 43-2191074</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-400 font-mono-tabular">
                <a
                  href="mailto:matthew@gswarriorshockey.com"
                  className="text-[#EAB308] hover:underline break-all"
                >
                  matthew@gswarriorshockey.com
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-300">
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
            <span aria-hidden="true">·</span>
            <a
              href="https://www.interserver.net"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#EAB308] transition-colors"
            >
              Powered by InterServer
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
