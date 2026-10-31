"use client";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  Languages,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Search,
  SeparatorHorizontal,
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
} from "lucide-react";
import type { Template } from "@/lib/templates";
import { FONTS } from "@/lib/templates";
import { BLOCK_VARIANTS } from "@/extensions/blocks";
import { SCREENPLAY_ELEMENTS, setScreenplayElement } from "@/extensions/screenplay";
import type { InputMode } from "@/extensions/manglish";
import { Select } from "@/components/ui/Select";
import { boldIsOn } from "@/extensions/bold";

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

const COLORS = ["#1a2220", "#1d5a52", "#a17a28", "#a3372b", "#2b4c8c", "#6b3d8f"];
const HIGHLIGHTS = ["#fbeaa6", "#d8e8e3", "#f6d6cf", "#dbe4f6"];

export function InputModeSwitch({ mode, onChange }: { mode: InputMode; onChange: (m: InputMode) => void }) {
  const opts: [InputMode, string, string][] = [
    ["manglish", "Manglish", "Type in English letters, get Malayalam (Ctrl/⌘ + M to switch)"],
    ["malayalam", "മലയാളം", "Use your own Malayalam keyboard (InScript, Mozhi, Swanalekha…)"],
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
}) {
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
    else if (v.startsWith("h")) chain().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
    else if (v.startsWith("sb:")) chain().setNode("styledBlock", { variant: v.slice(3) }).run();
  };

  const font = (e.getAttributes("textStyle").fontFamily as string | undefined)?.replace(/['"]/g, "") ?? "";
  const inScreenplay = template.screenplay;
  const usesDialogue = template.screenplay || template.dialogue;

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
            { value: "h1", label: "Heading 1" },
            { value: "h2", label: "Heading 2" },
            { value: "h3", label: "Heading 3" },
          ]}
        />
      )}

      {usesDialogue && (
        <div className="flex shrink-0 items-center gap-0.5" aria-label="Script elements">
          {SCREENPLAY_ELEMENTS.filter((x) => inScreenplay || ["action", "dialogue"].includes(x.type)).map((el) => {
            const active = parentName === el.type || (el.type === "dialogue" && (parentName === "dialogueCue" || parentName === "dialogueSpeech"));
            return (
              <button
                key={el.type}
                type="button"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => setScreenplayElement(e, el.type)}
                title={`${el.label} (Ctrl+Alt+${el.key})`}
                className={`h-8 rounded-md px-2 text-[13px] ${active ? "bg-accent text-accent-ink" : "hover:bg-subtle"}`}
              >
                {el.ml}
              </button>
            );
          })}
          {inScreenplay && (
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
          )}
        </div>
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

      <details className="relative shrink-0">
        <summary className="grid h-8 min-w-8 cursor-pointer list-none place-items-center rounded-md hover:bg-subtle" title="Text colour and highlight" aria-label="Colour">
          <span className="flex flex-col items-center">
            <Highlighter size={15} />
          </span>
        </summary>
        <div className="absolute left-0 top-9 z-40 w-48 rounded-lg border border-line bg-paper p-3 shadow-lg">
          <div className="mb-1.5 text-xs text-muted">Text colour</div>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button key={c} className="h-6 w-6 rounded-full border border-line" style={{ background: c }} aria-label={`Colour ${c}`} onMouseDown={(ev) => ev.preventDefault()} onClick={() => chain().setColor(c).run()} />
            ))}
          </div>
          <div className="mb-1.5 mt-3 text-xs text-muted">Highlight</div>
          <div className="flex gap-1.5">
            {HIGHLIGHTS.map((c) => (
              <button key={c} className="h-6 w-6 rounded border border-line" style={{ background: c }} aria-label={`Highlight ${c}`} onMouseDown={(ev) => ev.preventDefault()} onClick={() => chain().toggleHighlight({ color: c }).run()} />
            ))}
          </div>
          <button className="mt-3 text-xs text-accent underline" onMouseDown={(ev) => ev.preventDefault()} onClick={() => chain().unsetColor().unsetHighlight().run()}>
            Clear colours
          </button>
        </div>
      </details>
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
        </>
      )}
      <Btn title="Page break (Ctrl+Enter)" onClick={() => chain().insertPageBreak().run()}>
        <SeparatorHorizontal size={16} />
      </Btn>
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
}: {
  editor: Editor;
  template: Template;
  mode: InputMode;
  onMode: (m: InputMode) => void;
  onMore: () => void;
  onDone: () => void;
}) {
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
          ? SCREENPLAY_ELEMENTS.filter((x) => template.screenplay || ["action", "dialogue"].includes(x.type)).map((el) => (
              <B key={el.type} t={el.label} on={() => setScreenplayElement(e, el.type)} act={parentName === el.type || (el.type === "dialogue" && parentName.startsWith("dialogue"))}>
                {el.ml}
              </B>
            ))
          : null}
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
      <B t="All formatting" on={onMore}>
        <Type size={18} />
      </B>
      <B t="Hide keyboard" on={onDone}>
        <ChevronDown size={20} />
      </B>
    </div>
  );
}
