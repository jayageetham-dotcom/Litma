import type { DocKind } from "@/lib/types";
import { settingsFor } from "@/lib/templates";

/** Real-looking first pages for each writing type (സാഹിത്യരൂപം), rendered with the same CSS as the editor. */
const SAMPLES: Record<DocKind, string> = {
  novel: `<p class="sb sb-chapter">കടൽ കാണാത്ത വീട്</p>
<p>അന്ന് രാത്രി മഴ തോർന്നിരുന്നില്ല. ഇടവഴിയിലെ ചെളിയിൽ കാൽ പൂഴ്ത്തി നടക്കുമ്പോൾ അയാൾ അമ്മയുടെ ശബ്ദം ഓർത്തു. വാതിൽ തുറന്നു കിടന്നിരുന്നു; അകത്ത് ഒരു മണ്ണെണ്ണ വിളക്ക് മാത്രം.</p>
<p>പുഴക്കരയിലെ ആ വീട്ടിൽ ആരും കടൽ കണ്ടിട്ടില്ലായിരുന്നു. എന്നിട്ടും എല്ലാ രാത്രികളിലും തിരമാലകളുടെ ഒച്ച അവരുടെ ഉറക്കത്തിലേക്ക് കയറിവന്നു.</p>
<hr><p>പിറ്റേന്ന് രാവിലെ കുട്ടികൾ മുറ്റത്ത് ഒത്തുകൂടി.</p>`,
  story: `<p class="sb sb-title">മഴയുടെ വിലാസം</p><p class="sb sb-author">അനു മേനോൻ</p>
<p>സ്റ്റേഷനിലെ ബെഞ്ചിൽ അവൾ ഒറ്റയ്ക്കിരുന്നു. അവസാനത്തെ വണ്ടി പോയിക്കഴിഞ്ഞിരുന്നു. കയ്യിലെ കത്തിൽ വിലാസം മഴവെള്ളം വീണ് മാഞ്ഞുപോയിരുന്നു.</p>
<p>"ഇനി എങ്ങോട്ട്?" കാവൽക്കാരൻ ചോദിച്ചു.</p>`,
  poem: `<p class="sb sb-title">പുഴ</p>
<p>ഇരുകരയും ചേർത്തു പിടിച്ചൊഴുകും</p><p>ഇടവപ്പാതിയിലെ പുഴയുടെ പാട്ട്</p><p>ഇലകളിലൂടെ വീഴുന്ന നേരം</p><p>ഇനിയും പറയാത്ത വാക്കുകളായ്</p><p></p>
<p>കടവത്തു നിൽക്കുന്നു ഞാനുമൊരാളായ്</p><p>കാലം കടന്നുപോം തോണിയെ നോക്കി</p>`,
  screenplay: `<h3 class="sp-scene">Int./Resort</h3><p class="sp-time">പകൽ</p><p class="sp-cast">പ്രിയലാൽ<br>ഡെന്നി<br>ഷിബു</p>
<p class="sp-action">മുറിയുടെ ജനലിലൂടെ മനോഹരിയായ കടൽ. ആഞ്ഞടിക്കുന്ന തിരമാലകൾ. വിശാലമായ കടൽ.</p>
<div class="sp-dialogue"><div class="sp-cue">ഡെന്നി</div><div class="sp-speech">സമയമെത്രായടാ?</div></div>
<div class="sp-dialogue"><div class="sp-cue">(കടലിലേക്ക് നോക്കി) പ്രിയലാൽ</div><div class="sp-speech">എത്രയായാലെന്താടാ.. നമുക്ക് തോന്നുമ്പോ ഉറങ്ങാം തോന്നുമ്പോ എണീക്കാം.</div></div>`,
  feature: `<p class="sb sb-kicker">യാത്ര</p><p class="sb sb-title">കായലിന്റെ നിശ്ശബ്ദത</p>
<p class="sb sb-standfirst">കുട്ടനാട്ടിലെ ഒരു പകൽ — വെള്ളത്തിനു മുകളിൽ ജീവിക്കുന്നവരുടെ കഥകൾ.</p><p class="sb sb-byline">എഴുതിയത്: രാഹുൽ കെ.</p>
<p>പുലർച്ചെ അഞ്ചു മണിക്ക് ആദ്യത്തെ വള്ളം ഇറങ്ങും. തെങ്ങിൻതോപ്പുകൾക്കിടയിലൂടെ മഞ്ഞ് പതുക്കെ മാറുന്നു.</p>
<p class="sb sb-pullquote">"വെള്ളമാണ് ഞങ്ങളുടെ വഴി."</p>`,
  essay: `<p class="sb sb-title">ഭാഷയും ഓർമ്മയും</p><p class="sb sb-author">ഡോ. എസ്. നായർ</p>
<p>ഒരു ഭാഷ നഷ്ടപ്പെടുമ്പോൾ നഷ്ടമാകുന്നത് വാക്കുകൾ മാത്രമല്ല; ഒരു സമൂഹം ലോകത്തെ കണ്ട രീതി കൂടിയാണ്.</p>
<p class="sb sb-subhead">വാമൊഴിയുടെ ശക്തി</p><p>നാട്ടുപാട്ടുകളിലും പഴഞ്ചൊല്ലുകളിലും ഈ ഓർമ്മ ജീവിക്കുന്നു.</p>`,
  drama: `<p class="sb sb-chapter">രംഗം ഒന്ന്</p><p class="sb sb-stage">ഒരു പഴയ ചായക്കട. സന്ധ്യ. വേലു ബെഞ്ച് തുടയ്ക്കുന്നു.</p>
<div class="sp-dialogue"><div class="sp-cue">വേലു</div><div class="sp-speech">ഇന്നും ആരും വന്നില്ല.</div></div>
<div class="sp-dialogue"><div class="sp-cue">മാധവി</div><div class="sp-speech">മഴയല്ലേ, ആളുകൾ വീട്ടിലിരിക്കും.</div></div>`,
  lyrics: `<p class="sb sb-title">നിലാവിൻ തീരം</p><p class="sb sb-part">പല്ലവി</p>
<p>നിലാവിൻ തീരത്തൊരു</p><p>നീലക്കടമ്പു പൂത്തു</p><p class="sb sb-part">അനുപല്ലവി</p><p>കാറ്റിൻ ചിറകിലേറി</p><p>കനവുകൾ പാറി വന്നു</p>`,
  diary: `<p class="sb sb-dateline">2026 ഒക്ടോബർ 31, ശനി</p>
<p>ഇന്ന് പുലർച്ചെ മഴ. ജനലരികിലിരുന്ന് ചായ കുടിക്കുമ്പോൾ പഴയ ഡയറിയുടെ താളുകൾ മറിച്ചു നോക്കി.</p>
<p>എഴുതാൻ തുടങ്ങിയ നോവലിന്റെ ആദ്യ അദ്ധ്യായം ഇനിയും പൂർത്തിയായിട്ടില്ല.</p>`,
  blank: `<p></p>`,
};

const PAGE_PX = 793.7; // 210mm

export function TemplatePreview({ kind, width = 168 }: { kind: DocKind; width?: number }) {
  const s = settingsFor(kind);
  const scale = width / PAGE_PX;
  const style = {
    "--page-w": "210mm",
    "--page-h": "297mm",
    "--m-top": `${s.margins.top}mm`,
    "--m-right": `${s.margins.right}mm`,
    "--m-bottom": `${s.margins.bottom}mm`,
    "--m-left": `${s.margins.left}mm`,
    "--doc-font": `'${s.font}'`,
    "--doc-size": `${s.fontSize}pt`,
    "--doc-lh": s.lineHeight,
  } as React.CSSProperties;
  return (
    <div
      className="relative overflow-hidden rounded-[2px] bg-paper"
      style={{ width, height: width * (297 / 210), boxShadow: "var(--sheet-shadow)" }}
      aria-hidden
    >
      <div className={`tpl-${kind} ${kind === "poem" || kind === "lyrics" ? "" : ""}`} style={{ ...style, width: PAGE_PX, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <div className="ProseMirror" style={{ minHeight: 0 }} dangerouslySetInnerHTML={{ __html: SAMPLES[kind] }} />
      </div>
    </div>
  );
}
