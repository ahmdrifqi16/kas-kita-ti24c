/**
 * Menghasilkan SVG Emblem Shield TI24C Champions bergaya retro varsity
 */
export function renderChampionsEmblem({ size = "md" } = {}) {
  const dimensions =
    {
      sm: "w-10 h-10",
      md: "w-14 h-14",
      lg: "w-20 h-20",
    }[size] || "w-14 h-14";

  return `
    <div class="inline-flex items-center justify-center ${dimensions} shrink-0 select-none" aria-hidden="true">
      <svg viewBox="0 0 120 130" class="w-full h-full drop-shadow-[2px_2px_0px_#24231F]">
        <!-- Outer Shield -->
        <path
          d="M14 12 H106 V62 C106 94 60 118 60 118 C60 118 14 94 14 62 Z"
          fill="#E6C95F"
          stroke="#24231F"
          stroke-width="6"
          stroke-linejoin="round"
        />
        <!-- Inner Shield -->
        <path
          d="M23 21 H97 V60 C97 86 60 107 60 107 C60 107 23 86 23 60 Z"
          fill="#303A25"
          stroke="#24231F"
          stroke-width="3"
        />
        <!-- Varsity Banner Stripe -->
        <rect x="25" y="45" width="70" height="26" fill="#D9533F" stroke="#24231F" stroke-width="2.5" />
        <!-- Top Year -->
        <text
          x="60"
          y="37"
          text-anchor="middle"
          fill="#E6C95F"
          font-family="Oswald, Impact, sans-serif"
          font-weight="700"
          font-size="13"
          letter-spacing="2"
        >EST. 2024</text>
        <!-- Main Class Code -->
        <text
          x="60"
          y="64"
          text-anchor="middle"
          fill="#F5EAC7"
          font-family="Oswald, Impact, sans-serif"
          font-weight="700"
          font-size="20"
          letter-spacing="1.5"
        >TI24C</text>
        <!-- Bottom Stars -->
        <text
          x="60"
          y="88"
          text-anchor="middle"
          fill="#F28C22"
          font-family="Oswald, sans-serif"
          font-weight="700"
          font-size="12"
          letter-spacing="3"
        >★ ★ ★</text>
      </svg>
    </div>
  `;
}
