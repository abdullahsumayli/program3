import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");
  if (!isAdminEmail(user.email)) notFound();

  return (
    <div dir="rtl" className="flex min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 right-0 z-30 flex w-60 flex-col border-l border-gray-200 bg-white">
        <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-5">
          <span className="text-base font-bold text-gray-900">ALAA</span>
          <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            ادمن
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <NavLink href="/admin">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            العملاء
          </NavLink>
        </nav>

        <div className="border-t border-gray-200 px-5 py-3">
          <div className="truncate text-xs text-gray-500">{user.email}</div>
          <Link href="/" className="mt-1 block text-xs font-medium text-gray-600 hover:text-gray-900">
            العودة للتطبيق
          </Link>
        </div>
      </aside>

      <main className="mr-60 flex-1 p-8">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
    >
      {children}
    </Link>
  );
}
