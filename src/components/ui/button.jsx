// shadcn/ui new-york registry (MIT): https://ui.shadcn.com/r/styles/new-york/button.json
// JavaScript conversion and Finplot theme adaptations are maintained locally.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva(
  "ui-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "button-default bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "button-outline border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "button-subtle bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        subtle: "button-subtle bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "button-ghost hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "button-sm h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "button-icon h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      type={asChild ? type : (type || "button")}
      {...props}
    />;
  }
);
Button.displayName = "Button";
export {
  Button,
  buttonVariants
};
