import React from 'react';
import { ShieldCheck, CheckCircle2, ExternalLink } from 'lucide-react';
import { formatReplaceTag } from '../utils/rosterLogic';
import { TEAM_LOGOS, SOCIAL_LINKS } from '../data/seedData';

export const BecomeWarriorForm: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Verified Eligibility & Onboarding (Modeled after Flyers Warriors IMG_9671 / IMG_9694) */}
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

        {/* Verified Roster Onboarding via Official Team Channels */}
        <div className="bg-[#122018] border border-[#EAB308]/30 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white font-display uppercase">
              How to Get Verified & Added to the Roster
            </h3>
            <p className="text-xs md:text-sm text-neutral-300 leading-relaxed max-w-xl">
              Roster profiles and rank tabs are maintained exclusively by verified Garden State
              Warriors administrators. Reach out to the club directly via our official social
              pages to verify eligibility and join the ice.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={SOCIAL_LINKS.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-lg bg-[#EAB308] text-[#0B120E] font-bold text-xs hover:bg-[#FACC15] transition-colors flex items-center gap-1.5"
            >
              <span>Message {SOCIAL_LINKS.instagramHandle}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={SOCIAL_LINKS.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <span>Facebook Page</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
