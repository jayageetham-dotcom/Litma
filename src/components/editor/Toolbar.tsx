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
} from "lucide-react";
import type { Template } from "@/lib/templates";
import { FONTS } from "@/lib/templates";
import { BLOCK_VARIANTS } from "@/extensions/blocks";
import { SCREENPLAY_ELEMENTS, setScreenplayElement } from "@/extensions/screenplay";
import type { InputMode } from "@/extensions/manglish";

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
        active ? "bg-kayal-soft text-kayal" : "text-ink hover:bg-desk-2"
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
    <div className="flex shrink-0 rounded-lg bg-desk-2 p-0.5 text-[12.5px]" role="radiogroup" aria-label="Input mode">
      {opts.map(([m, l, t]) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          title={t}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(m)}
          className={`rounded-md px-2.5 py-1 ${mode === m ? "bg-paper font-semibold text-kayal shadow-sm" : "text-muted hover:text-ink"}`}
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
}: {
  editor: Editor;
  template: Template;
  mode: InputMode;
  onMode: (m: InputMode) => void;
  onFind: () => void;
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
    <div className="no-print scrollbar-thin flex items-center gap-0.5 overflow-x-auto border-b border-line bg-paper px-3 py-1.5" role="toolbar" aria-label="Formatting">
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
        <select
          className="h-8 shrink-0 rounded-md border border-line bg-paper px-2 text-[13px]"
          value={current.startsWith("sb:") || current.startsWith("h") || current === "paragraph" ? current : ""}
          onChange={(ev) => setStyle(ev.target.value)}
          aria-label="Paragraph style"
        >
          <option value="paragraph">Body text</option>
          {template.blocks.map((v) => (
            <option key={v} value={`sb:${v}`}>
              {BLOCK_VARIANTS[v].ml} · {BLOCK_VARIANTS[v].label}
            </option>
          ))}
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          {!["paragraph", "h1", "h2", "h3"].includes(current) && !current.startsWith("sb:") && <option value="">—</option>}
        </select>
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
                className={`h-8 rounded-md px-2 text-[13px] ${active ? "bg-kayal text-kayal-ink" : "hover:bg-desk-2"}`}
              >
                {el.ml}
              </button>
            );
          })}
          {inScreenplay && (
            <select
              className="ml-1 h-8 rounded-md border border-line bg-paper px-2 text-[13px]"
              value=""
              onChange={(ev) => ev.target.value && setStyle(ev.target.value)}
              aria-label="Title blocks"
            >
              <option value="">Title page…</option>
              {template.blocks.map((v) => (
                <option key={v} value={`sb:${v}`}>
                  {BLOCK_VARIANTS[v].ml}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <Sep />

      <select
        className="h-8 w-36 shrink-0 rounded-md border border-line bg-paper px-2 text-[13px]"
        value={font}
        onChange={(ev) => (ev.target.value ? chain().setFontFamily(`'${ev.target.value}'`).run() : chain().unsetFontFamily().run())}
        aria-label="Font for selection"
        title="Font for selected text"
      >
        <option value="">Document font</option>
        {FONTS.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>
      <Sep />

      <Btn title="Bold (Ctrl+B)" active={e.isActive("bold")} onClick={() => chain().toggleBold().run()}>
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
        <summary className="grid h-8 min-w-8 cursor-pointer list-none place-items-center rounded-md hover:bg-desk-2" title="Text colour and highlight" aria-label="Colour">
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
          <button className="mt-3 text-xs text-kayal underline" onMouseDown={(ev) => ev.preventDefault()} onClick={() => chain().unsetColor().unsetHighlight().run()}>
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

      {!inScreenplay && (
        <>
          <Btn title="Align left" active={e.isActive({ textAlign: "left" })} onClick={() => chain().setTextAlign("left").run()}>
            <AlignLeft size={16} />
          </Btn>
          <Btn title="Centre" active={e.isActive({ textAlign: "center" })} onClick={() => chain().setTextAlign("center").run()}>
            <AlignCenter size={16} />
          </Btn>
          <Btn title="Align right" active={e.isActive({ textAlign: "right" })} onClick={() => chain().setTextAlign("right").run()}>
            <AlignRight size={16} />
          </Btn>
          <Btn title="Justify" active={e.isActive({ textAlign: "justify" })} onClick={() => chain().setTextAlign("justify").run()}>
            <AlignJustify size={16} />
          </Btn>
          <Sep />
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
    </div>
  );
}
