"use client";
import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/core";
import { Bold, Italic, AlignCenter, AlignLeft, AlignRight, AlignJustify } from "lucide-react";
import { Manglish, type InputMode } from "@/extensions/manglish";
import { ManglishPopup } from "@/components/editor/ManglishPopup";
import { InputModeSwitch } from "@/components/editor/Toolbar";
import { useState } from "react";

/** Small rich-text editor (with Manglish) for book pages: preface, dedication, copyright… */
export function MiniEditor({ value, onChange, placeholder }: { value?: JSONContent; onChange: (v: JSONContent) => void; placeholder?: string }) {
  const [mode, setMode] = useState<InputMode>("manglish");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [3] } }),
      Underline,
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      Placeholder.configure({ placeholder: placeholder ?? "എഴുതൂ…" }),
      Manglish.configure({ defaultMode: "manglish" }),
    ],
    content: value?.content?.length ? value : { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: { attributes: { class: "mini-editor", lang: "ml" } },
  });
  useEffect(() => () => editor?.destroy(), [editor]);
  if (!editor) return null;
  const B = ({ on, active, label, children }: { on: () => void; active?: boolean; label: string; children: React.ReactNode }) => (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={on} aria-label={label} title={label} className={`grid h-7 w-7 place-items-center rounded ${active ? "bg-kayal-soft text-kayal" : "hover:bg-desk-2"}`}>
      {children}
    </button>
  );
  return (
    <div className="rounded-lg border border-line bg-paper">
      <div className="flex flex-wrap items-center gap-1 border-b border-line p-1.5">
        <InputModeSwitch
          mode={mode}
          onChange={(m) => {
            setMode(m);
            editor.commands.setInputMode(m);
          }}
        />
        <span className="mx-1 h-5 w-px bg-line" />
        <B label="Bold" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={14} />
        </B>
        <B label="Italic" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={14} />
        </B>
        <B label="Left" active={editor.isActive({ textAlign: "left" })} on={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft size={14} />
        </B>
        <B label="Centre" active={editor.isActive({ textAlign: "center" })} on={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter size={14} />
        </B>
        <B label="Right" active={editor.isActive({ textAlign: "right" })} on={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight size={14} />
        </B>
        <B label="Justify" active={editor.isActive({ textAlign: "justify" })} on={() => editor.chain().focus().setTextAlign("justify").run()}>
          <AlignJustify size={14} />
        </B>
      </div>
      <EditorContent editor={editor} />
      <ManglishPopup editor={editor} />
    </div>
  );
}
