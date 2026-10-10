/** Escala de dor 0–10 (NRS). Alvos grandes; o valor escolhido fica destacado. */
export function PainScale({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="pain">
      <legend className="pain__label">{label}</legend>
      <div className="pain__grid">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            className={`pain__option${value === n ? ' is-selected' : ''}`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="pain__ends" aria-hidden="true">
        <span>0 sem dor</span>
        <span>10 pior dor</span>
      </div>
    </fieldset>
  );
}
