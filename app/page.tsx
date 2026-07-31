import { redirect } from "next/navigation";
import { getLatestYear } from "@/lib/tournament-data";

export default function Home() {
  const latest = getLatestYear();

  if (!latest) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold">No tournaments yet</h1>
        <p className="mt-2 text-zinc-500">
          Add a <code>data/&lt;year&gt;.json</code> file to get started.
        </p>
      </main>
    );
  }

  redirect(`/${latest}`);
}
