export interface Source { name: string; url: string }
export interface Beat {
  /** ISO date used for the clock; "today" resolves in the browser. */
  date: string | "today";
  label: string;
  heading: string;
  /** Second-person present tense. */
  narration: string;
  /** Short reading copy for the paced guided presentation. */
  briefing?: string;
  event?: { text: string; source: Source };
  /** Counts down (or up) between two dates; `from` defaults to the beat date. */
  clock?: { to: string; label: string; from?: string };
  /** The act beat opens the working desk. */
  act?: boolean;
  map?: "open" | "avoiding" | "paused" | "diverted";
}
export interface Story {
  slug: string;
  kicker: string;
  title: string;
  lede: string;
  image: string;
  scenarioId: string;
  question: string;
  recordNote: string;
  caveat: string;
  beats: Beat[];
}

// Dated facts come from public reporting and carry their source. The scenario
// data shown beside them is synthetic.
export const STORIES: Story[] = [
  {
    slug: "gallium",
    kicker: "Story 01 · A deadline already on the calendar",
    title: "Gallium: the pause ends on 27 November.",
    lede: "Drag the date. Three public events, then today, with a known deadline ahead.",
    image: "5-material",
    scenarioId: "gallium-chain",
    question: "Which of our platforms depend on primary gallium, and who is checking inventory, qualified alternates and delivery timing before that date?",
    recordNote: "A sampled modeled chain from platform to primary gallium, pinned to a graph version.",
    caveat: "Platforms, parts and chains are synthetic. The dates are public; the exposure shown is not any real programme's bill of materials.",
    beats: [
      {
        date: "2023-07-03", label: "3 Jul 2023", heading: "Licensing announced",
        narration: "You lead supply chain at a defence prime. Beijing has just announced export licensing for gallium and germanium. It starts in 29 days. No one has a list of the programmes that depend on it.",
        briefing: "Export licensing begins in 29 days. Which programme dependencies need checking?",
        event: { text: "China's commerce ministry and customs announce export licensing for gallium and germanium products, effective 1 August 2023.", source: { name: "IEA policy database", url: "https://www.iea.org/policies/17893-announcement-on-the-implementation-of-export-control-of-items-related-to-gallium-and-germanium" } },
        clock: { to: "2023-08-01", label: "until licensing takes effect" },
      },
      {
        date: "2024-12-03", label: "3 Dec 2024", heading: "Exports prohibited",
        narration: "A second announcement lands. Gallium, germanium, antimony and superhard materials may no longer be exported to the United States. The question has changed from delay to prohibition.",
        briefing: "The US-specific restriction moves from licensing to prohibition. Material exposure now needs a named verification.",
        event: { text: "Announcement No. 46 bans exports of gallium, germanium, antimony and superhard materials to the United States.", source: { name: "CSET, Georgetown", url: "https://cset.georgetown.edu/publication/china-rare-earth-export-ban" } },
      },
      {
        date: "2025-11-09", label: "9 Nov 2025", heading: "A bounded suspension",
        narration: "The ban is suspended, not lifted. It pauses until 27 November 2026, and the military end-user prohibition stays in force. Teams exhale. A date is now on the calendar.",
        briefing: "A suspension window opens. Military end-user restrictions remain, and the end date is already set.",
        event: { text: "The US-specific ban is suspended until 27 November 2026. The prohibition on military end users remains.", source: { name: "CNBC", url: "https://www.cnbc.com/2025/11/09/china-suspends-ban-on-exports-of-gallium-germanium-antimony-to-us.html" } },
        clock: { to: "2026-11-27", label: "of suspension" },
      },
      {
        date: "today", label: "Today", heading: "Turn exposure into a named check", act: true,
        narration: "The clock is real and it is running. Your job this week is to turn a news item into a verified list, with a name against every check. This is your desk.",
        clock: { to: "2026-11-27", label: "until the suspension is scheduled to end" },
      },
    ],
  },
  {
    slug: "red-sea",
    kicker: "Story 02 · A route closes within days",
    title: "Red Sea: which shipments are stuck, and who calls whom?",
    lede: "Drag the date. Carriers pull out of the Red Sea and the route bends around Africa.",
    image: "1-platform",
    scenarioId: "red-sea-d01",
    question: "Which in-flight shipments are blocked or at risk, and who is confirming each one with the supplier?",
    recordNote: "Shipments grouped by status for the modeled disruption: delivered, in transit, blocked.",
    caveat: "Shipment data is synthetic. The dates are public; no claim is made about any real company's shipments.",
    beats: [
      {
        date: "2023-12-18", label: "18 Dec 2023", heading: "Carriers avoid the corridor", map: "avoiding",
        narration: "You run logistics for a defence supplier. Overnight, major carriers announce they are avoiding the Red Sea. Parts for three programmes are somewhere on that route.",
        event: { text: "Major shipping lines begin avoiding the Red Sea as Houthi attacks on commercial vessels increase.", source: { name: "Reuters", url: "https://www.reuters.com/world/middle-east/shipping-firms-avoid-red-sea-houthi-attacks-increase-2023-12-18" } },
      },
      {
        date: "2023-12-31", label: "31 Dec 2023", heading: "Sailings paused", map: "paused",
        narration: "The largest carrier stops sailing the route altogether. What was an advisory is now a closed door.",
        event: { text: "Maersk pauses Red Sea sailings after an attack on the Maersk Hangzhou.", source: { name: "CNBC", url: "https://www.cnbc.com/2023/12/31/maersk-pauses-red-sea-sailings-after-houthi-attack-on-container-ship.html" } },
      },
      {
        date: "2024-01-01", label: "1 Jan 2024", heading: "A longer route. A named verification.", map: "diverted", act: true,
        narration: "Ships now go around the Cape of Good Hope: longer, costlier, later. Someone has to say which shipments are blocked, and who is on the phone to which supplier. This is your desk.",
        event: { text: "Carriers divert around the Cape of Good Hope through 2024.", source: { name: "ITF / OECD", url: "https://www.itf-oecd.org/sites/default/files/repositories/red-sea-crisis-impacts-global-shipping.pdf" } },
      },
    ],
  },
];

export const storyBySlug = (slug: string) => STORIES.find((story) => story.slug === slug);

const DAY = 86_400_000;
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();

/** Whole days between a beat and its clock target. `now` is injected so it stays pure. */
export function clockDays(beat: Beat, now: number): number | null {
  if (!beat.clock) return null;
  const from = beat.clock.from ? utc(beat.clock.from) : beat.date === "today" ? now : utc(beat.date);
  const days = (utc(beat.clock.to) - from) / DAY;
  return beat.date === "today" ? Math.ceil(days) : Math.round(days);
}
