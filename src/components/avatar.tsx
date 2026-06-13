/**
 * Profilbild-Avatar. Zeigt das hochgeladene Bild oder — als Fallback —
 * die Initiale auf farbigem Kreis. Server- und client-tauglich (nur Markup).
 */

interface AvatarProps {
  name: string | null;
  url: string | null;
  size?: number;
  className?: string;
}

// Deterministische Hintergrundfarbe aus dem Namen (für Initialen-Fallback).
const FALLBACK_COLORS = [
  "#15803d", "#0e7490", "#b45309", "#7c3aed",
  "#be123c", "#1d4ed8", "#047857", "#9333ea",
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

export function Avatar({ name, url, size = 32, className = "" }: AvatarProps) {
  const safeName = (name ?? "").trim();
  const initial = safeName ? safeName[0].toUpperCase() : "?";

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={safeName || "Profilbild"}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.45),
        background: colorFor(safeName || "?"),
      }}
      className={`rounded-full inline-flex items-center justify-center font-bold text-white shrink-0 ${className}`}
    >
      {initial}
    </span>
  );
}
