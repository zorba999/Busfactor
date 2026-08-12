import type { Evidence, Status } from "./types";
import { ZERO_ADDRESS } from "./types";

export const STATUS_ORDER: Status[] = ["ROTTING", "DORMANT", "FINISHED", "ACTIVE"];

export const STATUS_COPY: Record<
  Exclude<Status, "">,
  { label: string; gloss: string; color: string; ink: string }
> = {
  ACTIVE: {
    label: "Active",
    gloss: "Someone is still steering this.",
    color: "var(--color-alive)",
    ink: "var(--color-ink)",
  },
  FINISHED: {
    label: "Finished",
    gloss: "Quiet on purpose. Nothing to fix.",
    color: "var(--color-rest)",
    ink: "var(--color-paper-raised)",
  },
  DORMANT: {
    label: "Dormant",
    gloss: "The maintainer stopped. Work is piling up.",
    color: "var(--color-drift)",
    ink: "var(--color-paper-raised)",
  },
  ROTTING: {
    label: "Rotting",
    gloss: "Abandoned and now dangerous.",
    color: "var(--color-rot)",
    ink: "var(--color-paper-raised)",
  },
};

export function statusStyle(status: Status) {
  if (status === "") {
    return {
      label: "Unheard",
      gloss: "No inquest has been opened yet.",
      color: "var(--color-ink-faint)",
      ink: "var(--color-paper-raised)",
    };
  }
  return STATUS_COPY[status];
}

export function parseEvidence(raw: string): Evidence {
  try {
    const parsed = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed !== null ? (parsed as Evidence) : {};
  } catch {
    return {};
  }
}

export function parseReasons(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function shortAddress(address?: string) {
  if (!address || address === ZERO_ADDRESS) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function isZero(address?: string) {
  return !address || address.toLowerCase() === ZERO_ADDRESS;
}

/** "2026-08-12T15:42:56Z" -> "12 Aug 2026". Fixed locale so SSR and the
 *  browser never disagree during hydration. */
export function formatDate(iso?: string) {
  if (!iso || iso.length < 10) return "—";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const year = iso.slice(0, 4);
  const month = months[Number(iso.slice(5, 7)) - 1] ?? "—";
  const day = String(Number(iso.slice(8, 10)));
  return `${day} ${month} ${year}`;
}

const BUCKET_WORDS: Record<string, string> = {
  "0-7d": "within a week",
  "8-30d": "within a month",
  "31-90d": "1–3 months ago",
  "91-180d": "3–6 months ago",
  "181-365d": "6–12 months ago",
  "1-2y": "1–2 years ago",
  "2y+": "over 2 years ago",
  unknown: "unknown",
};

export function bucketWords(bucket?: string) {
  if (!bucket) return "—";
  return BUCKET_WORDS[bucket] ?? bucket;
}

export function repoPath(repo: string) {
  const [owner, name] = repo.split("/");
  return `/repo/${encodeURIComponent(owner ?? "")}/${encodeURIComponent(name ?? "")}`;
}

/** Accepts a full GitHub URL or "owner/name" and returns "owner/name". */
export function normaliseRepo(input: string): string | null {
  let cleaned = input.trim().toLowerCase();
  for (const prefix of [
    "https://github.com/",
    "http://github.com/",
    "github.com/",
    "www.",
  ]) {
    if (cleaned.startsWith(prefix)) cleaned = cleaned.slice(prefix.length);
  }
  cleaned = cleaned.replace(/^\/+|\/+$/g, "");
  if (cleaned.endsWith(".git")) cleaned = cleaned.slice(0, -4);
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  if (!/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(parts[1])) return null;
  return `${parts[0]}/${parts[1]}`;
}
