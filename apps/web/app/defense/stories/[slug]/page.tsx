import { notFound } from "next/navigation";
import PageHero from "../../../../components/PageHero";
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
      </div>
    </main>
  );
}
