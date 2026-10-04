import PageHero from "../../../components/PageHero";
import StoryStage from "../../../components/StoryStage";
import { storyBySlug } from "../../../lib/stories";

export const metadata = {
  title: "Two-minute demo",
  description: "The gallium story playing itself: three public events, today's deadline, then a real reviewer desk.",
};

export default function DemoPage() {
  const story = storyBySlug("gallium");
  if (!story) return null;
  return (
    <main className="min-h-screen">
      <PageHero eyebrow="Guided demo · about two minutes" title="Watch a deadline become a verified case." lede="It plays itself. Pause to take the controls." image="2-system" />
      <div className="enter mx-auto max-w-5xl px-4 pb-14 sm:px-6">
        <StoryStage story={story} autoplay />
      </div>
    </main>
  );
}
