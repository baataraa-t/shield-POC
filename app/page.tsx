import { Nav } from "@/components/Nav";
import { InspectorPanel } from "@/components/InspectorPanel";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <InspectorPanel />
      </main>
    </div>
  );
}
