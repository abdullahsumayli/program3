"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 text-gray-400"
      />
      <input
        type="search"
        className={cn(
          "w-full py-2 ps-9 pe-3 text-sm",
          "border border-gray-300 rounded-lg bg-white",
          "placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          className
        )}
        {...props}
      />
    </div>
  );
}
