import React from 'react';
import {
  Award,
  Camera,
  ExternalLink,
  Heart,
  Loader2,
  Shield,
  ArrowDown,
} from 'lucide-react';
import { SponsorItem, normalizeWebsiteUrl } from '../utils/rosterLogic';
import { TEAM_LOGOS } from '../data/seedData';
import { RecaptchaWidget } from './RecaptchaWidget';
import { SheetImage } from './SheetImage';

interface SponsorsPageProps {
  sponsors: SponsorItem[];
  isSheetLoading: boolean;
  onImageError: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onNavigateDonate: () => void;
  onNavigateBoard: () => void;

  // Controlled Become a Sponsor form props
  sponsorName: string;
  setSponsorName: (val: string) => void;
  sponsorPhone: string;
  setSponsorPhone: (val: string) => void;
  sponsorEmail: string;
  setSponsorEmail: (val: string) => void;
  sponsorPreferredContact: string[];
  toggleSponsorContactMethod: (method: string) => void;
  sponsorWebsite: string;
  handleSponsorWebsiteChange: (val: string) => void;
  sponsorWebsiteError: string;
  sponsorMessage: string;
  setSponsorMessage: (val: string) => void;
  sponsorHoneypot: string;
  setSponsorHoneypot: (val: string) => void;
  sponsorLogoFileName: string;
  sponsorLogoUploading: boolean;
  sponsorFirebaseLogoUrl: string;
  sponsorFirebasePreviewUrl: string;
  onSponsorFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearSponsorLogo: () => void;
  sponsorCaptchaResetCount: number;
  setSponsorCaptchaToken: (token: string) => void;
  sponsorStatus: { type: 'success' | 'error'; message: string } | null;
  sponsorSubmitting: boolean;
  onSponsorSubmit: (e: React.FormEvent) => void;
}

