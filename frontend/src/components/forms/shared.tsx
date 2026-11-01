import type { ReactNode } from 'react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Field, fieldAria } from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SelectFieldProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  label: string
  id: string
  options: { value: string; label: ReactNode }[]
  placeholder?: string
  error?: string
  disabled?: boolean
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  id,
  options,
  placeholder,
  error,
  disabled,
}: SelectFieldProps<T>) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value ? String(field.value) : undefined}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <SelectTrigger {...fieldAria(id, error)} onBlur={field.onBlur} ref={field.ref}>
              <SelectValue placeholder={placeholder ?? 'Select…'} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  )
}
