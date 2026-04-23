export default function AuthStreakBackground() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="ls-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="40" />
        </filter>
      </defs>

      {/* Glow paths (3) — wider, blurred, behind everything */}
      <g filter="url(#ls-blur)">
        <path
          className="ls-glow"
          d="M -80 240 Q 260 340 540 520 T 920 860"
          stroke="oklch(62% 0.19 125)"
          strokeWidth="70"
          strokeLinecap="round"
          fill="none"
          opacity="0.28"
        />
        <path
          className="ls-glow"
          d="M -120 520 Q 200 620 460 740 T 880 980"
          stroke="oklch(58% 0.17 120)"
          strokeWidth="55"
          strokeLinecap="round"
          fill="none"
          opacity="0.22"
        />
        <path
          className="ls-glow"
          d="M 60 80 Q 340 280 600 440 T 980 720"
          stroke="oklch(66% 0.16 170)"
          strokeWidth="45"
          strokeLinecap="round"
          fill="none"
          opacity="0.18"
        />
      </g>

      {/* Sharp streaks (10) — thin, solid, on top */}
      <path
        className="ls-streaks"
        d="M -60 120 Q 220 240 460 400 T 880 680"
        stroke="oklch(72% 0.21 122)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.48"
      />
      <path
        className="ls-streaks"
        d="M -40 200 Q 260 320 520 500 T 900 780"
        stroke="oklch(68% 0.2 128)"
        strokeWidth="1.25"
        strokeLinecap="round"
        fill="none"
        opacity="0.38"
      />
      <path
        className="ls-streaks"
        d="M 20 60 Q 300 220 540 380 T 920 640"
        stroke="oklch(74% 0.19 118)"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.32"
      />
      <path
        className="ls-streaks"
        d="M -100 360 Q 180 460 440 600 T 880 880"
        stroke="oklch(66% 0.22 124)"
        strokeWidth="1.75"
        strokeLinecap="round"
        fill="none"
        opacity="0.52"
      />
      <path
        className="ls-streaks"
        d="M -80 460 Q 220 560 480 700 T 900 940"
        stroke="oklch(70% 0.2 130)"
        strokeWidth="1.25"
        strokeLinecap="round"
        fill="none"
        opacity="0.36"
      />
      <path
        className="ls-streaks"
        d="M 40 20 Q 320 180 580 340 T 960 580"
        stroke="oklch(78% 0.18 115)"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
      <path
        className="ls-streaks"
        d="M -60 620 Q 240 720 500 820 T 940 980"
        stroke="oklch(64% 0.21 126)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.42"
      />
      <path
        className="ls-streaks"
        d="M 100 160 Q 360 300 600 460 T 980 720"
        stroke="oklch(70% 0.18 120)"
        strokeWidth="1.25"
        strokeLinecap="round"
        fill="none"
        opacity="0.34"
      />
      {/* Teal accent */}
      <path
        className="ls-streaks"
        d="M -40 300 Q 260 420 520 580 T 920 860"
        stroke="oklch(72% 0.15 170)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.44"
      />
      <path
        className="ls-streaks"
        d="M -120 780 Q 200 860 460 920 T 880 1020"
        stroke="oklch(66% 0.2 122)"
        strokeWidth="1.25"
        strokeLinecap="round"
        fill="none"
        opacity="0.28"
      />
    </svg>
  );
}
