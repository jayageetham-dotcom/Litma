import { Suspense } from "react";
import { HelpCenter } from "@/components/help/HelpCenter";
import { forPage, loadHelp } from "@/lib/help";
import "./help.css";

/**
 * /help: the help site. Built from the Markdown files in apps/web/content/help at build time;
 * this page is the home and the topics (/help/?c=<topic>); each guide has its own page, app/help/[id]
 * (/help/<guide>/). Old /help/?a=<guide> addresses forward there.
 */
export default function HelpPage() {
  const data = loadHelp();
  return (
    <Suspense fallback={<div className="landing min-h-dvh bg-mist" />}>
      <HelpCenter data={forPage(data)} />
    </Suspense>
  );
}
