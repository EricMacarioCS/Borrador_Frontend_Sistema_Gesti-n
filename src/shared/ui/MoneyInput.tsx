/** Campo de importe: se escribe en pesos ("85.50") y el modelo guarda centavos enteros, o `null` si no es válido. */
import { useState } from 'react'
import { centsToPesos, pesosToCents } from '@/domain/rules'

interface Props {
  value: number | null
  onChange: (cents: number | null) => void
  id?: string
  label?: string
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
}

export default function MoneyInput({ value, onChange, id, label, invalid, disabled, placeholder }: Props) {
  const [text, setText] = useState(value === null ? '' : centsToPesos(value))
  // Si el valor cambia desde fuera (por ejemplo, con la calculadora), se vuelve a escribir el texto.
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (value !== pesosToCents(text)) setText(value === null ? '' : centsToPesos(value))
  }

  return (
    <span className="money-input">
      <input id={id} className="input" inputMode="decimal" autoComplete="off" value={text} aria-label={id ? undefined : label} placeholder={placeholder ?? '0.00'}
        aria-invalid={invalid || (text !== '' && value === null) ? 'true' : undefined} disabled={disabled}
        onChange={event => {
          const next = event.target.value
          const cents = pesosToCents(next)
          setText(next)
          setSeen(cents)
          onChange(cents)
        }} />
    </span>
  )
}
