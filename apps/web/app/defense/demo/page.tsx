import { SiteHeader } from "../../../components/PageHero";
import StoryStage from "../../../components/StoryStage";
import { storyBySlug } from "../../../lib/stories";

export const metadata = {
  title: "Guided deadline demo",
  description: "The gallium story playing itself: three public events, today's deadline, then a real reviewer desk.",
};

export default function DemoPage() {
  const story = storyBySlug("gallium");
  if (!story) return null;
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <header className="demo-intro mx-auto max-w-5xl px-4 sm:px-6"><p className="eyebrow">Guided demo · public dates / synthetic case</p><h1>A deadline. A dependency. A named check.</h1><p>Eight seconds per date, then a paced reviewer demonstration. Pause to investigate.</p></header>
      <div className="enter mx-auto max-w-5xl px-4 pb-14 sm:px-6">
        <StoryStage story={story} autoplay />
      </div>
    </main>
  );
}
