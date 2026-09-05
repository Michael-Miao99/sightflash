export function NoteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="note-btn" onClick={onClick}>
      {label}
    </button>
  );
}
