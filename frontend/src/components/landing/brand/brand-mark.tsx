import { cn } from "@/lib/utils";

interface BrandMarkProps {
  size?: number;
  standalone?: boolean;
  className?: string;
}

export function BrandMark({ size = 30, standalone = false, className }: BrandMarkProps) {
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient
          id="lr-mark-grad"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="0"
          y2="512"
        >
          <stop offset="0" stopColor="oklch(50% 0.15 122)" />
          <stop offset="0.46" stopColor="oklch(62% 0.20 124)" />
          <stop offset="1" stopColor="oklch(80% 0.20 140)" />
        </linearGradient>
        <mask id="lr-mark-cuts" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <rect width="512" height="512" fill="white" />
          <polygon points="352,100 375,100 307,168 284,168" fill="black" />
        </mask>
      </defs>
      <g fill="none" stroke="url(#lr-mark-grad)" mask="url(#lr-mark-cuts)">
        <circle cx="256" cy="256" r="243" strokeWidth="26" />
        <circle cx="144" cy="293" r="30" strokeWidth="24" />
        <circle cx="334" cy="208" r="30" strokeWidth="24" />
        <circle cx="376" cy="294" r="30" strokeWidth="24" />
        <path
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="6"
          d="M 165 272 L 303 133 C 284 110 252 97 226 97 C 195 99 170 109 155 127 C 137 147 126 165 122 187 C 118 204 110 214 101 222 C 88 234 78 244 68 260 C 61 274 60 284 60 294 C 62 316 69 332 77.5 342 C 86 352 92 358 100 365 C 108 372 118 378 132 379 L 152 379 C 168 379 180 370 190 350 L 313 228"
        />
        <path
          strokeWidth="24"
          strokeLinejoin="miter"
          strokeMiterlimit="6"
          d="M 344 127 L 374 142 C 383 150 388 158 391 170 C 394 182 402 196 405 210 C 406 216 414 226 428 236 C 444 248 454 262 457 284 C 458 298 456 310 452 322 C 448 334 438 346 428 356 C 416 370 402 377 386 377 L 292 377 L 355 315"
        />
      </g>
    </svg>
  );

  if (standalone) {
    return (
      <span role="img" aria-label="Light Role" className={cn("inline-flex", className)}>
        {svg}
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={cn("inline-flex", className)}>
      {svg}
    </span>
  );
}
