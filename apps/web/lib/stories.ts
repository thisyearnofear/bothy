export interface StoryEvent { date: string; text: string; source: { name: string; url: string } }
export interface Story {
  slug: string;
  kicker: string;
  title: string;
  lede: string;
  image: string;
  scenarioId: string;
  deadline?: { date: string; label: string };
  events: StoryEvent[];
  question: string;
  whoAsks: string;
  recordNote: string;
  caveat: string;
}

// Dated facts come from public reporting; every event carries its source. The
// scenario data shown beside them is synthetic.
export const STORIES: Story[] = [
  {
    slug: "gallium",
    kicker: "Story 01 · A deadline already on the calendar",
    title: "Gallium: the pause ends on 27 November.",
    lede: "In 2023 programme teams got 29 days' notice of Chinese gallium licensing. A US-specific ban was announced in 2024, then suspended. The suspension runs out on a known date.",
    image: "5-material",
    scenarioId: "gallium-chain",
    deadline: { date: "2026-11-27", label: "Suspension scheduled to end" },
    events: [
      { date: "3 Jul 2023", text: "China's commerce ministry and customs announce export licensing for gallium and germanium products, effective 1 August 2023: 29 days' notice.", source: { name: "IEA policy database", url: "https://www.iea.org/policies/17893-announcement-on-the-implementation-of-export-control-of-items-related-to-gallium-and-germanium" } },
      { date: "3 Dec 2024", text: "Announcement No. 46 bans exports of gallium, germanium, antimony and superhard materials to the United States.", source: { name: "CSET, Georgetown", url: "https://cset.georgetown.edu/publication/china-rare-earth-export-ban" } },
      { date: "9 Nov 2025", text: "The US-specific ban is suspended until 27 November 2026. The prohibition on military end users remains in effect.", source: { name: "CNBC", url: "https://www.cnbc.com/2025/11/09/china-suspends-ban-on-exports-of-gallium-germanium-antimony-to-us.html" } },
    ],
    question: "Which of our platforms depend on primary gallium, and who is checking inventory, qualified alternates and delivery timing before that date?",
    whoAsks: "A supply-chain lead at a defence prime, with a suspension date approaching and no agreed list of exposed programmes.",
    recordNote: "A sampled modeled chain from platform to primary gallium, pinned to a graph version.",
    caveat: "Platforms, parts and chains here are synthetic. The dates are public; the exposure shown is not any real programme's bill of materials.",
  },
  {
    slug: "red-sea",
    kicker: "Story 02 · A route closes within days",
    title: "Red Sea: which shipments are stuck, and who calls whom?",
    lede: "In December 2023 major carriers began avoiding the Red Sea. Within two weeks the largest paused sailings altogether. Programmes with parts in transit needed an answer, and an owner, fast.",
    image: "1-platform",
    scenarioId: "red-sea-d01",
    events: [
      { date: "18 Dec 2023", text: "Major shipping lines begin avoiding the Red Sea as Houthi attacks on commercial vessels increase.", source: { name: "Reuters", url: "https://www.reuters.com/world/middle-east/shipping-firms-avoid-red-sea-houthi-attacks-increase-2023-12-18" } },
      { date: "31 Dec 2023", text: "Maersk pauses Red Sea sailings after an attack on the Maersk Hangzhou.", source: { name: "CNBC", url: "https://www.cnbc.com/2023/12/31/maersk-pauses-red-sea-sailings-after-houthi-attack-on-container-ship.html" } },
      { date: "2024", text: "Carriers divert around the Cape of Good Hope: longer voyages and higher costs.", source: { name: "ITF / OECD", url: "https://www.itf-oecd.org/sites/default/files/repositories/red-sea-crisis-impacts-global-shipping.pdf" } },
    ],
    question: "Which in-flight shipments are blocked or at risk, and who is confirming each one with the supplier?",
    whoAsks: "A logistics manager the morning after the carrier announcement, with a shared spreadsheet and a dozen unanswered emails.",
    recordNote: "Shipments grouped by status for the modeled disruption: delivered, in transit, blocked.",
    caveat: "Shipment data is synthetic. The dates are public; no claim is made about any real company's shipments.",
  },
];

export const storyBySlug = (slug: string) => STORIES.find((story) => story.slug === slug);
