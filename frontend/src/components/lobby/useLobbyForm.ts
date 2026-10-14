import { useState } from 'react'

type Validators<T> = { [K in keyof T]: (value: string) => string | undefined }

/** Validate on blur and revalidate edited fields without interrupting typing. */
export function useLobbyForm<T extends Record<string, string>>(initialValues: T, validators: Validators<T>) {
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const errors = Object.fromEntries(
    Object.keys(values).map(key => [key, touched[key] ? validators[key](values[key]) : undefined]),
  ) as Partial<Record<keyof T, string>>

  function setValue<K extends keyof T>(key: K, value: T[K]) {
    setValues(previous => ({ ...previous, [key]: value }))
  }

  function onBlur(key: keyof T) {
    setTouched(previous => ({ ...previous, [key]: true }))
  }

  function validate(form: HTMLFormElement) {
    const keys = Object.keys(values)
    setTouched(Object.fromEntries(keys.map(key => [key, true])) as Record<keyof T, boolean>)
    const firstInvalidKey = keys.find(key => validators[key](values[key]))
    if (firstInvalidKey) {
      const field = form.elements.namedItem(firstInvalidKey)
      if (field instanceof HTMLElement) requestAnimationFrame(() => field.focus())
      return false
    }
    return true
  }

  return { values, errors, setValue, onBlur, validate }
}
