"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useState, useEffect } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
};

export function RichTextEditor({
  name,
  defaultValue,
  value,
  onChange,
  placeholder,
  maxLength,
  className,
}: Props) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = controlled ? (value ?? "") : internal;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
    ],
    content: current,
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] px-3 py-2 text-sm focus:outline-none [&_p]:my-1 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-2 [&_h4]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold",
      },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      if (controlled) {
        onChange?.(html);
      } else {
        setInternal(html);
        onChange?.(html);
      }
    },
    immediatelyRender: false,
  });

  // Внешнее value меняется (контролируемый режим) — синхронизируем в редактор.
  useEffect(() => {
    if (!editor || !controlled) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor, controlled]);

  if (!editor) {
    return <div className="rounded-md border bg-background min-h-[160px] animate-pulse" />;
  }

  const len = editor.getText().length;
  const htmlLen = current.length;
  const tooLong = maxLength != null && htmlLen > maxLength;

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <Toolbar editor={editor} />
      <div className="relative">
        {len === 0 && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
      {name && <input type="hidden" name={name} value={current} />}
      {maxLength != null && (
        <div
          className={cn(
            "px-3 py-1 border-t text-xs text-right",
            tooLong ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {htmlLen} / {maxLength}
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    cn(
      "h-8 w-8 inline-flex items-center justify-center rounded text-foreground/70 hover:bg-slate-100 hover:text-foreground transition-colors",
      active && "bg-slate-200 text-foreground",
    );

  function addLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b bg-slate-50/60 rounded-t-md">
      <button
        type="button"
        aria-label="Жирный"
        className={btn(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label="Курсив"
        className={btn(editor.isActive("italic"))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="w-4 h-4" />
      </button>
      <span className="w-px h-5 bg-border mx-1" />
      <button
        type="button"
        aria-label="Заголовок 2"
        className={btn(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label="Заголовок 3"
        className={btn(editor.isActive("heading", { level: 3 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="w-4 h-4" />
      </button>
      <span className="w-px h-5 bg-border mx-1" />
      <button
        type="button"
        aria-label="Маркированный список"
        className={btn(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label="Нумерованный список"
        className={btn(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <span className="w-px h-5 bg-border mx-1" />
      <button
        type="button"
        aria-label="Ссылка"
        className={btn(editor.isActive("link"))}
        onClick={addLink}
      >
        <LinkIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label="Снять форматирование"
        className={btn(false)}
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <Eraser className="w-4 h-4" />
      </button>
      <span className="ml-auto flex gap-0.5">
        <button
          type="button"
          aria-label="Отменить"
          disabled={!editor.can().undo()}
          className={cn(btn(false), "disabled:opacity-40 disabled:hover:bg-transparent")}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Повторить"
          disabled={!editor.can().redo()}
          className={cn(btn(false), "disabled:opacity-40 disabled:hover:bg-transparent")}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo className="w-4 h-4" />
        </button>
      </span>
    </div>
  );
}
