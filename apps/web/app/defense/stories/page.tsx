import Link from "next/link";
import PageHero from "../../../components/PageHero";
import { STORIES } from "../../../lib/stories";

export const metadata = {
  title: "Stories",
  description: "Real supply-chain events, and the record Bothy would have produced.",
};

export default function StoriesPage() {
  return (
    <main className="min-h-screen">
      <PageHero eyebrow="Historical replays" title="Case files" lede="Public events. Synthetic exposure. A reviewer’s decision at the end." image="3-assembly" />
      <div className="enter mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <ul className="path-grid story-hub">
          {STORIES.map((story, index) => <li key={story.slug}><Link href={`/defense/stories/${story.slug}`} className="path-tile">
            <span className="mono path-n" aria-hidden>{String(index + 1).padStart(2, "0")}</span>
            <span className="path-title">{story.title}</span>
            <span className="path-text">{story.beats[0].label} → {story.beats[story.beats.length - 1].label} · {story.beats.length} dates · one reviewer desk</span>
            <span className="mono path-go" aria-hidden>→</span>
          </Link></li>)}
        </ul>
      </div>
    </main>
  );
}
