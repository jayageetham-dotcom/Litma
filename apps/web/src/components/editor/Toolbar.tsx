"use client";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Languages,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Search,
  Strikethrough,
  Subscript as SubIcon,
  Superscript as SupIcon,
  Underline as UIcon,
  Undo2,
  Asterisk,
  RemoveFormatting,
  ChevronDown,
  Type,
  AudioLines,
  BookA,
  Sparkles,
  Copy,
  X,
  CalendarPlus,
  Users,
  Minus,
  Plus,
} from "lucide-react";
import { useT } from "@/i18n/react";
import type { Template } from "@/lib/templates";
import { FONTS } from "@/lib/templates";
import { BLOCK_VARIANTS, appendDiaryEntry, insertStyledBlock, refrainText } from "@/extensions/blocks";
import { SCENE_PLACES, SCENE_TIMES, SCREENPLAY_ELEMENTS, fillSceneCast, setSceneTime, setScenePlace, setScreenplayElement, setStageDirection } from "@/extensions/screenplay";
import { FOOTNOTE_EVENT } from "@/extensions/footnote";
import { todayLine } from "@litma/shared/forms";
import type { InputMode } from "@/extensions/manglish";
import { Select } from "@/components/ui/Select";
import { boldIsOn } from "@/extensions/bold";
import { FONT_SIZES, currentFontSize, stepFontSize } from "@/extensions/font-size";
import { HighlightTool, TextColorTool } from "./ColorTools";
import { MalayalamLayoutPicker } from "./KeyboardTools";

