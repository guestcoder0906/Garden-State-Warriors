import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Camera,
  Loader2,
  Trash2,
} from 'lucide-react';
import { formatReplaceTag } from '../utils/rosterLogic';
import { TEAM_LOGOS, MILITARY_BRANCHES } from '../data/seedData';
import {
  uploadSponsorImageToFirebase,
  uploadMultipleImagesToFirebase,
  extractFirebaseAssetId,
  resolveFirebaseAssetDirect,
  trackCustomEvent,
} from '../services/firebaseStorage';
import { submitWarriorToGoogleSheet } from '../services/googleWorkspace';
import {
  sanitizeFormText,
  validateWarriorApplicationInput,
  verifyAntiSpamSubmission,
  recordSuccessfulFormSubmission,
} from '../utils/formSecurity';
import { RecaptchaWidget } from './RecaptchaWidget';

interface UploadedMediaAsset {
  url: string;
  previewUrl: string;
  assetId: string;
  fileName: string;
}

export const BecomeWarriorForm: React.FC<{ onSubmitted?: () => void }> = ({ onSubmitted }) => {
  const formLoadedAtRef = useRef<number>(Date.now());

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [militaryBranch, setMilitaryBranch] = useState('');
  const [militaryRank, setMilitaryRank] = useState('');
  const [serviceEra, setServiceEra] = useState('');
  const [hometown, setHometown] = useState('');
  const [roleBadge, setRoleBadge] = useState('Player');
  const [bio, setBio] = useState('');
  const [whatWarriorMeans, setWhatWarriorMeans] = useState('');

  // Military service photo (single image uploaded permanently to Firebase server)
  const [militaryPhotoAsset, setMilitaryPhotoAsset] = useState<UploadedMediaAsset | null>(null);
  const [militaryPhotoUploading, setMilitaryPhotoUploading] = useState(false);

  // Action & gallery photos (up to 5 images of any image format uploaded permanently to Firebase server)
  const [mediaAssets, setMediaAssets] = useState<UploadedMediaAsset[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);

  // Anti-spam security & Google reCAPTCHA API state
  const [honeypot, setHoneypot] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetCount, setCaptchaResetCount] = useState(0);

  // Submission status
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

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

  const handleMilitaryPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    setMilitaryPhotoUploading(true);
    try {
      const ownerLabel = `${firstName} ${lastName}`.trim() || 'Warrior Applicant';
      const uploaded = await uploadSponsorImageToFirebase(file, ownerLabel, 'war_mil');
      setMilitaryPhotoAsset({
        url: uploaded.url,
        previewUrl: uploaded.previewUrl,
        assetId: uploaded.assetId,
        fileName: file.name,
      });
    } catch (err) {
      setStatus({
        type: 'error',
        message:
          err instanceof Error
            ? `Could not upload Military Photo: ${err.message}`
            : 'Could not upload Military Photo. Please try another image.',
      });
    } finally {
      setMilitaryPhotoUploading(false);
      e.target.value = '';
    }
  };

  const handleMediaFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setStatus(null);

    const remainingSlots = 5 - mediaAssets.length;
    if (remainingSlots <= 0) {
      setStatus({
        type: 'error',
        message: 'Maximum of 5 gallery photos reached. Remove an image to upload another.',
      });
      e.target.value = '';
      return;
    }

    const selectedFiles = Array.from(fileList).slice(0, remainingSlots);
    if (fileList.length > remainingSlots) {
      setStatus({
        type: 'error',
        message: `Only ${remainingSlots} more image(s) allowed (maximum 5 images total). Uploading the first ${selectedFiles.length}.`,
      });
    }

    setMediaUploading(true);
    try {
      const ownerLabel = `${firstName} ${lastName}`.trim() || 'Warrior Applicant';
      const uploadedBatch = await uploadMultipleImagesToFirebase(selectedFiles, ownerLabel);
      const newItems: UploadedMediaAsset[] = uploadedBatch.urls.map((url, idx) => ({
        url,
        previewUrl: uploadedBatch.previewUrls[idx],
        assetId: uploadedBatch.assetIds[idx],
        fileName: selectedFiles[idx]?.name || `photo-${idx + 1}.jpg`,
      }));
      setMediaAssets((prev) => [...prev, ...newItems].slice(0, 5));
    } catch (err) {
      setStatus({
        type: 'error',
        message:
          err instanceof Error
            ? `Could not upload photo(s): ${err.message}`
            : 'Could not upload photo(s). Please try again.',
      });
    } finally {
      setMediaUploading(false);
      e.target.value = '';
    }
  };

  const removeMediaAssetAt = (index: number) => {
    setMediaAssets((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleWarriorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (militaryPhotoUploading || mediaUploading) {
      setStatus({
        type: 'error',
        message: 'Please wait a moment for your image upload(s) to finish.',
      });
      return;
    }

    // 1. Validate required fields & non-empty content
    const validation = validateWarriorApplicationInput({
      firstName,
      lastName,
      militaryBranch,
      militaryRank,
      serviceEra,
      hometown,
      roleBadge,
      bio,
      whatWarriorMeans,
      mediaCount: mediaAssets.length,
    });
    if (!validation.ok) {
      setStatus({
        type: 'error',
        message: validation.error || 'Please complete the required fields.',
      });
      return;
    }

    // 2. Verify anti-spam security checks (honeypot, fill-time, Google reCAPTCHA API token, rate limit)
    const fingerprint = `${firstName.trim().toLowerCase()}|${lastName
      .trim()
      .toLowerCase()}|${militaryBranch.trim().toLowerCase()}`;
    const securityCheck = verifyAntiSpamSubmission({
      formKey: 'warrior',
      honeypotValue: honeypot,
      formLoadedAt: formLoadedAtRef.current,
      captchaToken,
      payloadFingerprint: fingerprint,
    });
    if (!securityCheck.ok) {
      setStatus({
        type: 'error',
        message: securityCheck.error || 'Security verification failed.',
      });
      return;
    }

    setSubmitting(true);
    const result = await submitWarriorToGoogleSheet({
      firstName: sanitizeFormText(firstName, 80),
      lastName: sanitizeFormText(lastName, 80),
      militaryBranch: sanitizeFormText(militaryBranch, 80),
      militaryRank: sanitizeFormText(militaryRank, 80),
      serviceEra: sanitizeFormText(serviceEra, 80),
      hometown: sanitizeFormText(hometown, 120),
      roleBadge: sanitizeFormText(roleBadge, 80),
      militaryPhotoUrl: militaryPhotoAsset?.url || '',
      bio: sanitizeFormText(bio, 1500),
      whatWarriorMeans: sanitizeFormText(whatWarriorMeans, 1500),
      mediaUrls: mediaAssets.slice(0, 5).map((m) => m.url),
      honeypot,
      captchaToken,
    });
    setSubmitting(false);

    if (result.ok) {
      recordSuccessfulFormSubmission('warrior', fingerprint);
      trackCustomEvent('submit_become_warrior', {
        branch: militaryBranch,
        media_count: mediaAssets.length,
      });
      setStatus({ type: 'success', message: result.message });
      setFirstName('');
      setLastName('');
      setMilitaryBranch('');
      setMilitaryRank('');
      setServiceEra('');
      setHometown('');
      setRoleBadge('Player');
      setBio('');
      setWhatWarriorMeans('');
      setMilitaryPhotoAsset(null);
      setMediaAssets([]);
      setCaptchaToken('');
      setCaptchaResetCount((c) => c + 1);
      formLoadedAtRef.current = Date.now();
      if (onSubmitted) onSubmitted();
    } else {
      setStatus({ type: 'error', message: result.message });
    }
  };

  return (
    <div className="space-y-8">
      {/* Verified Eligibility & Onboarding */}
      <div className="bg-[#0F1913] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="space-y-1.5">
            <span className="text-xs font-mono-tabular text-[#EAB308]">
              USA Hockey Warrior Discipline · Verified Veteran Roster
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white font-display uppercase tracking-wide">
              Joining the Garden State Warriors
            </h1>
            <p className="text-sm text-neutral-300 max-w-2xl leading-relaxed">
              Becoming a Warrior is a unique privilege for our fellow veterans to be part of
              something special after serving our nation. Our roster is strictly for verified
              disabled U.S. military veterans and club leadership.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-[#09100C] border border-white/10 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-bold text-white uppercase font-display tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#EAB308]" />
              Military Service Requirements
            </h2>
            <ul className="text-xs md:text-sm text-neutral-300 space-y-2 list-disc list-inside leading-relaxed">
              <li>
                A veteran of any U.S. military service — Active Duty, Reserves, or National Guard.
              </li>
              <li>A discharge under honorable conditions.</li>
              <li>
                Not currently on Active Duty (may inquire if separation is within 3 months).
              </li>
            </ul>
          </div>

          <div className="bg-[#09100C] border border-white/10 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-bold text-white uppercase font-display tracking-wide flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#EF4444]" />
              And One of the Following
            </h2>
            <ul className="text-xs md:text-sm text-neutral-300 space-y-2 list-disc list-inside leading-relaxed">
              <li>10% or greater service-connected disability rating from the VA.</li>
              <li>Purple Heart recipient.</li>
            </ul>
            <a
              href="https://www.usahockey.com/warriorhockey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#EAB308] hover:underline pt-1 font-medium"
            >
              <span>Official USA Hockey Warrior Eligibility Rules</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-[#EAB308]/30 text-xs text-amber-200/90 font-mono-tabular">
          {formatReplaceTag(
            'locker room jersey lineup photo (like the Flyers Warriors #26, #24, #34, #76 reference)',
            'image'
          )}
        </div>

        {/* Direct Website Player Application Form */}
        <div className="bg-[#0A120E] border border-[#EAB308]/40 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-white/10 pb-4 space-y-1">
            <span className="text-xs text-[#EAB308] font-mono-tabular">
              Official Player Registration
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase tracking-wide">
              Become a Warrior Player Application
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Submit your veteran player profile below. Once club leadership reviews and verifies
              your application, your profile will automatically appear on the active Players Roster.
            </p>
          </div>

          <form onSubmit={handleWarriorSubmit} className="space-y-5" noValidate>
            {/* Hidden anti-bot honeypot field */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="warrior-hp-field">Leave this field blank</label>
              <input
                id="warrior-hp-field"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            {/* Row 1: First Name & Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="warrior-first-name"
                  className="block text-xs font-semibold text-neutral-200"
                >
                  First Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="warrior-first-name"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="warrior-last-name"
                  className="block text-xs font-semibold text-neutral-200"
                >
                  Last Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="warrior-last-name"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                />
              </div>
            </div>

            {/* Row 2: Military Branch, Military Rank, Service Era */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="warrior-branch"
                  className="block text-xs font-semibold text-neutral-200"
                >
                  Military Branch <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  id="warrior-branch"
                  required
                  value={militaryBranch}
                  onChange={(e) => setMilitaryBranch(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                >
                  <option value="">Select Branch...</option>
                  {MILITARY_BRANCHES.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="warrior-rank"
                  className="block text-xs font-semibold text-neutral-200"
                >
                  Military Rank
                </label>
                <input
                  id="warrior-rank"
                  type="text"
                  value={militaryRank}
                  onChange={(e) => setMilitaryRank(e.target.value)}
                  placeholder="e.g. SGT, CPT, PO1, CPL"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="warrior-service-era"
                  className="block text-xs font-semibold text-neutral-200"
                >
                  Service Era
                </label>
                <input
                  id="warrior-service-era"
                  type="text"
                  value={serviceEra}
                  onChange={(e) => setServiceEra(e.target.value)}
                  placeholder="e.g. 2012-2020"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                />
              </div>
            </div>

            {/* Row 3: Hometown & Role Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="warrior-hometown"
                  className="block text-xs font-semibold text-neutral-200"
                >
                  Hometown
                </label>
                <input
                  id="warrior-hometown"
                  type="text"
                  value={hometown}
                  onChange={(e) => setHometown(e.target.value)}
                  placeholder="e.g. Morristown, NJ"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="warrior-role-badge"
                  className="block text-xs font-semibold text-neutral-200"
                >
                  Role Badge
                </label>
                <input
                  id="warrior-role-badge"
                  type="text"
                  value={roleBadge}
                  onChange={(e) => setRoleBadge(e.target.value)}
                  placeholder="Player"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                />
              </div>
            </div>

            {/* Row 4: Bio & What the Warriors Means to You */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="warrior-bio"
                  className="block text-xs font-semibold text-neutral-200"
                >
                  Bio
                </label>
                <textarea
                  id="warrior-bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share your military service background and hockey story..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="warrior-means"
                  className="block text-xs font-semibold text-neutral-200"
                >
                  What the Warriors Means to You
                </label>
                <textarea
                  id="warrior-means"
                  rows={3}
                  value={whatWarriorMeans}
                  onChange={(e) => setWhatWarriorMeans(e.target.value)}
                  placeholder="What being part of the Garden State Warriors means to you..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                />
              </div>
            </div>

            {/* Row 5: Military Service Photo Upload */}
            <div className="space-y-2">
              <label
                htmlFor="warrior-military-photo"
                className="block text-xs font-semibold text-neutral-200"
              >
                Military Service Photo
              </label>
              <div className="p-4 rounded-xl bg-[#070C09] border border-dashed border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Camera className="w-5 h-5 text-[#EAB308] shrink-0" />
                  <div className="text-xs text-neutral-300">
                    <span className="font-semibold text-white block">
                      {militaryPhotoAsset?.fileName || 'Upload your Military Service Photo (Optional)'}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      Supports any image format
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label
                    htmlFor="warrior-military-photo"
                    className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  >
                    Choose Military Photo
                  </label>
                  <input
                    id="warrior-military-photo"
                    type="file"
                    accept="image/*"
                    onChange={handleMilitaryPhotoChange}
                    className="hidden"
                  />
                  {militaryPhotoAsset && (
                    <button
                      type="button"
                      onClick={() => setMilitaryPhotoAsset(null)}
                      className="px-2.5 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-xs text-red-200 transition-colors whitespace-nowrap shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {militaryPhotoUploading && (
                <div className="flex items-center gap-2 text-xs text-[#EAB308] font-mono-tabular">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading Military Service Photo...</span>
                </div>
              )}

              {militaryPhotoAsset && (
                <div className="p-3 rounded-xl bg-[#070C09] border border-white/10 flex flex-col sm:flex-row sm:items-center gap-3">
                  <img
                    src={militaryPhotoAsset.previewUrl || militaryPhotoAsset.url}
                    alt="Military Service Preview"
                    onError={handleFirebaseImgError}
                    className="h-24 w-auto object-contain rounded bg-black/40 p-1.5 border border-white/10 self-start"
                    referrerPolicy="no-referrer"
                  />
                  <div className="space-y-1 min-w-0">
                    <span className="text-xs text-emerald-400 font-bold font-mono-tabular block">
                      Military Service Photo uploaded and ready
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono-tabular truncate block">
                      {militaryPhotoAsset.fileName}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Row 6: Action & Gallery Photos Multi-Image Upload (Max 5 images, any image format) */}
            <div className="space-y-2">
              <label
                htmlFor="warrior-media-upload"
                className="block text-xs font-semibold text-neutral-200"
              >
                Action & Gallery Photos (Up to 5 Images)
              </label>
              <div className="p-4 rounded-xl bg-[#070C09] border border-dashed border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Camera className="w-5 h-5 text-[#EAB308] shrink-0" />
                  <div className="text-xs text-neutral-300">
                    <span className="font-semibold text-white block">
                      {mediaAssets.length > 0
                        ? `${mediaAssets.length} / 5 photo(s) uploaded`
                        : 'Select up to 5 photos (any image format)'}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      Upload hockey action, service, or team photos (maximum 5 images)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {mediaAssets.length < 5 && (
                    <label
                      htmlFor="warrior-media-upload"
                      className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    >
                      Add Images ({5 - mediaAssets.length} left)
                    </label>
                  )}
                  <input
                    id="warrior-media-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleMediaFilesChange}
                    className="hidden"
                  />
                  {mediaAssets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMediaAssets([])}
                      className="px-2.5 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-xs text-red-200 transition-colors whitespace-nowrap shrink-0"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {mediaUploading && (
                <div className="flex items-center gap-2 text-xs text-[#EAB308] font-mono-tabular">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading gallery photos...</span>
                </div>
              )}

              {mediaAssets.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
                  {mediaAssets.map((item, idx) => (
                    <div
                      key={item.assetId}
                      className="p-2 rounded-xl bg-[#070C09] border border-white/10 flex flex-col justify-between gap-2"
                    >
                      <div className="aspect-square rounded-lg bg-black/40 overflow-hidden flex items-center justify-center">
                        <img
                          src={item.previewUrl || item.url}
                          alt={item.fileName}
                          onError={handleFirebaseImgError}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] text-neutral-300 font-mono-tabular truncate">
                          #{idx + 1} {item.fileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMediaAssetAt(idx)}
                          aria-label={`Remove image ${idx + 1}`}
                          className="p-1 rounded bg-red-950/60 hover:bg-red-900 text-red-300 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Google reCAPTCHA API Verification */}
            <div className="p-4 rounded-xl bg-[#070C09] border border-white/10 space-y-2">
              <span className="block text-xs font-semibold text-neutral-200">
                Security Verification <span className="text-[#EF4444]">*</span>
              </span>
              <RecaptchaWidget
                onVerify={(token) => setCaptchaToken(token)}
                resetSignal={captchaResetCount}
              />
            </div>

            {status && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium border ${
                  status.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/60 border-red-500/40 text-red-200'
                }`}
              >
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || militaryPhotoUploading || mediaUploading}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#EAB308] hover:bg-[#FACC15] disabled:opacity-50 text-[#070C09] font-extrabold text-xs uppercase tracking-wider transition-colors whitespace-nowrap shrink-0"
            >
              {submitting ? 'Submitting Application...' : 'Submit Warrior Player Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
