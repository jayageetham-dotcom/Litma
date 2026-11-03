"use client";
import { useInView } from "@/lib/useInView";

const WORDS = ["നോവൽ", "Novel", "കവിത", "Poem", "തിരക്കഥ", "Screenplay", "ചെറുകഥ", "Short story", "ലേഖനം", "Essay", "നാടകം", "Drama", "ഗാനം", "Lyrics", "ഡയറി", "Diary", "ഫീച്ചർ", "Feature"];

/** The tilted lime ribbon under the hero: writing types in both languages, scrolling (pauses on hover). */
export function Marquee() {
  const row = [...WORDS, ...WORDS];
  // scrolls only while on screen
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} aria-hidden className={`marquee ${inView ? "" : "paused"} relative z-10 -my-3 -ml-[5%] w-[110%] -rotate-[1.5deg] overflow-hidden border-y-2 border-on-pop bg-lime py-4 text-on-pop`}>
      <div className="marquee-track flex w-max gap-8">
        {row.map((w, i) => (
          <span
            key={i}
            className={`flex items-center gap-8 whitespace-nowrap text-2xl md:text-3xl ${i % 2 === 0 ? "font-extrabold" : "font-semibold opacity-60"}`}
            style={i % 2 === 0 ? { fontFamily: "var(--font-display)" } : undefined}
          >
            {w}
            {i % 2 === 1 && <span className="size-3 rounded-full bg-violet opacity-100" />}
          </span>
        ))}
      </div>
    </div>
  );
}