function Btn({
  onClick,
  active,
  title,
  children,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={`grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-[13px] transition-colors disabled:opacity-35 ${
        active ? "bg-accent-soft text-accent" : "text-ink hover:bg-subtle"
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />;


export function InputModeSwitch({ mode, onChange }: { mode: InputMode; onChange: (m: InputMode) => void }) {
  const opts: [InputMode, string, string][] = [
    ["manglish", "Manglish", "Type in English letters, get Malayalam (Ctrl/⌘ + M to switch)"],
    ["malayalam", "മലയാളം", "Type Malayalam: Litma's InScript keyboard, or your device's own Malayalam keyboard"],
    ["english", "English", "Plain English typing"],
  ];
  return (
    <div className="flex shrink-0 rounded-lg bg-subtle p-0.5 text-[12.5px]" role="radiogroup" aria-label="Input mode">
      {opts.map(([m, l, t]) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          title={t}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(m)}
          className={`rounded-md px-2.5 py-1 ${mode === m ? "bg-paper font-semibold text-accent shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Toolbar({
  editor,
  template,
  mode,
  onMode,
  onFind,
  variant = "bar",
  metre,
  onFillCast,
}: {
  editor: Editor;
  template: Template;
  mode: InputMode;
  onMode: (m: InputMode) => void;
  onFind: () => void;
  /** "bar": one scrolling row under the top bar · "sheet": wrapped, touch-sized, inside the phone's Format sheet */
  variant?: "bar" | "sheet";
  /** poems and lyrics: show/hide akshara counts and laghu–guru marks */
  metre?: { on: boolean; toggle: () => void };
  /** plays: add Story World characters to the cast list */
  onFillCast?: () => void;
}) {
  const t = useT();
  const e = editor;
  const chain = () => e.chain().focus();

  // current block for the style picker
  const { $from } = e.state.selection;
  const parentName = $from.parent.type.name;
  let current = "paragraph";
  if (parentName === "heading") current = `h${$from.parent.attrs.level}`;
  else if (parentName === "styledBlock") current = `sb:${$from.parent.attrs.variant}`;
  else if (parentName !== "paragraph") current = parentName;

  const setStyle = (v: string) => {
    if (v === "paragraph") chain().setParagraph().run();
    else if (v === "hr") chain().setHorizontalRule().run();
    else if (v.startsWith("h")) chain().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
    else if (v === "sb:refrain") {
      // a repeat line starts as the first words of the പല്ലവി
      const empty = $from.parent.isTextblock && $from.parent.content.size === 0;
      if (empty || parentName !== "paragraph") insertStyledBlock(e, "refrain", refrainText(e.state.doc) || undefined);
      else chain().setNode("styledBlock", { variant: "refrain" }).run();
    } else if (v === "sb:stanza" && parentName === "paragraph" && $from.parent.content.size > 0) {
      // a stanza number goes above the line the cursor is on
      insertStyledBlock(e, "stanza", undefined, "before");
    } else if (v.startsWith("sb:")) {
      // headings of a play go in as their own line when the cursor is in speech or a cast entry
      if (!$from.parent.isTextblock || $from.depth > 1) insertStyledBlock(e, v.slice(3));
      else chain().setNode("styledBlock", { variant: v.slice(3) }).run();
    }
  };

  const font = (e.getAttributes("textStyle").fontFamily as string | undefined)?.replace(/['"]/g, "") ?? "";
  const inScreenplay = template.screenplay;
  const usesDialogue = template.screenplay || template.dialogue;
  const isDrama = template.kind === "drama";
  const scriptButton = (key: string, ml: string, en: string, active: boolean, run: () => void, hint?: string) => (
    <button
      key={key}
      type="button"
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={run}
      title={hint ?? en}
      className={`flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[13px] ${active ? "bg-accent text-accent-ink" : "hover:bg-subtle"}`}
    >
      {ml}
      <span className="text-[11px] opacity-70">{en}</span>
    </button>
  );

  return (
    <div
      className={
        variant === "sheet"
          ? "no-print flex flex-wrap items-center gap-1 [&>span[aria-hidden]]:hidden [&_button]:min-h-10 [&_button]:min-w-10 [&_[role=combobox]]:min-h-10"
          : "no-print scrollbar-thin flex items-center gap-0.5 overflow-x-auto border-b border-line bg-paper px-3 py-1.5"
      }
      role="toolbar"
      aria-label="Formatting"
    >
      <Btn title="Undo (Ctrl+Z)" onClick={() => chain().undo().run()} disabled={!e.can().undo()}>
        <Undo2 size={16} />
      </Btn>
      <Btn title="Redo (Ctrl+Shift+Z)" onClick={() => chain().redo().run()} disabled={!e.can().redo()}>
        <Redo2 size={16} />
      </Btn>
      <Sep />
      <InputModeSwitch mode={mode} onChange={onMode} />
      {mode === "malayalam" && <MalayalamLayoutPicker editor={e} size={variant === "sheet" ? "md" : "sm"} />}
      <Sep />

      {!inScreenplay && (
        <Select
          size={variant === "sheet" ? "md" : "sm"}
          className={variant === "sheet" ? "w-full sm:w-auto sm:min-w-48" : "min-w-36"}
          preventFocusSteal
          aria-label="Paragraph style"
          value={current.startsWith("sb:") || current.startsWith("h") || current === "paragraph" ? current : ""}
          placeholder="—"
          onChange={setStyle}
          options={[
            { value: "paragraph", label: "Body text" },
            ...template.blocks.map((v) => ({ value: `sb:${v}`, label: `${BLOCK_VARIANTS[v].ml} · ${BLOCK_VARIANTS[v].label}` })),
            ...(template.sceneBreak ? [{ value: "hr", label: template.kind === "novel" ? "⁂ രംഗഭേദം · Scene break" : "⁂ ഭാഗഭേദം · Section break" }] : []),
            { value: "h1", label: "Heading 1" },
            { value: "h2", label: "Heading 2" },
            { value: "h3", label: "Heading 3" },
          ]}
        />
      )}

      {usesDialogue && (
        <div className="flex shrink-0 items-center gap-0.5" aria-label="Script elements">
          {SCREENPLAY_ELEMENTS.filter((x) => inScreenplay || x.type === "dialogue").map((el) => {
            const active = parentName === el.type || (el.type === "dialogue" && (parentName === "dialogueCue" || parentName === "dialogueSpeech"));
            return scriptButton(el.type, el.ml, el.label, active, () => setScreenplayElement(e, el.type), `${el.label} (Ctrl+Alt+${el.key})`);
          })}
          {isDrama && (
            <>
              {scriptButton("stage", "രംഗനിർദ്ദേശം", "Stage direction", current === "sb:stage", () => setStageDirection(e))}
              {scriptButton("scene", "രംഗം", "Scene", current === "sb:scene", () => insertStyledBlock(e, "scene"), t("editor.drama.sceneHint"))}
              {scriptButton("act", "അങ്കം", "Act", current === "sb:act", () => insertStyledBlock(e, "act"), t("editor.drama.actHint"))}
              {onFillCast && (
                <button
                  type="button"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={onFillCast}
                  title={t("editor.drama.fillCastHint")}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] hover:bg-subtle"
                >
                  <Users size={15} className="text-tint-lime" aria-hidden /> {t("editor.drama.fillCast")}
                </button>
              )}
            </>
          )}
          {inScreenplay && (
            <>
              <Select
                size={variant === "sheet" ? "md" : "sm"}
                className="ml-1"
                preventFocusSteal
                aria-label={t("editor.scene.tools")}
                value=""
                placeholder={t("editor.scene.tools")}
                onChange={(v) => {
                  if (v.startsWith("place:")) setScenePlace(e, v.slice(6));
                  else if (v.startsWith("time:")) setSceneTime(e, v.slice(5));
                  else if (v === "cast") fillSceneCast(e);
                }}
                options={[
                  ...SCENE_PLACES.map((p) => ({ value: `place:${p}`, label: p, hint: p === "Int./" ? "അകത്ത് · Interior" : p === "Ext./" ? "പുറത്ത് · Exterior" : "Interior and exterior" })),
                  ...SCENE_TIMES.map((x) => ({ value: `time:${x}`, label: x, hint: t("editor.scene.time") })),
                  { value: "cast", label: t("editor.scene.fillCast"), hint: t("editor.scene.fillCastHint") },
                ]}
              />
              <Select
                size={variant === "sheet" ? "md" : "sm"}
                className="ml-1"
                preventFocusSteal
                aria-label="Insert a title-page block"
                value=""
                placeholder="Title page…"
                onChange={(v) => v && setStyle(v)}
                options={template.blocks.map((v) => ({ value: `sb:${v}`, label: BLOCK_VARIANTS[v].ml, hint: BLOCK_VARIANTS[v].label }))}
              />
            </>
          )}
        </div>
      )}
      {template.kind === "diary" && (
        <button
          type="button"
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={() => appendDiaryEntry(e, todayLine())}
          title={t("editor.diary.newEntryHint")}
          className="ml-1 flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] hover:bg-subtle"
        >
          <CalendarPlus size={15} className="text-tint-sky" aria-hidden /> {t("editor.diary.newEntry")}
        </button>
      )}
      <Sep />

      <Select
        size={variant === "sheet" ? "md" : "sm"}
        className={variant === "sheet" ? "w-full sm:w-auto sm:min-w-48" : "w-40"}
        preventFocusSteal
        aria-label="Font for selected text"
        title="Font for selected text"
        value={font}
        onChange={(v) => (v ? chain().setFontFamily(`'${v}'`).run() : chain().unsetFontFamily().run())}
        options={[{ value: "", label: "Document font" }, ...FONTS.map((f) => ({ value: f.name, label: f.name, style: { fontFamily: `'${f.name}'` } }))]}
      />
      {(() => {
        // font size of the selection, in points, like a word processor: − [12] +
        const size = currentFontSize(e);
        const own = !!e.getAttributes("textStyle").fontSize;
        const shown = size ?? 12;
        const list = [...new Set([...FONT_SIZES, shown])].sort((a, b) => a - b);
        return (
          <div className="flex shrink-0 items-center" role="group" aria-label={t("editor.fontSize.label")}>
            <Btn title={t("editor.fontSize.smaller")} onClick={() => chain().setFontSize(stepFontSize(shown, -1)).run()} disabled={shown <= FONT_SIZES[0]}>
              <Minus size={14} />
            </Btn>
            <Select
              size={variant === "sheet" ? "md" : "sm"}
              className={variant === "sheet" ? "w-24" : "w-[4.5rem]"}
              preventFocusSteal
              aria-label={t("editor.fontSize.label")}
              title={t("editor.fontSize.label")}
              value={own ? String(shown) : ""}
              placeholder={String(shown)}
              onChange={(v) => (v === "auto" ? chain().unsetFontSize().run() : v && chain().setFontSize(Number(v)).run())}
              options={[{ value: "auto", label: t("editor.fontSize.auto"), hint: t("editor.fontSize.autoHint") }, ...list.map((n) => ({ value: String(n), label: String(n) }))]}
            />
            <Btn title={t("editor.fontSize.bigger")} onClick={() => chain().setFontSize(stepFontSize(shown, 1)).run()} disabled={shown >= FONT_SIZES[FONT_SIZES.length - 1]}>
              <Plus size={14} />
            </Btn>
          </div>
        );
      })()}
      <Sep />

      <Btn title="Bold (Ctrl+B)" active={boldIsOn(e)} onClick={() => chain().toggleSmartBold().run()}>
        <Bold size={16} />
      </Btn>
      <Btn title="Italic (Ctrl+I)" active={e.isActive("italic")} onClick={() => chain().toggleItalic().run()}>
        <Italic size={16} />
      </Btn>
      <Btn title="Underline (Ctrl+U)" active={e.isActive("underline")} onClick={() => chain().toggleUnderline().run()}>
        <UIcon size={16} />
      </Btn>
      <Btn title="Strikethrough" active={e.isActive("strike")} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough size={16} />
      </Btn>
      <Btn title="Superscript" active={e.isActive("superscript")} onClick={() => chain().toggleSuperscript().run()}>
        <SupIcon size={16} />
      </Btn>
      <Btn title="Subscript" active={e.isActive("subscript")} onClick={() => chain().toggleSubscript().run()}>
        <SubIcon size={16} />
      </Btn>

      <TextColorTool editor={e} size={variant} />
      <HighlightTool editor={e} size={variant} />
      <Btn title="Clear formatting" onClick={() => chain().unsetAllMarks().run()}>
        <RemoveFormatting size={16} />
      </Btn>
      <Btn
        title="Link"
        active={e.isActive("link")}
        onClick={() => {
          const prev = e.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link address", prev ?? "https://");
          if (url === null) return;
          if (url === "") chain().unsetLink().run();
          else chain().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        <Link2 size={16} />
      </Btn>
      <Sep />

      {(() => {
        // alignment works on titles, headings, paragraphs and action lines; screenplay scene/dialogue blocks keep their layout
        const canAlign = ["paragraph", "heading", "styledBlock", "action", "transition"].includes(parentName);
        const why = canAlign ? "" : " (not available for this script element)";
        return (
          <>
            <Btn title={`Align left${why}`} disabled={!canAlign} active={canAlign && e.isActive({ textAlign: "left" })} onClick={() => chain().setTextAlign("left").run()}>
              <AlignLeft size={16} />
            </Btn>
            <Btn title={`Centre${why}`} disabled={!canAlign} active={canAlign && e.isActive({ textAlign: "center" })} onClick={() => chain().setTextAlign("center").run()}>
              <AlignCenter size={16} />
            </Btn>
            <Btn title={`Align right${why}`} disabled={!canAlign} active={canAlign && e.isActive({ textAlign: "right" })} onClick={() => chain().setTextAlign("right").run()}>
              <AlignRight size={16} />
            </Btn>
            <Btn title={`Justify${why}`} disabled={!canAlign} active={canAlign && e.isActive({ textAlign: "justify" })} onClick={() => chain().setTextAlign("justify").run()}>
              <AlignJustify size={16} />
            </Btn>
          </>
        );
      })()}
      <Sep />
      {!inScreenplay && (
        <>
          <Btn title="Bulleted list" active={e.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()}>
            <List size={16} />
          </Btn>
          <Btn title="Numbered list" active={e.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()}>
            <ListOrdered size={16} />
          </Btn>
          <Btn title="Quotation" active={e.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()}>
            <Quote size={16} />
          </Btn>
          <Btn title="Scene break ⁂" onClick={() => chain().setHorizontalRule().run()}>
            <Asterisk size={16} />
          </Btn>
          {template.footnotes && (
            <Btn title={t("editor.footnote.add")} onClick={() => window.dispatchEvent(new CustomEvent(FOOTNOTE_EVENT, { detail: {} }))}>
              <span className="text-[12px] font-semibold">¹</span>
            </Btn>
          )}
        </>
      )}
      <Sep />
      <Btn title="Convert selected Manglish to Malayalam (Ctrl+Shift+M)" onClick={() => chain().convertSelectionToMalayalam().run()} disabled={e.state.selection.empty}>
        <Languages size={16} />
      </Btn>
      <Btn title="Find and replace (Ctrl+F)" onClick={onFind}>
        <Search size={16} />
      </Btn>
      {metre && (
        <>
          <Sep />
          <button
            type="button"
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={metre.toggle}
            aria-pressed={metre.on}
            aria-label="Metre marks (വൃത്തം)"
            title={`${metre.on ? "Hide" : "Show"} metre: akshara count and laghu (∪) / guru (–) marks (Ctrl+Alt+V)`}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors ${metre.on ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-subtle"}`}
          >
            <AudioLines size={16} aria-hidden />
            <span style={{ fontFamily: "'Anek Malayalam'" }}>വൃത്തം</span>
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Phone keyboard accessory: sits on top of the on-screen keyboard while writing,
 * like a native app's input accessory view. The most used actions only; "Aa" opens the full Format sheet.
 */
export function MobileFormatStrip({
  editor,
  template,
  mode,
  onMode,
  onMore,
  onDone,
  onLookUp,
  onAskAI,
}: {
  editor: Editor;
  template: Template;
  mode: InputMode;
  onMode: (m: InputMode) => void;
  onMore: () => void;
  onDone: () => void;
  /** open the dictionary for the selected word (keeps the selection, hides the keyboard) */
  onLookUp: () => void;
  /** open the AI companion on the selection */
  onAskAI: () => void;
}) {
  const t = useT();
  const e = editor;
  const chain = () => e.chain().focus();
  const parentName = e.state.selection.$from.parent.type.name;
  const usesDialogue = template.screenplay || template.dialogue;
  const next: Record<InputMode, InputMode> = { manglish: "malayalam", malayalam: "english", english: "manglish" };
  const label: Record<InputMode, string> = { manglish: "Manglish", malayalam: "മലയാളം", english: "English" };
  const keep = (ev: React.MouseEvent | React.PointerEvent) => ev.preventDefault();
  const B = ({ t, on, act, dis, children }: { t: string; on: () => void; act?: boolean; dis?: boolean; children: React.ReactNode }) => (
    <button
      type="button"
      onPointerDown={keep}
      onMouseDown={keep}
      onClick={on}
      aria-label={t}
      aria-pressed={act}
      disabled={dis}
      className={`grid h-10 min-w-10 shrink-0 place-items-center rounded-lg px-2 text-[13px] disabled:opacity-35 ${act ? "bg-accent-soft text-accent" : "text-ink active:bg-subtle"}`}
    >
      {children}
    </button>
  );
  return (
    <div className="no-print flex items-center gap-0.5 border-t border-line bg-paper px-1.5 py-1" role="toolbar" aria-label="Quick formatting">
      <button
        type="button"
        onPointerDown={keep}
        onMouseDown={keep}
        onClick={() => onMode(next[mode])}
        className="h-9 shrink-0 rounded-lg bg-accent-soft px-2.5 text-[12.5px] font-semibold text-accent"
        aria-label={`Input: ${label[mode]}. Tap to switch`}
      >
        {label[mode]}
      </button>
      <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        <B t="Undo" on={() => chain().undo().run()} dis={!e.can().undo()}>
          <Undo2 size={18} />
        </B>
        <B t="Redo" on={() => chain().redo().run()} dis={!e.can().redo()}>
          <Redo2 size={18} />
        </B>
        {usesDialogue
          ? SCREENPLAY_ELEMENTS.filter((x) => template.screenplay || x.type === "dialogue").map((el) => (
              <B key={el.type} t={el.label} on={() => setScreenplayElement(e, el.type)} act={parentName === el.type || (el.type === "dialogue" && parentName.startsWith("dialogue"))}>
                {el.ml}
              </B>
            ))
          : null}
        {template.kind === "drama" && (
          <B t="Stage direction" on={() => setStageDirection(e)} act={parentName === "styledBlock" && e.state.selection.$from.parent.attrs.variant === "stage"}>
            രംഗനിർദ്ദേശം
          </B>
        )}
        {template.kind === "diary" && (
          <B t={t("editor.diary.newEntry")} on={() => appendDiaryEntry(e, todayLine())}>
            <CalendarPlus size={18} />
          </B>
        )}
        <B t="Bold" on={() => chain().toggleSmartBold().run()} act={boldIsOn(e)}>
          <Bold size={18} />
        </B>
        <B t="Italic" on={() => chain().toggleItalic().run()} act={e.isActive("italic")}>
          <Italic size={18} />
        </B>
        <B t="Underline" on={() => chain().toggleUnderline().run()} act={e.isActive("underline")}>
          <UIcon size={18} />
        </B>
        {!template.screenplay && (
          <B t="Bulleted list" on={() => chain().toggleBulletList().run()} act={e.isActive("bulletList")}>
            <List size={18} />
          </B>
        )}
      </div>
      <span className="mx-0.5 h-6 w-px shrink-0 bg-line" aria-hidden />
      <B t={t("mobile.lookUp")} on={onLookUp}>
        <BookA size={18} />
      </B>
      <B t={t("mobile.askAI")} on={onAskAI}>
        <Sparkles size={18} />
      </B>
      <B t={t("mobile.allFormatting")} on={onMore}>
        <Type size={18} />
      </B>
      <B t={t("mobile.hideKeyboard")} on={onDone}>
        <ChevronDown size={20} />
      </B>
    </div>
  );
}

/**
 * Phones: a floating bar for the current selection, above the keyboard strip or the tab bar.
 * Look up and Ask AI keep the selection (see extensions/keep-selection.ts) and close the keyboard,
 * so the sheet that opens has the whole screen and still knows which words you chose.
 */
export function MobileSelectionBar({ editor, onLookUp, onAskAI, onClear }: { editor: Editor; onLookUp: () => void; onAskAI: () => void; onClear: () => void }) {
  const t = useT();
  const e = editor;
  const keep = (ev: React.MouseEvent | React.PointerEvent) => ev.preventDefault();
  const { from, to } = e.state.selection;
  const text = e.state.doc.textBetween(from, to, " ").trim();
  const isWord = text.length > 0 && text.length <= 40 && text.split(/\s+/).length <= 3;
  const Item = ({ label, on, act, children }: { label: string; on: () => void; act?: boolean; children: React.ReactNode }) => (
    <button
      type="button"
      onPointerDown={keep}
      onMouseDown={keep}
      onClick={on}
      aria-label={label}
      aria-pressed={act}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${act ? "bg-accent-soft text-accent" : "text-ink active:bg-subtle"}`}
    >
      {children}
    </button>
  );
  return (
    <div className="pop-in no-print mx-2 mb-2 flex items-center gap-0.5 overflow-x-auto rounded-full border border-line bg-surface p-1 shadow-[var(--pop-shadow)] scrollbar-none" role="toolbar" aria-label={t("mobile.selection")}>
      {isWord && (
        <Item label={t("mobile.lookUp")} on={onLookUp}>
          <BookA size={16} /> {t("mobile.lookUp")}
        </Item>
      )}
      <Item label={t("mobile.askAI")} on={onAskAI}>
        <Sparkles size={16} /> {t("mobile.askAI")}
      </Item>
      <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden />
      <Item label="Bold" on={() => e.chain().focus().toggleSmartBold().run()} act={boldIsOn(e)}>
        <Bold size={16} />
      </Item>
      <Item label="Italic" on={() => e.chain().focus().toggleItalic().run()} act={e.isActive("italic")}>
        <Italic size={16} />
      </Item>
      <Item label="Copy" on={() => navigator.clipboard?.writeText(e.state.doc.textBetween(from, to, "\n"))}>
        <Copy size={16} />
      </Item>
      <Item label={t("common.close")} on={onClear}>
        <X size={16} />
      </Item>
    </div>
  );
}
