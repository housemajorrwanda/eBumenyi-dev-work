import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-blue-1 text-white hover:bg-blue-3 hover:shadow-md',
        destructive:
          'bg-meet-red text-white hover:bg-red-600 hover:shadow-md',
        outline:
          'border border-dark-4 bg-transparent text-white hover:bg-dark-3 hover:border-dark-3',
        secondary:
          'bg-dark-3 text-white hover:bg-dark-4',
        ghost:
          'text-white/70 hover:bg-dark-3 hover:text-white',
        link: 'text-blue-2 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 py-2 rounded-lg sm:h-10 sm:px-4',
        sm: 'h-10 rounded-lg px-4 sm:h-9 sm:px-3',
        lg: 'h-14 rounded-xl px-10 sm:h-12 sm:px-8',
        xl: 'h-16 rounded-full px-12 text-base sm:h-14 sm:px-10',
        icon: 'size-12 rounded-full sm:size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
