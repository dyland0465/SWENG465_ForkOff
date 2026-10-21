import { useId } from 'react'
import './ProgressIndicator.css'

export function ProgressIndicator({ value, total }: { value: number; total: number }) {
  const labelId = useId()
  return (
    <div className="ui-progress">
      <span id={labelId}>{value} of {total} restaurants processed</span>
      <progress value={value} max={total || 1} aria-labelledby={labelId} />
    </div>
  )
}
