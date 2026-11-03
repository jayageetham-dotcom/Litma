/** Format conventions handed to AI assistants over MCP so their suggestions fit the page. */
export const WRITING_GUIDES: Record<string, string> = {
  screenplay: `Malayalam screenplay (തിരക്കഥ) format used in Litma:
- Each scene starts with an auto-numbered heading ("രംഗം 1", or "Scene 1" if the writer chose English), then the location line (e.g. "Int./Resort", "Ext./Boat jetty"), then the time ("പകൽ" / "രാത്രി" / "സന്ധ്യ"), then the cast in the scene listed on the right.
- Action/description (രംഗവിവരണം) sits in the left half of the page, in present tense.
- Dialogue is two columns: character name right-aligned with a colon on the left, speech on the right. Parentheticals go before the name: "(കടലിലേക്ക് നോക്കി) പ്രിയലാൽ: …".
- When writing text for append_to_document, use lines like "Scene: Int./Beach", "പകൽ", "ഡെന്നി: സമയമെത്രായടാ?" and plain lines for action. Don't write the scene number yourself.
- Story World holds characters, locations and props for the script (list_story_items / create_story_item).`,
  drama: `Malayalam stage play (നാടകം): a cast list (കഥാപാത്രങ്ങൾ: name and one-line description), acts and scenes numbered automatically, stage directions in parentheses, dialogue as "പേര്: സംഭാഷണം".
- For append_to_document: "## അങ്കം" (or "## Act") starts an act, "## രംഗം" (or "## Scene") a scene; anything after it on that line is kept as the scene's place or time ("## രംഗം: പാലത്തിനടുത്ത്, സന്ധ്യ"). Don't write the numbers yourself.
- "(…)" on its own line is a stage direction; "പേര്: സംഭാഷണം" is a line of dialogue.`,
  poem: `Malayalam poem (കവിത): one line per line, blank line between stanzas; "### " starts a numbered stanza (text after it is an optional stanza title). Litma can show akshara counts and laghu/guru marks for metre (വൃത്തം); respect rhythm and prasam.`,
  lyrics: `Song lyrics: parts are labelled with "### പല്ലവി", "### അനുപല്ലവി", "### ചരണം"; one sung line per line; keep syllable counts matched between corresponding lines. Under the title, a song details line can name the film or album, music and singers.`,
  novel: `Novel: "## Chapter title" for chapters (Litma can number them), "* * *" for scene breaks, paragraphs separated by blank lines. Literary Malayalam prose.`,
  story: `Short story: title, author, then prose paragraphs separated by blank lines; "* * *" for section breaks.`,
  feature: `Feature article: kicker, headline, standfirst (2-line summary), byline, then body with "### subheads", occasional pull quotes and info boxes. Footnotes go inline as "text^[the note]".`,
  essay: `Essay/article: title, subtitle, author, argument in paragraphs with "### subheads". Footnotes go inline as "text^[the note or source]"; Litma numbers them and lists them at the end.`,
  diary: `Diary/memoir: dated entries (the date line starts each entry); first person; paragraphs separated by blank lines.`,
  blank: `Free-form Malayalam writing. Paragraphs separated by blank lines; "# " for a title.`,
};
