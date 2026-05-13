import { cn } from '@/lib/utils'

export function Label({ children, htmlFor, className }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('text-sm font-medium text-[#0A1128] leading-none', className)}
    >
      {children}
    </label>
  )
}

export default Label
