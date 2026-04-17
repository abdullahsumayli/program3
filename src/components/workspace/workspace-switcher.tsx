"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, ChevronDown, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/context";

type Workspace = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  plan: "free" | "basic" | "pro" | "enterprise";
};

export function WorkspaceSwitcher() {
  const router = useRouter();
  const { t } = useLanguage();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = async () => {
    const res = await fetch("/api/workspaces", { cache: "no-store" });
    if (!res.ok) return;
    const list: Workspace[] = await res.json();
    setWorkspaces(list);

    const dashboard = await fetch("/api/dashboard", { cache: "no-store" });
    if (dashboard.ok) {
      const body = await dashboard.json();
      setActiveId(body.workspace?.id ?? null);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? null;

  const switchTo = async (id: string) => {
    const res = await fetch("/api/workspaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: id }),
    });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  };

  const createWorkspace = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        await switchTo(created.id);
        setNewName("");
      }
    } finally {
      setCreating(false);
    }
  };

  if (workspaces.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="min-w-[140px] justify-between"
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 size={14} />
          <span className="truncate text-xs font-medium">
            {activeWorkspace?.name ?? t("workspace.switcherDefault")}
          </span>
        </span>
        <ChevronDown size={14} />
      </Button>

      {open ? (
        <div className="absolute end-0 z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("workspace.switcherTitle")}
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {workspaces.map((ws) => (
              <li key={ws.id}>
                <button
                  onClick={() => switchTo(ws.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50 ${
                    ws.id === activeId ? "bg-slate-100" : ""
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  <span className="text-[10px] uppercase text-slate-500">{ws.plan}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-2 border-t border-slate-100 pt-2">
            <div className="flex items-center gap-2 px-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("workspace.newPlaceholder")}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
              <Button size="sm" onClick={createWorkspace} disabled={creating || !newName.trim()}>
                <Plus size={14} />
              </Button>
            </div>
            <Link
              href="/settings/workspace"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Settings2 size={14} />
              {t("workspace.manage")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
