import React from 'react';

interface PfLogoProps {
  className?: string;
  size?: number;
  badge?: boolean;
}

/**
 * Tasteful original cursive "Pf" vector mark for ProofPatcher.
 * Features an elegant calligraphic ligature between the P bowl and the f ascender.
 */
export function PfLogo({ className = 'w-7 h-7', size = 28, badge = true }: PfLogoProps) {
  const badgeClasses = badge
    ? 'bg-gradient-to-br from-violet-600 to-purple-800 text-white rounded-xl shadow-xs'
    : 'text-violet-600 dark:text-violet-400';

  return (
    <span className={`inline-flex items-center justify-center p-1.5 shrink-0 ${badgeClasses} ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        {/* Tasteful cursive calligraphic "Pf" ligature stroke */}
        <g
          stroke={badge ? '#ffffff' : 'currentColor'}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* P stem with soft calligraphic entry */}
          <path d="M 9.5 9 C 9.5 12 9.5 21 9 23.5 C 8.8 24.5 7.8 24.5 7.2 23.8" />

          {/* P flourishing top loop and bowl connecting toward f */}
          <path d="M 8.8 11.5 C 9.2 8.5 11.8 7 14.5 7 C 17.5 7 18.8 8.8 18.8 11.2 C 18.8 14 16.5 15.6 13.5 15.6 C 11.2 15.6 9.5 15.4 9.5 15.4" />

          {/* Fluid connection from P bowl into cursive 'f' ascender loop, descending gracefully */}
          <path d="M 17 15 C 19 14.5 20.8 11.5 21.8 8.5 C 22.4 6.8 24.2 6.5 24.8 8.2 C 25.4 10 24.2 15 23.2 19.5 C 22.4 23 21.6 25.5 20.2 25.5 C 19.4 25.5 19 24.5 19.5 23" />

          {/* Cursive 'f' horizontal crossbar flick */}
          <path d="M 18.5 15.2 Q 22 14.8 25.5 15" strokeWidth="1.8" />
        </g>
      </svg>
    </span>
  );
}