export const SponsorsPage: React.FC<SponsorsPageProps> = ({
  sponsors,
  isSheetLoading,
  onImageError,
  onNavigateDonate,
  onNavigateBoard,
  sponsorName,
  setSponsorName,
  sponsorPhone,
  setSponsorPhone,
  sponsorEmail,
  setSponsorEmail,
  sponsorPreferredContact,
  toggleSponsorContactMethod,
  sponsorWebsite,
  handleSponsorWebsiteChange,
  sponsorWebsiteError,
  sponsorMessage,
  setSponsorMessage,
  sponsorHoneypot,
  setSponsorHoneypot,
  sponsorLogoFileName,
  sponsorLogoUploading,
  sponsorFirebaseLogoUrl,
  sponsorFirebasePreviewUrl,
  onSponsorFileChange,
  onClearSponsorLogo,
  sponsorCaptchaResetCount,
  setSponsorCaptchaToken,
  sponsorStatus,
  sponsorSubmitting,
  onSponsorSubmit,
}) => {
  const scrollToForm = () => {
    const el = document.getElementById('become-a-sponsor-form');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-10">
      {/* Sponsors Promotion Hero */}
      <section className="rounded-2xl bg-gradient-to-b from-[#112017] via-[#0C1610] to-[#09100C] border border-white/10 p-6 sm:p-10 shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center gap-2 text-xs text-[#EAB308] font-mono-tabular uppercase tracking-wider">
              <span>501(c)(3) Community Partnerships</span>
              <span aria-hidden="true">·</span>
              <span>Team & Veteran Support</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-display uppercase tracking-wide [text-wrap:balance]">
              Sponsors and Supporters
            </h1>

            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-2xl">
              Our sponsors make Garden State Warriors hockey possible. Sponsorships directly fund
              ice time, game jerseys, protective equipment, tournament travel, and community events
              for veterans across New Jersey.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={scrollToForm}
                className="px-5 py-2.5 rounded-xl bg-[#EAB308] hover:bg-[#FACC15] text-[#070C09] font-extrabold text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <span>Become a Sponsor</span>
                <ArrowDown className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onNavigateDonate}
                className="px-5 py-2.5 rounded-xl bg-[#881616] hover:bg-[#991B1B] text-white font-bold text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Heart className="w-4 h-4" />
                <span>Make a Donation</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 bg-[#080E0B] border border-white/[0.08] rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={TEAM_LOGOS.greenGoldCrest}
                alt="Garden State Warriors Crest"
                className="w-11 h-11 rounded-full object-contain shrink-0"
                referrerPolicy="no-referrer"
              />
              <div>
                <span className="text-xs font-bold text-[#EAB308] font-display uppercase block">
                  Tax-Deductible Support
                </span>
                <span className="text-xs text-neutral-300">
                  501(c)(3) Public Charity
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Verified sponsors are showcased on both our dedicated Sponsors page and the Home page
              with your logo, message, and website link.
            </p>
          </div>
        </div>
      </section>

      {/* Why Partner With Garden State Warriors */}
      <section className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <span className="text-xs text-[#EAB308] font-mono-tabular uppercase tracking-wider">
              Partner Impact & Recognition
            </span>
            <h2 className="text-2xl font-extrabold text-white font-display uppercase tracking-wide">
              Why Sponsor the Warriors
            </h2>
          </div>

          <button
            type="button"
            onClick={onNavigateBoard}
            className="px-4 py-2 rounded-lg bg-white/[0.08] hover:bg-white/15 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Meet Board & Staff
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#080E0B] border border-white/[0.08] rounded-xl p-5 space-y-2">
            <span className="text-xs font-bold text-[#EAB308] font-mono-tabular">
              01. Direct Veteran Support
            </span>
            <h3 className="text-base font-bold text-white font-display uppercase">
              Zero Cost to Players
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Sponsorship contributions directly reduce out-of-pocket costs so NJ veterans
              can focus on recovery, team bonding, and hockey.
            </p>
          </div>

          <div className="bg-[#080E0B] border border-white/[0.08] rounded-xl p-5 space-y-2">
            <span className="text-xs font-bold text-[#EAB308] font-mono-tabular">
              02. Website Recognition
            </span>
            <h3 className="text-base font-bold text-white font-display uppercase">
              Home & Sponsors Pages
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Every verified sponsor receives placement with your business logo, link, and personal
              message of support on both this Sponsors page and our Home page.
            </p>
          </div>

          <div className="bg-[#080E0B] border border-white/[0.08] rounded-xl p-5 space-y-2">
            <span className="text-xs font-bold text-[#EAB308] font-mono-tabular">
              03. 501(c)(3) Charity
            </span>
            <h3 className="text-base font-bold text-white font-display uppercase">
              Veteran-Run Organization
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Garden State Disabled Veterans Hockey Club Inc. (operating as Garden State Warriors
              Hockey Club) is a registered 501(c)(3) nonprofit (Federal EIN: 43-2191074) run by
              veterans for veterans.
            </p>
          </div>
        </div>
      </section>

      {/* Become a Sponsor Direct Website Form */}
      <section
        id="become-a-sponsor-form"
        aria-labelledby="become-a-sponsor-heading"
        className="max-w-3xl mx-auto bg-[#0D1611] border border-[#EAB308]/35 rounded-2xl p-6 sm:p-8 space-y-6"
      >
        <div className="space-y-1.5 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-xs text-[#EAB308] font-mono-tabular uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" />
            <span>501(c)(3) Community Partnership</span>
          </div>
          <h2
            id="become-a-sponsor-heading"
            className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase"
          >
            Become a Sponsor
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300">
            Submit your sponsor information and logo/flyer below. Once verified by the club, your
            sponsorship will automatically appear on our Sponsors page and Home page.
          </p>
        </div>

        <form onSubmit={onSponsorSubmit} className="space-y-5" noValidate>
          {/* Hidden anti-bot honeypot field */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="sponsor-hp-field">Leave this field blank</label>
            <input
              id="sponsor-hp-field"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={sponsorHoneypot}
              onChange={(e) => setSponsorHoneypot(e.target.value)}
            />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="sponsor-name"
              className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
            >
              Name <span className="text-[#EF4444]">*</span>
            </label>
            <input
              id="sponsor-name"
              type="text"
              required
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

          {/* Optional Message */}
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
              placeholder="Optional sponsor message"
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
                    Supports any image format · Permanently hosted on Firebase server
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
                  onChange={onSponsorFileChange}
                  className="hidden"
                />
                {sponsorFirebaseLogoUrl && (
                  <button
                    type="button"
                    onClick={onClearSponsorLogo}
                    className="px-2.5 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-xs text-red-200 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {sponsorLogoUploading && (
              <div className="flex items-center gap-2 text-xs text-[#EAB308] font-mono-tabular">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading image permanently to Firebase server...</span>
              </div>
            )}

            {sponsorFirebaseLogoUrl && (
              <div className="p-3 rounded-xl bg-[#070C09] border border-white/10 flex flex-col sm:flex-row sm:items-center gap-3">
                <img
                  src={sponsorFirebasePreviewUrl || sponsorFirebaseLogoUrl}
                  alt="Uploaded Sponsor Logo Preview"
                  onError={onImageError}
                  className="h-28 sm:h-32 w-auto max-w-xs object-contain rounded-lg bg-black/40 p-2 border border-white/10 self-start"
                />
                <div className="space-y-1 min-w-0">
                  <span className="text-xs text-emerald-400 font-bold font-mono-tabular block">
                    Uploaded permanently to Firebase server
                  </span>
                  <a
                    href={sponsorFirebaseLogoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#EAB308] hover:underline font-mono-tabular break-all block"
                  >
                    {sponsorFirebaseLogoUrl}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Google reCAPTCHA API Verification */}
          <div className="p-4 rounded-xl bg-[#070C09] border border-white/10 space-y-2">
            <span className="block text-xs font-semibold text-neutral-200">
              Security Verification <span className="text-[#EF4444]">*</span>
            </span>
            <RecaptchaWidget
              onVerify={(token) => setSponsorCaptchaToken(token)}
              resetSignal={sponsorCaptchaResetCount}
            />
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
            disabled={sponsorSubmitting || sponsorLogoUploading}
            className="w-full py-3 rounded-xl bg-[#EAB308] hover:bg-[#FACC15] disabled:opacity-50 text-[#070C09] font-extrabold text-sm uppercase tracking-wider transition-colors"
          >
            {sponsorSubmitting ? 'Submitting Sponsor Info...' : 'Submit Sponsor Application'}
          </button>
        </form>
      </section>

      {/* Active Verified Sponsors Directory (At Bottom of Sponsors Page) */}
      <section aria-labelledby="verified-sponsors-heading" className="space-y-6 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <span className="text-xs text-[#EAB308] font-mono-tabular uppercase tracking-wider">
              Our Community Partners
            </span>
            <h2
              id="verified-sponsors-heading"
              className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase tracking-wide"
            >
              Thanks to Our Sponsors and Supporters
            </h2>
          </div>
          {sponsors.length > 0 && (
            <span className="text-xs text-neutral-400 font-mono-tabular">
              {sponsors.length} {sponsors.length === 1 ? 'Verified Partner' : 'Verified Partners'}
            </span>
          )}
        </div>

        {isSheetLoading && sponsors.length === 0 && (
          <div
            aria-label="Loading Sponsors"
            className="bg-[#0D1611] border border-white/10 rounded-2xl p-10 flex items-center justify-center gap-3 text-neutral-300"
          >
            <Loader2 className="w-6 h-6 text-[#EAB308] animate-spin" />
            <span className="text-xs font-mono-tabular">Loading verified sponsors...</span>
          </div>
        )}

        {!isSheetLoading && sponsors.length === 0 && (
          <div className="bg-[#0D1611] border border-white/10 rounded-2xl p-8 text-center space-y-3">
            <Award className="w-8 h-8 text-[#EAB308] mx-auto" />
            <h3 className="text-lg font-bold text-white font-display uppercase">
              Be Among Our Featured Team Sponsors
            </h3>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-lg mx-auto leading-relaxed">
              Verified businesses, organizations, and community supporters appear here and on our
              Home page. Submit the form above to partner with the Garden State Warriors.
            </p>
          </div>
        )}

        {sponsors.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {sponsors.map((sp) => {
              const sponsorMsg = (sp.message || sp.description || '').trim();
              const hasTextInfo = Boolean(sp.tier || sp.name || sponsorMsg || sp.website);
              return (
                <article
                  key={sp.id}
                  className="bg-[#0D1611] border border-white/10 rounded-2xl p-6 flex flex-col justify-between gap-4"
                >
                  {hasTextInfo && (
                    <div className="space-y-2">
                      {sp.tier && (
                        <span className="text-xs font-mono-tabular text-[#EAB308] font-bold uppercase tracking-wider block">
                          {sp.tier}
                        </span>
                      )}
                      {sp.name && (
                        <h3 className="text-xl font-bold text-white font-display uppercase">
                          {sp.name}
                        </h3>
                      )}
                      {sponsorMsg && (
                        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-mono-tabular italic">
                          <q>{sponsorMsg}</q>
                        </p>
                      )}
                      {sp.website && (
                        <a
                          href={normalizeWebsiteUrl(sp.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EAB308] hover:underline pt-1"
                        >
                          <span>Visit Website</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )}

                  {sp.logoUrl && (
                    <SheetImage
                      src={sp.logoUrl}
                      alt={sp.name || 'Sponsor Logo'}
                      wrapperClassName="w-full pt-2 border-t border-white/[0.06]"
                      className="h-40 sm:h-48 w-full object-contain rounded-xl bg-black/40 p-3 border border-white/10"
                    />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
