import { Suspense } from "react";
import { HelpCenter } from "@/components/help/HelpCenter";
import { loadHelp } from "@/lib/help";
import "./help.css";

/**
 * /help: the help site. Built from the Markdown files in apps/web/content/help at build time;
 * the page picks the topic or guide from the query (/help/?c=<topic>, /help/?a=<guide>).
 */
export default function HelpPage() {
  const data = loadHelp();
  return (
    <Suspense fallback={<div className="landing min-h-dvh bg-mist" />}>
      <HelpCenter data={data} />
    </Suspense>
  );
}
