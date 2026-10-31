/** Format conventions handed to AI assistants over MCP so their suggestions fit the page. */
export const WRITING_GUIDES: Record<string, string> = {
  screenplay: `Malayalam screenplay (തിരക്കഥ) format used in Litma:
- Each scene starts with an auto-numbered heading "Scene: N", then the location line (e.g. "Int./Resort"), then the time ("പകൽ" / "രാത്രി"), then the cast in the scene listed on the right.
- Action/description (രംഗവിവരണം) sits in the left half of the page, in present tense.
- Dialogue is two columns: character name right-aligned with a colon on the left, speech on the right. Parentheticals go before the name: "(കടലിലേക്ക് നോക്കി) പ്രിയലാൽ: …".
- When writing text for append_to_document, use lines like "Scene: Int./Beach", "പകൽ", "ഡെന്നി: സമയമെത്രായടാ?" and plain lines for action.
- Story World holds characters, locations and props for the script (list_story_items / create_story_item).`,
  drama: `Malayalam stage play (നാടകം): "## രംഗം ഒന്ന്" headings, stage directions in parentheses "(…)", dialogue as "പേര്: സംഭാഷണം".`,
  poem: `Malayalam poem (കവിത): one line per line, blank line between stanzas. Litma shows akshara counts and laghu/guru marks for metre (വൃത്തം); respect rhythm and prasam.`,
  lyrics: `Song lyrics: parts are labelled with "### പല്ലവി", "### അനുപല്ലവി", "### ചരണം"; one sung line per line; keep syllable counts matched between corresponding lines.`,
  novel: `Novel: "## Chapter title" for chapters, "* * *" for scene breaks, paragraphs separated by blank lines. Literary Malayalam prose.`,
  story: `Short story: title, author, then prose paragraphs separated by blank lines; "* * *" for section breaks.`,
  feature: `Feature article: kicker, headline, standfirst (2-line summary), byline, then body with "### subheads" and occasional pull quotes.`,
  essay: `Essay/article: title, author, argument in paragraphs with "### subheads".`,
  diary: `Diary/memoir: dated entries; first person; paragraphs separated by blank lines.`,
  blank: `Free-form Malayalam writing. Paragraphs separated by blank lines; "# " for a title.`,
};
