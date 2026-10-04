import { notFound } from "next/navigation";
import PageHero from "../../../../components/PageHero";
import PrintButton from "../../../../components/PrintButton";
import StoryStage from "../../../../components/StoryStage";
import { STORIES, storyBySlug } from "../../../../lib/stories";

export function generateStaticParams() { return STORIES.map((story) => ({ slug: story.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const story = storyBySlug((await params).slug);
  return story ? { title: story.title, description: story.lede } : {};
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const story = storyBySlug((await params).slug);
  if (!story) notFound();
  return (
    <main className="min-h-screen">
      <PageHero eyebrow={story.kicker} title={story.title} lede={story.lede} image={story.image} />
      <div className="enter mx-auto max-w-5xl px-4 pb-14 sm:px-6">
        <StoryStage story={story} />
        <section className="print-only" aria-label="Case file">
          <h2>{story.title}: case file</h2>
          <ol>{story.beats.map((beat) => <li key={beat.label}><strong>{beat.label}.</strong> {beat.narration}{beat.event ? ` ${beat.event.text} (${beat.event.source.name}: ${beat.event.source.url})` : ""}</li>)}</ol>
          <p><strong>The question:</strong> {story.question}</p>
          <p><strong>What this does not show.</strong> Bothy did not exist during these events. {story.caveat}</p>
        </section>
        <div className="mt-10"><PrintButton /></div>
      </div>
    </main>
  );
}
