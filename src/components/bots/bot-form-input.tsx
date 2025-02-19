import * as React from "react"
import { cn } from "@/lib/utils"

export interface BotFormInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const BotFormInput = React.forwardRef<HTMLInputElement, BotFormInputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            className={cn(
              "mt-1 block w-full rounded-lg",
              "bg-gray-50 dark:bg-gray-900",
              "border-gray-200 dark:border-gray-700",
              "py-2.5 px-4 text-sm",
              "text-gray-900 dark:text-white",
              "transition-colors",
              "hover:bg-gray-100 dark:hover:bg-gray-800",
              "focus:outline-none focus:ring-2 focus:ring-blue-500",
              error && "border-red-500 focus:ring-red-500",
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    )
  }
)
BotFormInput.displayName = "BotFormInput"

export { BotFormInput }
