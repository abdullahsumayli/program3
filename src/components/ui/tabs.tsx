"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  children,
  className,
}: {
  defaultValue: string;
  children: ReactNode;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex gap-1 rounded-lg bg-gray-100 p-1", className)}>{children}</div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be inside Tabs");
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={cn(
        "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be inside Tabs");
  if (ctx.value !== value) return null;
  return <div className="mt-4">{children}</div>;
}
