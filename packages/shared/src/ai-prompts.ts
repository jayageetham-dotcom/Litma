export const AI_ACTIONS = {
  continue: { label: "Continue writing", ml: "തുടർന്നെഴുതുക", needsSelection: false },
  rewrite: { label: "Rewrite", ml: "മാറ്റിയെഴുതുക", needsSelection: true },
  polish: { label: "Polish language", ml: "ഭാഷ മിനുക്കുക", needsSelection: true },
  proofread: { label: "Proofread", ml: "തെറ്റുതിരുത്തുക", needsSelection: true },
  synonyms: { label: "Synonyms", ml: "പര്യായങ്ങൾ", needsSelection: true },
  rhymes: { label: "Rhymes (പ്രാസം)", ml: "പ്രാസം", needsSelection: true },
  dialogue: { label: "Dialogue ideas", ml: "സംഭാഷണം", needsSelection: false },
  describe: { label: "Describe the scene", ml: "വിവരണം", needsSelection: false },
  titles: { label: "Title ideas", ml: "ശീർഷകങ്ങൾ", needsSelection: false },
  summarize: { label: "Summarise", ml: "സംഗ്രഹം", needsSelection: false },
  toMalayalam: { label: "Translate to Malayalam", ml: "മലയാളത്തിലേക്ക്", needsSelection: true },
  toEnglish: { label: "Translate to English", ml: "ഇംഗ്ലീഷിലേക്ക്", needsSelection: true },
  critique: { label: "Editor's notes", ml: "നിരൂപണം", needsSelection: false },
  custom: { label: "Ask anything", ml: "ചോദിക്കൂ", needsSelection: false },
} as const;
export type AIAction = keyof typeof AI_ACTIONS;

const FORM_NAMES: Record<string, string> = {
  novel: "a Malayalam novel (നോവൽ)",
  story: "a Malayalam short story (ചെറുകഥ)",
  poem: "a Malayalam poem (കവിത); respect line breaks, rhythm (വൃത്തം) and prasam",
  screenplay:
    "a Malayalam film screenplay (തിരക്കഥ) in the Kerala format: Scene headings, time (പകൽ/രാത്രി), cast list, action in present tense, and dialogue written as 'കഥാപാത്രം: സംഭാഷണം' with optional (parentheticals)",
  feature: "a Malayalam feature article for a magazine",
  essay: "a Malayalam essay or article (ലേഖനം), with footnotes and references where facts need a source",
  drama: "a Malayalam stage play (നാടകം) with acts (അങ്കം), scenes (രംഗം), stage directions in parentheses and dialogue as 'പേര്: സംഭാഷണം'",
  lyrics: "Malayalam song lyrics (പല്ലവി, അനുപല്ലവി, ചരണം) that must be singable",
  diary: "a Malayalam diary or memoir entry",
  blank: "a Malayalam piece of writing",
};

export function systemPrompt(kind: string) {
  return `You are Litma's writing companion, a senior Malayalam literary editor. The writer is working on ${FORM_NAMES[kind] ?? FORM_NAMES.blank}.
Rules:
- Write in natural, literary Malayalam Unicode unless asked for English. Never use Manglish/romanised Malayalam in output.
- Match the writer's voice, register, dialect and tense. Keep names and facts consistent with the context.
- Output only the text requested — no preamble, no "here is", no markdown headings — unless the action asks for a list.`;
}

export function userPrompt(action: AIAction, opts: { selection?: string; context?: string; instruction?: string }) {
  const sel = opts.selection?.trim();
  const ctx = opts.context?.trim().slice(-6000);
  const ask = opts.instruction?.trim();
  const C = ctx ? `\n\nText so far (most recent part):\n"""${ctx}"""` : "";
  const S = sel ? `\n\nSelected passage:\n"""${sel}"""` : "";
  switch (action) {
    case "continue":
      return `Continue the writing naturally from where it stops, about 120–200 words, in the same style.${ask ? ` Direction: ${ask}` : ""}${C}`;
    case "rewrite":
      return `Rewrite the selected passage, keeping its meaning but making it more vivid.${ask ? ` Direction: ${ask}` : ""}${S}${C}`;
    case "polish":
      return `Polish the selected passage: fix grammar, sandhi, spelling and flow without changing the voice. Return only the corrected passage.${S}`;
    case "proofread":
      return `Proofread the selected Malayalam passage. List each error as "തെറ്റ് → ശരി — short reason", then give the corrected passage.${S}`;
    case "synonyms":
      return `Give 8–12 Malayalam synonyms or near-synonyms for the selected word or phrase, each with a 3–6 word note on its shade of meaning, as a list.${S}`;
    case "rhymes":
      return `Suggest Malayalam words and short phrases that rhyme with or carry ദ്വിതീയാക്ഷരപ്രാസം / അന്ത്യപ്രാസം matching the selection. Group them by prasam type, as a list.${S}`;
    case "dialogue":
      return `Suggest 3 alternative short exchanges of dialogue that could come next, true to the characters.${ask ? ` Direction: ${ask}` : ""}${S}${C}`;
    case "describe":
      return `Write a short sensory description (60–120 words) of the current scene or setting to add here.${ask ? ` Focus: ${ask}` : ""}${C}`;
    case "titles":
      return `Suggest 8 evocative Malayalam titles for this work, as a list.${C}`;
    case "summarize":
      return `Summarise the text so far in 5–7 Malayalam sentences.${S || C}`;
    case "toMalayalam":
      return `Translate the selection into natural literary Malayalam.${S}`;
    case "toEnglish":
      return `Translate the selection into natural English, preserving tone. Output English.${S}`;
    case "critique":
      return `Act as an editor. Give 5–7 concise, specific notes on what works and what to improve (pacing, imagery, character, language), in Malayalam.${S || C}`;
    case "custom":
    default:
      return `${ask || "Help me with this text."}${S}${C}`;
  }
}
