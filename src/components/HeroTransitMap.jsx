import React from 'react'
import { motion } from 'framer-motion'

// Signature hero element: a stylised transit map — curved route lines with
// vehicles animating along their paths via SVG <animateMotion>, plus pulsing
// GPS pins at interchange points. Built in pure SVG/CSS (no 3D engine) to
// keep the bundle light and dependable across devices.
export default function HeroTransitMap() {
  const routes = [
    { d: 'M 40,340 C 140,300 160,180 280,150 C 380,125 420,80 540,60', color: '#3654F4', dur: '7s', glyph: '🚌' },
    { d: 'M 20,120 C 120,140 180,220 260,260 C 360,310 420,300 560,260', color: '#7089FF', dur: '9s', glyph: '🚆' },
    { d: 'M 60,420 C 160,400 220,340 320,320 C 420,300 470,240 550,190', color: '#FFB020', dur: '6s', glyph: '🚕' },
    { d: 'M 10,240 C 90,260 130,320 220,360 C 310,400 380,420 480,430', color: '#17D492', dur: '8s', glyph: '🛺' },
  ]

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg viewBox="0 0 580 460" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <circle cx="1.4" cy="1.4" r="1.4" fill="rgba(255,255,255,0.06)" />
          </pattern>
          {routes.map((r, i) => (
            <linearGradient id={`grad-${i}`} key={i} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={r.color} stopOpacity="0.05" />
              <stop offset="50%" stopColor={r.color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={r.color} stopOpacity="0.05" />
            </linearGradient>
          ))}
        </defs>

        <rect x="0" y="0" width="580" height="460" fill="url(#grid)" />

        {routes.map((r, i) => (
          <path key={i} id={`path-${i}`} d={r.d} fill="none" stroke={`url(#grad-${i})`} strokeWidth="2.5" strokeLinecap="round" />
        ))}

        {/* Interchange / location pins */}
        {[[280, 150], [260, 260], [320, 320], [220, 360]].map(([cx, cy], i) => (
          <g key={i} transform={`translate(${cx},${cy})`}>
            <circle r="10" fill="none" stroke="#FFB020" strokeOpacity="0.5">
              <animate attributeName="r" values="6;16;6" dur="2.4s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
            </circle>
            <circle r="4" fill="#FFB020" />
          </g>
        ))}

        {/* Vehicles travelling along each route */}
        {routes.map((r, i) => (
          <g key={i}>
            <circle r="9" fill={r.color} opacity="0.95">
              <animateMotion dur={r.dur} repeatCount="indefinite" rotate="auto">
                <mpath xlinkHref={`#path-${i}`} />
              </animateMotion>
            </circle>
            <text fontSize="11" textAnchor="middle" dy="4">
              <animateMotion dur={r.dur} repeatCount="indefinite">
                <mpath xlinkHref={`#path-${i}`} />
              </animateMotion>
              {r.glyph}
            </text>
          </g>
        ))}
      </svg>

      {/* Floating data chip, orchestrated with the rest of the hero load-in */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.6 }}
        className="glass"
        style={{
          position: 'absolute', bottom: 8, left: 8, padding: '10px 16px', borderRadius: 14,
          display: 'flex', alignItems: 'center', gap: 10
        }}
      >
        <span className="dot dot-live" />
        <span className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>Illustrative route preview</span>
      </motion.div>
    </div>
  )
}
