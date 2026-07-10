export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="search-bar"
      type="search"
      placeholder="Buscar memórias…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
