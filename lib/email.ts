import { renderEmailTemplate } from "@/lib/services/email-template.service";

const RESEND_API_URL = "https://api.resend.com/emails";

type SendTemporaryPasswordEmailInput = {
  to: string;
  name?: string | null;
  temporaryPassword: string;
};

type SendContactFormEmailInput = {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
};

type SendDmvNotificationEmailInput = {
  to: string;
  subject: string;
  lines: string[];
  replyTo?: string | null;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getLoginUrl() {
  const appUrl =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3000";
  return `${appUrl.replace(/\/+$/, "")}/login`;
}

function getAppBaseUrl() {
  return (
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function buildAppUrl(path: string) {
  return `${getAppBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

async function sendResendEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string | null;
}) {
  const apiKey = requiredEnv("RESEND_API_KEY");
  const from = requiredEnv("EMAIL_FROM");
  const to = Array.isArray(input.to) ? input.to : [input.to];

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: input.subject,
      text: input.text,
      ...(input.replyTo?.trim() ? { reply_to: input.replyTo.trim() } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to send email (${response.status}): ${errorText || "unknown error"}`,
    );
  }
}

export async function sendDmvNotificationEmail({
  to,
  subject,
  lines,
  replyTo,
}: SendDmvNotificationEmailInput) {
  const email = await renderEmailTemplate("dmv_notification", {
    subject,
    body: lines.join("\n"),
    replyTo: replyTo?.trim() ?? "",
  });

  await sendResendEmail({ to, subject: email.subject, text: email.text, replyTo });
}

export async function sendDmvRenewalReminderEmail(input: {
  to: string;
  name?: string | null;
  unitNumber: string;
  dueDate: Date | string;
  daysBeforeDue: number;
  renewalId: string;
}) {
  const salutation = input.name?.trim() || "there";
  const dueDate = new Date(input.dueDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const workspaceUrl = buildAppUrl(`/dmv/renewals/${input.renewalId}`);

  await sendDmvNotificationEmail({
    to: input.to,
    subject: `DMV renewal reminder for unit ${input.unitNumber}`,
    lines: [
      `Hi ${salutation},`,
      "",
      `Your Nevada DMV renewal case for unit ${input.unitNumber} is due on ${dueDate}.`,
      `${input.daysBeforeDue} day(s) remain before the due date.`,
      "",
      `Open your renewal workspace: ${workspaceUrl}`,
      "Please review documents, mileage, and any pending compliance items as soon as possible.",
    ],
  });
}

export async function sendDmvCorrectionRequiredEmail(input: {
  to: string;
  name?: string | null;
  unitNumber: string;
  caseLabel: string;
  reason?: string | null;
  workspacePath: string;
}) {
  const salutation = input.name?.trim() || "there";
  const workspaceUrl = buildAppUrl(input.workspacePath);

  await sendDmvNotificationEmail({
    to: input.to,
    subject: `Correction required for ${input.caseLabel} - unit ${input.unitNumber}`,
    lines: [
      `Hi ${salutation},`,
      "",
      `A correction was requested for your ${input.caseLabel} for unit ${input.unitNumber}.`,
      input.reason?.trim() ? `Reason: ${input.reason.trim()}` : "Please review the case notes and update the missing items.",
      "",
      `Open the workspace: ${workspaceUrl}`,
      "After updating the requested items, resubmit the case for review.",
    ],
  });
}

export async function sendTemporaryPasswordEmail({
  to,
  name,
  temporaryPassword,
}: SendTemporaryPasswordEmailInput) {
  const loginUrl = "https://leonardocp.com"; //getLoginUrl();
  const salutation = name?.trim() || "there";

  const email = await renderEmailTemplate("temporary_password", {
    name: salutation,
    temporaryPassword,
    loginUrl,
  });

  await sendResendEmail({ to, subject: email.subject, text: email.text });
}

export async function sendGoogleCredentialsPasswordEmail({
  to,
  name,
  temporaryPassword,
}: SendTemporaryPasswordEmailInput) {
  const loginUrl = getLoginUrl();
  const salutation = name?.trim() || "there";

  const email = await renderEmailTemplate("google_credentials_password", {
    name: salutation,
    temporaryPassword,
    loginUrl,
  });

  await sendResendEmail({ to, subject: email.subject, text: email.text });
}

export async function sendInvitationEmail({
  to,
  inviteUrl,
  invitedByName,
  note,
}: {
  to: string;
  inviteUrl: string;
  invitedByName?: string | null;
  note?: string | null;
}) {
  const inviterLabel = invitedByName?.trim() || "The EWALL team";
  const cleanNote = note?.trim() || "";
  const noteBlock = cleanNote ? `Note from your admin: ${cleanNote}\n` : "";

  const email = await renderEmailTemplate("invitation", {
    inviteUrl,
    invitedByName: inviterLabel,
    note: cleanNote,
    noteBlock,
  });

  await sendResendEmail({ to, subject: email.subject, text: email.text });
}

export async function sendContactFormEmail({
  name,
  email,
  phone,
  message,
}: SendContactFormEmailInput) {
  const contactRecipient = requiredEnv("EMAIL_CONTACT");

  const cleanName = name.trim();
  const cleanEmail = email.trim();
  const cleanPhone = phone?.trim() || "Not provided";
  const cleanMessage = message.trim();

  const rendered = await renderEmailTemplate("contact_form", {
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    message: cleanMessage,
  });

  await sendResendEmail({
    to: contactRecipient,
    subject: rendered.subject,
    text: rendered.text,
    replyTo: cleanEmail,
  });
}
