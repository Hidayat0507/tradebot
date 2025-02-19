import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: Array<{ value: string; label: string }>
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, options, ...props }, ref) => {
    return (
      <select
        className={cn(
          "mt-1 block w-full",
          "rounded-lg",
          "bg-gray-50 dark:bg-gray-900",
          "border-gray-200 dark:border-gray-700",
          "text-gray-900 dark:text-white",
          "py-2.5 px-4",
          "text-sm",
          "transition-colors",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          className
        )}
        ref={ref}
        {...props}
      >
        {options ? (
          options.map(option => (
            <option 
              key={option.value} 
              value={option.value}
              className="bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white"
            >
              {option.label}
            </option>
          ))
        ) : (
          children
        )}
      </select>
    )
  }
)
Select.displayName = 'Select'

export { Select }
