import { useId } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import './FormField.css'

type FieldProps = {
  label: string
  error?: string
  hint?: string
}

function Field({ id, label, error, hint, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="ui-field">
      <label className="text-label-default" htmlFor={id}>{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="ui-field__hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="ui-field__error">{error}</p>}
    </div>
  )
}

export function TextInput({ label, error, hint, id: providedId, ...props }: FieldProps & ComponentProps<'input'>) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const description = [props['aria-describedby'], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <input {...props} id={id} className={`ui-field__control ${props.className ?? ''}`.trim()} aria-invalid={!!error} aria-describedby={description} />
    </Field>
  )
}

export function SelectField({ label, error, hint, id: providedId, children, ...props }: FieldProps & ComponentProps<'select'>) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const description = [props['aria-describedby'], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <div className="ui-field__select">
        <select {...props} id={id} className={`ui-field__control ${props.className ?? ''}`.trim()} aria-invalid={!!error} aria-describedby={description}>{children}</select>
        <span aria-hidden="true">⌄</span>
      </div>
    </Field>
  )
}
