import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full px-3 py-2 text-sm",
          "border border-slate-200 rounded-lg bg-white",
          "placeholder:text-slate-400",
          "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full px-3 py-2 text-sm",
          "border border-slate-200 rounded-lg bg-white",
          "placeholder:text-slate-400",
          "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "resize-vertical min-h-[80px]",
          className
        )}
        {...props}
      />
    );
  }
);
