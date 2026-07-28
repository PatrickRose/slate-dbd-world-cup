const REPO_URL = "https://github.com/PatrickRose/slate-dbd-world-cup";
const TWITCH_URL = "https://www.twitch.tv/Slate";

const LINK =
  "font-medium text-red-600 underline decoration-red-600/30 underline-offset-2 transition-colors hover:decoration-red-600 dark:text-red-400 dark:decoration-red-400/30 dark:hover:decoration-red-400";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-black/10 dark:border-white/10">
      {/* Matches the page container so the footer lines up with the content. */}
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-zinc-500 sm:px-6 wide:max-w-[92rem]">
        <ul className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-x-6">
          <li>
            Taken from{" "}
            <a
              href={TWITCH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
            >
              Slate&apos;s stream
            </a>
          </li>
          <li>Built by Patrick Rose</li>
          <li>
            Spotted a mistake? Corrections welcome via{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
            >
              GitHub
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
