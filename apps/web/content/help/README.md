# Litma Help: how to add or change a guide

The help site at **getlitma.in/help/** is built from the Markdown files in this folder when the
website is built (`app/help/page.tsx` reads them through `src/lib/help.ts`). Edit a file, push, and
the site updates. The desktop app (Help → Litma Help, Settings → Help and guide) and the phone app
(Settings → Help and guide) open the website's help in the browser, so they need no release for
new guides.

## Files

- One file per topic, named `NN-topic.md`. `NN` sets the order of the topic cards.
- The file starts with front matter:

  ```
  ---
  id: books
  title: Books and covers
  ml: പുസ്തകങ്ങൾ
  summary: One or two lines for the topic card on the help home page.
  icon: book-open
  tint: coral
  ---
  ```

  `icon` is one of: rocket, keyboard, pen-line, layout-template, map, book-a, book-open, share-2,
  sparkles, monitor-smartphone, settings (add more in `ICONS` in `components/help/HelpCenter.tsx`).
  `tint` is one of: violet, coral, sky, lime, tangerine (the home page's colours).
- Text before the first `##` is the topic's introduction (shown on the topic page).
- Each `## Title {#article-id}` starts a guide. The id goes in the address (`/help/?a=article-id`) and
  must be unique across all files (the build stops if two match). Don't change an id once it is
  live; links to it would break.
- The first paragraph of a guide is its summary on cards and in search, so make it one or two
  plain sentences.

## Writing a guide

- `### Heading` makes a section; guides with two or more get an "On this page" list.
- Numbered lists (`1.`) are drawn as steps with lime number circles. Bullets are plain lists.
- Pictures: `![What the picture shows](shots/name.webp "Optional caption")`. Files live in
  `apps/web/public/help/shots/`. Name phone screenshots `phone-*.webp`; they are drawn narrow,
  like a phone. Two or more pictures in one paragraph (on consecutive lines) sit side by side.
- Callouts: start a quote with `**Tip:**`, `**Note:**`, `**Good to know:**`, `**Phone:**` or
  `**Desktop:**`, e.g. `> **Tip:** Press Ctrl + M to switch.`
- Keys: `<kbd>Ctrl</kbd> + <kbd>M</kbd>`.
- Link to another guide with its id: `[design the cover](#cover-designer)`.

## Screenshots

- Website and desktop: 1440 × 900 window, saved as WebP (quality about 80) and at most 1600 px wide.
  The desktop app looks the same as the website, so one picture serves both.
- Phone: the CI screenshots on the `ci/phone-screens` branch (`git fetch origin ci/phone-screens`),
  saved as WebP at 600 px wide.
- Sample text in pictures follows the fairness rule in CLAUDE.md: names and places from all of
  Kerala's communities, no religious terms.

## House style

Plain words, short sentences, no em dashes. Say "writing type" (സാഹിത്യരൂപം), "Story World"
(കഥാലോകം), "മേൽക്കുറിപ്പ്" for an epigraph, and "any AI assistant" rather than naming vendors
(except where the writer has to pick one in Litma, like the AI key providers). Every guide should
say what differs on the phone app when something does.
