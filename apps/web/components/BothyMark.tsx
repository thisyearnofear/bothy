export default function BothyMark({ standalone = false, size = 26 }: { standalone?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={standalone ? "img" : undefined}
      aria-hidden={standalone ? undefined : true}
      aria-label={standalone ? "Bothy" : undefined}
    >
      {standalone && <title>Bothy</title>}
      <path
        d="M3 15.5 L16 5 L29 15.5"
        fill="none"
        stroke="var(--text-strong)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 15 L7 26 L25 26 L25 15"
        fill="none"
        stroke="var(--text-body)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="13" y="17.5" width="6" height="8.5" rx="0.8" fill="var(--shelter)" />
    </svg>
  );
}
