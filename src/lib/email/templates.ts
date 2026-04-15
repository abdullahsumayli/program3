function wrap(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
      <h1 style="font-size:20px;margin:0 0 16px 0">${escape(title)}</h1>
      ${body}
    </div>
  </body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function workspaceInviteEmail(params: {
  workspaceName: string;
  inviterName: string;
  acceptUrl: string;
}) {
  const subject = `You're invited to join ${params.workspaceName}`;
  const html = wrap(
    subject,
    `<p>${escape(params.inviterName)} invited you to collaborate in <strong>${escape(params.workspaceName)}</strong>.</p>
     <p style="margin:24px 0"><a href="${params.acceptUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Accept invitation</a></p>
     <p style="color:#64748b;font-size:13px">If you didn't expect this invitation you can ignore this email.</p>`
  );
  return { subject, html };
}

export function taskAssignedEmail(params: {
  taskDescription: string;
  meetingTitle: string;
  dueDate: string | null;
  appUrl: string;
}) {
  const subject = `New task assigned: ${truncate(params.taskDescription, 60)}`;
  const html = wrap(
    subject,
    `<p>A task from <strong>${escape(params.meetingTitle)}</strong> has been assigned to you:</p>
     <blockquote style="margin:16px 0;padding:12px 16px;background:#f1f5f9;border-radius:12px">${escape(params.taskDescription)}</blockquote>
     ${params.dueDate ? `<p>Due: <strong>${escape(params.dueDate)}</strong></p>` : ""}
     <p style="margin:24px 0"><a href="${params.appUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Open dashboard</a></p>`
  );
  return { subject, html };
}

export function taskDueSoonEmail(params: {
  taskDescription: string;
  meetingTitle: string;
  dueDate: string;
  appUrl: string;
}) {
  const subject = `Reminder: task due ${params.dueDate}`;
  const html = wrap(
    subject,
    `<p>Reminder — a task from <strong>${escape(params.meetingTitle)}</strong> is due on <strong>${escape(params.dueDate)}</strong>:</p>
     <blockquote style="margin:16px 0;padding:12px 16px;background:#fef3c7;border-radius:12px">${escape(params.taskDescription)}</blockquote>
     <p style="margin:24px 0"><a href="${params.appUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Open dashboard</a></p>`
  );
  return { subject, html };
}

export function subscriptionFailedEmail(params: {
  workspaceName: string;
  appUrl: string;
}) {
  const subject = `Payment failed for ${params.workspaceName}`;
  const html = wrap(
    subject,
    `<p>We couldn't process the latest payment for <strong>${escape(params.workspaceName)}</strong>.</p>
     <p>Please update your payment method to avoid service interruption.</p>
     <p style="margin:24px 0"><a href="${params.appUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Manage billing</a></p>`
  );
  return { subject, html };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
