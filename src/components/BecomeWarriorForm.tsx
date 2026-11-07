import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { formatReplaceTag } from '../utils/rosterLogic';
import { TEAM_LOGOS, MILITARY_BRANCHES } from '../data/seedData';
import { trackCustomEvent } from '../services/firebaseStorage';
import { submitWarriorToGoogleSheet } from '../services/googleWorkspace';
import {
  sanitizeFormText,
  validateWarriorApplicationInput,
  verifyAntiSpamSubmission,
  recordSuccessfulFormSubmission,
} from '../utils/formSecurity';
import { RecaptchaWidget } from './RecaptchaWidget';

export const BecomeWarriorForm: React.FC<{ onSubmitted?: () => void }> = ({ onSubmitted }) => {
  const formLoadedAtRef = useRef<number>(Date.now());

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [branch, setBranch] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preferredContact, setPreferredContact] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [questionsInfo, setQuestionsInfo] = useState('');

  // Anti-spam security & Google reCAPTCHA API state
  const [honeypot, setHoneypot] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetCount, setCaptchaResetCount] = useState(0);

  // Submission status
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const toggleContactMethod = (method: string) => {
    setPreferredContact((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleWarriorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    // 1. Validate required fields & non-empty content
    const validation = validateWarriorApplicationInput({
      firstName,
      lastName,
      branch,
      phone,
      email,
      preferredContact,
      experience,
      questionsInfo,
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
      .toLowerCase()}|${email.trim().toLowerCase()}`;
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
      branch: sanitizeFormText(branch, 80),
      phone: sanitizeFormText(phone, 40),
      email: sanitizeFormText(email, 120),
      preferredContact: preferredContact.map((m) => sanitizeFormText(m, 30)),
      experience: sanitizeFormText(experience, 2000),
      questionsInfo: sanitizeFormText(questionsInfo, 2000),
      honeypot,
      captchaToken,
    });
    setSubmitting(false);

    if (result.ok) {
      recordSuccessfulFormSubmission('warrior', fingerprint);
      trackCustomEvent('submit_become_warrior', {
        branch,
        preferred_contact: preferredContact.join(', '),
      });
      setStatus({ type: 'success', message: result.message });
      setFirstName('');
      setLastName('');
      setBranch('');
      setPhone('');
      setEmail('');
      setPreferredContact([]);
      setExperience('');
      setQuestionsInfo('');
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
              Player Registration
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase tracking-wide">
              Become a Warrior
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              A member of the team will contact you to confirm eligibility, give more information about the team, and answer additional questions.
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
                  className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
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
                  className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
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

            {/* Row 2: Branch, Phone, Email */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="warrior-branch"
                  className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
                >
                  Branch <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  id="warrior-branch"
                  required
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
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
                  htmlFor="warrior-phone"
                  className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
                >
                  Phone <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="warrior-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="warrior-email"
                  className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
                >
                  Email <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  id="warrior-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
                />
              </div>
            </div>

            {/* Row 3: Preferred Method of Contact */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                Preferred Method of Contact <span className="text-[#EF4444]">*</span>
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {(['Text', 'Call', 'Email'] as const).map((method) => {
                  const checked = preferredContact.includes(method);
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
                        onChange={() => toggleContactMethod(method)}
                        className="w-4 h-4 accent-[#EAB308] rounded"
                      />
                      <span className="uppercase tracking-wider">{method}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Row 4: Hockey Experience (Paragraph Box) */}
            <div className="space-y-1.5">
              <label
                htmlFor="warrior-experience"
                className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
              >
                Hockey Experience <span className="text-[#EF4444]">*</span>
              </label>
              <textarea
                id="warrior-experience"
                rows={4}
                required
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="Tell us about your hockey experience (beginner, rec league, position played, years skating, etc.)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
              />
            </div>

            {/* Row 5: Additional Questions/Info (Paragraph Box) */}
            <div className="space-y-1.5">
              <label
                htmlFor="warrior-questions-info"
                className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider"
              >
                Additional Questions/Info
              </label>
              <textarea
                id="warrior-questions-info"
                rows={3}
                value={questionsInfo}
                onChange={(e) => setQuestionsInfo(e.target.value)}
                placeholder="Any questions, equipment needs, or additional information..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070C09] border border-white/15 text-sm text-white focus:border-[#EAB308] focus:outline-none"
              />
            </div>

            {/* Google reCAPTCHA API Verification */}
            <div className="p-4 rounded-xl bg-[#070C09] border border-white/10 space-y-2">
              <span className="block text-xs font-semibold text-neutral-200 uppercase tracking-wider">
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
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#EAB308] hover:bg-[#FACC15] disabled:opacity-50 text-[#070C09] font-extrabold text-xs uppercase tracking-wider transition-colors whitespace-nowrap shrink-0"
            >
              {submitting ? 'Submitting Application...' : 'Submit Warrior Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
