import { useState, useRef } from 'react';

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
  el.style.height = `${el.scrollHeight + lineHeight * 2}px`;
}

interface NotesCellProps {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
}

export default function NotesCell({ value, onCommit, placeholder = 'Add a note…' }: NotesCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  if (!editing) {
    return (
      <div
        className={value ? 'notes-field notes-idle' : 'notes-field notes-idle'}
        title={value || placeholder}
        onClick={() => { setDraft(value); setEditing(true); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setDraft(value); setEditing(true); } }}
      >
        {value || <span className="notes-placeholder">{placeholder}</span>}
      </div>
    );
  }

  return (
    <textarea
      ref={(el) => {
        taRef.current = el;
        if (el) { el.focus(); autoResize(el); }
      }}
      className="notes-field notes-focused"
      rows={1}
      value={draft}
      onChange={(e) => { setDraft(e.currentTarget.value); autoResize(e.currentTarget); }}
      onInput={(e) => autoResize(e.currentTarget as HTMLTextAreaElement)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onCommit(draft);
      }}
    />
  );
}
