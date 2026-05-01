import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SettingsValidationError } from "@/lib/services/settings-errors";

export const EMAIL_TEMPLATE_KEYS = [
  "invitation",
  "temporary_password",
  "google_credentials_password",
  "dmv_notification",
  "contact_form",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

type TemplateDefinition = {
  key: EmailTemplateKey;
  name: string;
  description: string;
  subject: string;
  bodyText: string;
  variables: string[];
};

export type EmailTemplateView = TemplateDefinition & {
  id: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  customized: boolean;
};

export class EmailTemplateValidationError extends SettingsValidationError {}

const defaultTemplates: TemplateDefinition[] = [
  {
    key: "invitation",
    name: "Invitation email",
    description: "Sent when an admin invites a new user to EWALL.",
    subject: "You've been invited to EWALL",
    bodyText: [
      "Hi,",
      "",
      "{{invitedByName}} has invited you to join EWALL.",
      "{{noteBlock}}",
      "Click the link below to set up your account and company information:",
      "",
      "{{inviteUrl}}",
      "",
      "This invitation expires in 7 days.",
    ].join("\n"),
    variables: ["inviteUrl", "invitedByName", "note", "noteBlock"],
  },
  {
    key: "temporary_password",
    name: "Temporary password",
    description: "Sent after an admin resets a user's password.",
    subject: "Your password has been reset",
    bodyText: [
      "Hi {{name}},",
      "",
      "Your account password has been reset by an administrator.",
      "Temporary password: {{temporaryPassword}}",
      "",
      "Sign in at: {{loginUrl}}",
      "After signing in, please change your password immediately.",
    ].join("\n"),
    variables: ["name", "temporaryPassword", "loginUrl"],
  },
  {
    key: "google_credentials_password",
    name: "Google credentials password",
    description: "Sent when a Google-auth user receives an email/password login.",
    subject: "Your login password for email sign-in",
    bodyText: [
      "Hi {{name}},",
      "",
      "Your account was created using Google sign-in.",
      "We generated a password so you can also sign in with email and password.",
      "Temporary password: {{temporaryPassword}}",
      "",
      "Sign in at: {{loginUrl}}",
      "After signing in, please change your password immediately.",
    ].join("\n"),
    variables: ["name", "temporaryPassword", "loginUrl"],
  },
  {
    key: "dmv_notification",
    name: "DMV notification wrapper",
    description: "Used for DMV reminder and correction emails. The body variable contains the case-specific message.",
    subject: "{{subject}}",
    bodyText: "{{body}}",
    variables: ["subject", "body", "replyTo"],
  },
  {
    key: "contact_form",
    name: "Contact form notification",
    description: "Internal email sent when the public contact form is submitted.",
    subject: "Contact form - {{name}}",
    bodyText: [
      "New contact form submission",
      "",
      "Name: {{name}}",
      "Email: {{email}}",
      "Phone: {{phone}}",
      "",
      "Message:",
      "{{message}}",
    ].join("\n"),
    variables: ["name", "email", "phone", "message"],
  },
];

const defaultTemplateMap = new Map(defaultTemplates.map((template) => [template.key, template]));

function assertTemplateKey(value: string): asserts value is EmailTemplateKey {
  if (!EMAIL_TEMPLATE_KEYS.includes(value as EmailTemplateKey)) {
    throw new EmailTemplateValidationError("Unknown email template.");
  }
}

function normalizeText(value: unknown, field: string, maxLength?: number) {
  if (typeof value !== "string") {
    throw new EmailTemplateValidationError(`${field} is required.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new EmailTemplateValidationError(`${field} is required.`);
  }
  if (maxLength && normalized.length > maxLength) {
    throw new EmailTemplateValidationError(`${field} must be ${maxLength} characters or less.`);
  }

  return normalized;
}

function normalizeBody(value: unknown) {
  if (typeof value !== "string") {
    throw new EmailTemplateValidationError("Body is required.");
  }

  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    throw new EmailTemplateValidationError("Body is required.");
  }
  if (normalized.length > 12000) {
    throw new EmailTemplateValidationError("Body must be 12000 characters or less.");
  }

  return normalized;
}

function toView(
  definition: TemplateDefinition,
  row?: {
    id: string;
    name: string;
    description: string | null;
    subject: string;
    bodyText: string;
    variables: Prisma.JsonValue | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null,
): EmailTemplateView {
  return {
    ...definition,
    id: row?.id ?? null,
    name: row?.name ?? definition.name,
    description: row?.description ?? definition.description,
    subject: row?.subject ?? definition.subject,
    bodyText: row?.bodyText ?? definition.bodyText,
    variables: Array.isArray(row?.variables)
      ? row.variables.filter((variable): variable is string => typeof variable === "string")
      : definition.variables,
    isActive: row?.isActive ?? true,
    createdAt: row?.createdAt.toISOString() ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    customized: Boolean(row),
  };
}

export function getDefaultEmailTemplates() {
  return defaultTemplates;
}

export async function listEmailTemplates() {
  const rows = await prisma.emailTemplate.findMany({
    where: {
      key: {
        in: [...EMAIL_TEMPLATE_KEYS],
      },
    },
  });
  const rowByKey = new Map(rows.map((row) => [row.key, row]));

  return defaultTemplates.map((definition) => toView(definition, rowByKey.get(definition.key)));
}

export async function getEmailTemplate(key: EmailTemplateKey) {
  const definition = defaultTemplateMap.get(key);
  if (!definition) {
    throw new EmailTemplateValidationError("Unknown email template.");
  }

  const row = await prisma.emailTemplate.findUnique({ where: { key } });
  return toView(definition, row);
}

export async function updateEmailTemplate(key: string, payload: Record<string, unknown>) {
  assertTemplateKey(key);
  const definition = defaultTemplateMap.get(key)!;
  const subject = normalizeText(payload.subject, "Subject", 300);
  const bodyText = normalizeBody(payload.bodyText);
  const isActive = typeof payload.isActive === "boolean" ? payload.isActive : true;

  const row = await prisma.emailTemplate.upsert({
    where: { key },
    create: {
      key,
      name: definition.name,
      description: definition.description,
      subject,
      bodyText,
      variables: definition.variables,
      isActive,
    },
    update: {
      subject,
      bodyText,
      variables: definition.variables,
      isActive,
    },
  });

  return toView(definition, row);
}

export async function resetEmailTemplate(key: string) {
  assertTemplateKey(key);
  await prisma.emailTemplate.delete({ where: { key } }).catch(() => null);
  return getEmailTemplate(key);
}

function getVariableValue(variables: Record<string, unknown>, path: string) {
  const parts = path.split(".");
  let value: unknown = variables;

  for (const part of parts) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return "";
    }
    value = (value as Record<string, unknown>)[part];
  }

  if (value === null || typeof value === "undefined") return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function renderTemplateString(template: string, variables: Record<string, unknown>) {
  return template.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_, key: string) =>
    getVariableValue(variables, key),
  );
}

export async function renderEmailTemplate(
  key: EmailTemplateKey,
  variables: Record<string, unknown>,
) {
  const template = await getEmailTemplate(key);
  const source = template.isActive ? template : toView(defaultTemplateMap.get(key)!);

  return {
    subject: renderTemplateString(source.subject, variables),
    text: renderTemplateString(source.bodyText, variables),
  };
}
