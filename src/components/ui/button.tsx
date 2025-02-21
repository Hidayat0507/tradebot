import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 shadow-sm",
        primary: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:opacity-90 dark:from-blue-500 dark:to-indigo-500",
        secondary: "bg-gradient-to-r from-gray-800 to-gray-700 text-white shadow-md hover:opacity-90",
        gradient: "bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white shadow-md hover:opacity-90 dark:from-purple-500 dark:via-blue-500 dark:to-indigo-500",
        destructive: "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md hover:opacity-90",
        ghost: "text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800",
        link: "text-blue-600 underline-offset-4 hover:underline dark:text-blue-400",
      },
      size: {
        lg: "h-12 px-8 text-base",
        md: "h-11 px-6",
        sm: "h-9 px-4 text-sm",
        xs: "h-8 px-3 text-xs",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      fullWidth: false,
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth: false, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
