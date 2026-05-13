import { cn } from '@/lib/utils'
import { AlertCircle, Info } from 'lucide-react'

export function Alert({ children, variant = 'default', className }) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border px-4 py-3 text-sm',
        variant === 'destructive'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-blue-200 bg-blue-50 text-blue-700',
        className
      )}
    >
      {variant === 'destructive'
        ? <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        : <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
      }
      <div>{children}</div>
    </div>
  )
}

export function AlertDescription({ children, className }) {
  return (
    <p className={cn('text-sm leading-relaxed', className)}>
      {children}
    </p>
  )
}

export default Alert
