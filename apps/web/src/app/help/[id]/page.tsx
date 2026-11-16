import { notFound } from "next/navigation";
import { HelpView } from "@/components/help/HelpCenter";
import { allGuides, forPage, loadHelp } from "@/lib/help";
import { pageMetadata } from "@/lib/seo";
import "../help.css";

/**
 * /help/<guide>/: one help guide on its own page, built ahead of time for every guide in
 * apps/web/content/help (the one dynamic route Litma has: nothing here needs a server). Each page has the
 * guide's own title, description and canonical address, so search engines index every guide; before Nov 2026
 * they all lived at /help/?a=<guide> and shared /help/'s canonical, so none was indexed.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return allGuides().map((a) => ({ id: a.id }));
}

type Props = { params: Promise<{ id: string }> };

/** The search snippet: the guide's first paragraph, or its opening text when that paragraph only leads into a list. */
function describe(lead: string, text: string) {
  if (lead.length >= 70 && !/[:：]$/.test(lead)) return lead;
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 158 ? `${t.slice(0, 155).replace(/\s+\S*$/, "")}…` : t;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const a = allGuides().find((x) => x.id === id);
  if (!a) return {};
  return pageMetadata({ title: `${a.title} · Litma Help`, description: describe(a.lead, a.text), path: `/help/${id}/` });
}

export default async function GuidePage({ params }: Props) {
  const { id } = await params;
  const data = loadHelp();
  if (!allGuides(data).some((a) => a.id === id)) notFound();
  return <HelpView data={forPage(data, id)} aId={id} />;
}
