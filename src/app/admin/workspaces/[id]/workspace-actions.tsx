"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  workspaceId: string;
  currentPlan: string;
  currentStatus: string;
  members: Array<{ user_id: string; email: string; role: string }>;
};

export default function WorkspaceActions({
  workspaceId,
  currentPlan,
  currentStatus,
  members,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  async function doAction(body: Record<string, unknown>) {
    setFeedback(null);
    const res = await fetch(`/api/admin/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: "err", msg: json.error ?? "Failed" });
      return;
    }
    setFeedback({ type: "ok", msg: "Done" });
    startTransition(() => router.refresh());
  }

  async function doDelete() {
    if (!confirm("Are you sure you want to permanently delete this workspace and ALL its data?")) return;
    setFeedback(null);
    const res = await fetch(`/api/admin/workspaces/${workspaceId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: "err", msg: json.error ?? "Failed" });
      return;
    }
    router.push("/admin");
  }

  async function removeMember(userId: string, email: string) {
    if (!confirm(`Remove ${email} from this workspace?`)) return;
    await doAction({ action: "remove_member", user_id: userId });
  }

  return (
    <div className="space-y-8">
      {/* Feedback */}
      {feedback && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            feedback.type === "ok"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Subscription Management */}
      <Section title="Subscription Management">
        <div className="flex flex-wrap gap-3">
          <ActionButton
            label={currentPlan === "free" ? "Upgrade to Paid" : "Downgrade to Free"}
            disabled={isPending}
            onClick={() =>
              doAction({ action: "change_plan", plan: currentPlan === "free" ? "paid" : "free" })
            }
          />
          {currentStatus !== "active" && (
            <ActionButton
              label="Activate"
              tone="green"
              disabled={isPending}
              onClick={() => doAction({ action: "change_status", status: "active" })}
            />
          )}
          {currentStatus === "active" && (
            <ActionButton
              label="Suspend"
              tone="amber"
              disabled={isPending}
              onClick={() => doAction({ action: "change_status", status: "canceled" })}
            />
          )}
          <ActionButton
            label="Extend 30 Days"
            disabled={isPending}
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 30);
              doAction({ action: "extend_subscription", renews_at: d.toISOString() });
            }}
          />
        </div>
      </Section>

      {/* Usage Controls */}
      <Section title="Usage Controls">
        <div className="flex flex-wrap gap-3">
          <ActionButton
            label="Reset Usage"
            tone="amber"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Reset all usage to zero?")) return;
              doAction({ action: "reset_usage" });
            }}
          />
          <ActionButton
            label="Add 60 min"
            disabled={isPending}
            onClick={() => doAction({ action: "add_minutes", minutes: 60 })}
          />
          <ActionButton
            label="Add 300 min"
            disabled={isPending}
            onClick={() => doAction({ action: "add_minutes", minutes: 300 })}
          />
        </div>
      </Section>

      {/* Members */}
      <Section title="Members">
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium capitalize text-gray-600">
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.role !== "owner" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => removeMember(m.user_id, m.email)}
                        className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-3 text-sm text-red-700">
            Permanently delete this workspace and all associated data. This cannot be undone.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={doDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete Workspace
          </button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      {children}
    </div>
  );
}

function ActionButton({
  label,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  tone?: "green" | "amber";
  disabled?: boolean;
  onClick: () => void;
}) {
  const cls =
    tone === "green"
      ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
      : tone === "amber"
        ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${cls}`}
    >
      {label}
    </button>
  );
}
