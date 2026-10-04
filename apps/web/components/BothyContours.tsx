export default function BothyContours({ label = false, className = "" }: { label?: boolean; className?: string }) {
  return (
    <div className={`contours ${className}`} aria-hidden={!label} role={label ? "img" : undefined} aria-label={label ? "Illustrative contours" : undefined}>
      <svg viewBox="0 0 480 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g fill="none" stroke="var(--rule)" strokeWidth="1" strokeOpacity="0.55">
          <path d="M60 150 C60 95 115 55 175 62 C235 69 265 118 250 168 C235 218 180 245 130 228 C85 213 60 195 60 150 Z" />
          <path d="M92 152 C92 115 132 88 176 93 C218 98 240 132 229 166 C218 200 178 219 140 207 C107 197 92 182 92 152 Z" />
          <path d="M124 154 C124 131 150 114 179 117 C205 120 218 141 211 162 C204 183 178 194 154 187 C134 181 124 170 124 154 Z" />
          <path d="M300 210 C300 170 345 140 395 148 C440 155 460 190 448 226 C436 262 390 282 348 270 C315 261 300 240 300 210 Z" />
          <path d="M328 212 C328 184 360 163 394 169 C424 174 438 197 430 222 C421 247 388 261 358 253 C338 247 328 232 328 212 Z" />
          <path d="M270 60 C285 40 320 30 352 40 C382 49 396 72 386 94 C376 116 342 126 314 117 C289 109 260 92 270 60 Z" />
        </g>
        <g fill="none" stroke="var(--moss)" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="3 5">
          <path d="M40 270 C120 255 200 285 290 268 C365 254 430 268 470 258" />
          <path d="M20 35 C90 55 160 30 240 45 C320 60 400 38 465 52" />
        </g>
      </svg>
      {label && <span className="contours-tag mono">Illustrative contours</span>}
    </div>
  );
}
