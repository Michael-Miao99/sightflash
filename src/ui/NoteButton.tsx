export type NoteButtonVariant = 'natural' | 'black';

/** 音名板按钮。variant='black' 的黑键键用 .black-name 配色（双名标注，如 C#/Db）。 */
export function NoteButton({
  label,
  onClick,
  variant = 'natural',
}: {
  label: string;
  onClick: () => void;
  variant?: NoteButtonVariant;
}) {
  return (
    <button type="button" className={`note-btn${variant === 'black' ? ' black-name' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}
