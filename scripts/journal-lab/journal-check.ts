// Hand-written cases for the shared journal dates (packages/shared/src/forms.ts).
// The phone's test/journal_test.dart checks the same answers.
// Run: TZ=Asia/Kolkata node --experimental-transform-types scripts/journal-lab/journal-check.ts
import { todayLine, journalDay, shortDate, monthLine, journalTitle, isUntitledJournal, keepOnClose, starterContent } from "../../packages/shared/src/forms.ts";

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

const d = new Date(2026, 10, 28, 9, 30); // Saturday 28 Nov 2026, local time
const now = new Date(2026, 10, 28, 20, 0);
eq("todayLine", todayLine(d), "2026 നവംബർ 28, ശനിയാഴ്ച");
eq("todayLine Sunday", todayLine(new Date(2026, 10, 29)), "2026 നവംബർ 29, ഞായറാഴ്ച");
eq("todayLine 1 Jan", todayLine(new Date(2027, 0, 1)), "2027 ജനുവരി 1, വെള്ളിയാഴ്ച");
eq("todayLine Oct (no ZWNJ)", todayLine(new Date(2026, 9, 4)), "2026 ഒക്ടോബർ 4, ഞായറാഴ്ച");
eq("journalDay", journalDay(d), { day: 28, month: "നവം", weekday: "ശനി" });
eq("journalDay Wed", journalDay(new Date(2026, 8, 2)), { day: 2, month: "സെപ്റ്റം", weekday: "ബുധൻ" });
eq("shortDate this year", shortDate(d, now), "28 നവം");
eq("shortDate other year", shortDate(new Date(2025, 7, 15), now), "15 ഓഗ 2025");
eq("monthLine", monthLine(d), "2026 നവംബർ");
eq("monthLine May", monthLine(new Date(2026, 4, 1)), "2026 മേയ്");
eq("journalTitle", journalTitle(d), "2026 നവംബർ 28, ശനിയാഴ്ച");

const created = d.toISOString();
eq("untitled: empty", isUntitledJournal("", created), true);
eq("untitled: spaces", isUntitledJournal("   ", created), true);
eq("untitled: null", isUntitledJournal(null, null), true);
eq("untitled: പുതിയ ജേണൽ", isUntitledJournal("പുതിയ ജേണൽ", created), true);
eq("untitled: പുതിയ ഡയറി", isUntitledJournal("പുതിയ ഡയറി", null), true);
eq("untitled: its date", isUntitledJournal("2026 നവംബർ 28, ശനിയാഴ്ച", created), true);
eq("untitled: its date, padded", isUntitledJournal(" 2026 നവംബർ 28, ശനിയാഴ്ച ", created), true);
eq("untitled: its date, ICU ZWNJ", isUntitledJournal("2026 നവംബർ 28, ശനിയാഴ്‌ച", created), true);
eq("untitled: short date", isUntitledJournal("28 നവം", created), true);
eq("untitled: short date + year", isUntitledJournal("28 നവം 2026", created), true);
eq("named: another day's date", isUntitledJournal("2026 നവംബർ 27, വെള്ളിയാഴ്ച", created), false);
eq("named: date without createdAt", isUntitledJournal("2026 നവംബർ 28, ശനിയാഴ്ച", null), false);
eq("named: own title", isUntitledJournal("ഉമ്മയുടെ പത്തിരി", created), false);

const content = starterContent("diary");
eq("keep: new journal, date title, no text", keepOnClose({ title: journalTitle(d), kind: "diary", content, createdAt: created }), false);
eq("keep: new journal, own title", keepOnClose({ title: "ബസ് സ്റ്റോപ്പിൽ", kind: "diary", content, createdAt: created }), true);
const written = { type: "doc", content: [...(content.content ?? []), { type: "paragraph", content: [{ type: "text", text: "അമ്മച്ചി അപ്പം ഉണ്ടാക്കി." }] }] };
eq("keep: date title + text", keepOnClose({ title: journalTitle(d), kind: "diary", content: written, createdAt: created }), true);
eq("keep: story default title, no text", keepOnClose({ title: "പുതിയ ചെറുകഥ", kind: "story", content: starterContent("story") }), false);

console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
