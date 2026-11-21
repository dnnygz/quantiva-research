/**
 * Abstract scientific hero visual: a glass Bloch sphere with orbit rings and
 * a state vector. Pure SVG, no 3D library. Decorative only.
 */
export function BlochOrb({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 360" className={className} aria-hidden role="presentation">
      <defs>
        <radialGradient id="orb-body" cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#dff4ff" stopOpacity="0.75" />
          <stop offset="0.78" stopColor="#a9deff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#72d7e8" stopOpacity="0.7" />
        </radialGradient>
        <radialGradient id="orb-caustic" cx="62%" cy="82%" r="40%">
          <stop offset="0" stopColor="#d9f5a2" stopOpacity="0.7" />
          <stop offset="1" stopColor="#d9f5a2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="orb-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="orb-vector" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0a7396" />
          <stop offset="1" stopColor="#6a4fc2" />
        </linearGradient>
        <filter id="orb-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      <ellipse cx="180" cy="330" rx="110" ry="14" fill="#17324d" opacity="0.08" filter="url(#orb-soft)" />
      <circle cx="180" cy="176" r="138" fill="url(#orb-body)" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.5" />
      <circle cx="180" cy="176" r="138" fill="url(#orb-caustic)" />

      {/* Equator and meridians */}
      <g fill="none" stroke="#0a7396" strokeOpacity="0.28" strokeWidth="1.2">
        <ellipse cx="180" cy="176" rx="138" ry="40" />
        <ellipse cx="180" cy="176" rx="52" ry="138" />
        <ellipse cx="180" cy="176" rx="138" ry="40" transform="rotate(-28 180 176)" strokeDasharray="3 6" strokeOpacity="0.35" />
      </g>
      <line x1="180" y1="30" x2="180" y2="322" stroke="#17324d" strokeOpacity="0.18" strokeDasharray="2 5" />

      {/* State vector |ψ⟩ */}
      <line x1="180" y1="176" x2="262" y2="92" stroke="url(#orb-vector)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="262" cy="92" r="7" fill="#ffffff" stroke="#6a4fc2" strokeWidth="2.5" />
      <circle cx="180" cy="176" r="4" fill="#17324d" fillOpacity="0.5" />
      <text x="272" y="84" fontSize="15" fontWeight="600" fill="#17324d" fillOpacity="0.7" fontFamily="inherit">|ψ⟩</text>
      <text x="186" y="26" fontSize="12" fill="#17324d" fillOpacity="0.55" fontFamily="inherit">|0⟩</text>
      <text x="186" y="340" fontSize="12" fill="#17324d" fillOpacity="0.55" fontFamily="inherit">|1⟩</text>

      {/* Specular highlight */}
      <ellipse cx="146" cy="92" rx="78" ry="42" fill="url(#orb-gloss)" transform="rotate(-24 146 92)" />
      <circle cx="112" cy="104" r="7" fill="#fff" opacity="0.9" />
    </svg>
  );
}
