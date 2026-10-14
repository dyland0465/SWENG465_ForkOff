import type { ComponentProps } from 'react'
import './FilterChip.css'

type FilterChipProps = ComponentProps<'button'> & { selected: boolean }

export function FilterChip({ selected, className = '', ...props }: FilterChipProps) {
  return <button {...props} type="button" className={`ui-filter-chip ${className}`.trim()} aria-pressed={selected} />
}
