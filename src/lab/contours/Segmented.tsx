export function Segmented<T extends string>({
  label,
  options,
  value,
  labels,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  /** Shown instead of the option itself. */
  labels?: Partial<Record<T, string>>
  onChange(value: T): void
}) {
  return (
    <div className="lab-field">
      <span className="lab-field-label">{label}</span>
      <div className="lab-seg" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={option} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>
            {labels?.[option] ?? option}
          </button>
        ))}
      </div>
    </div>
  )
}
