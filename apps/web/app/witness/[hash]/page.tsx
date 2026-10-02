import WitnessInner from "./inner";

interface Props {
  params: Promise<{ hash: string }>;
}

/** Public witness-pack page: the artifact is a link, not a file (Thiel loop). */
export default function WitnessPage({ params }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <WitnessInner params={params} />
    </main>
  );
}

