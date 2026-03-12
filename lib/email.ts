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

export async function sendTemporaryPasswordEmail({
  to,
  name,
  temporaryPassword,
}: SendTemporaryPasswordEmailInput) {
  const apiKey = requiredEnv("RESEND_API_KEY");
  const from = requiredEnv("EMAIL_FROM");

  const loginUrl = "https://leonardocp.com"; //getLoginUrl();

  const salutation = name?.trim() || "there";
  const text = [
    `Hi ${salutation},`,
    "",
    "Your account password has been reset by an administrator.",
    `Temporary password: ${temporaryPassword}`,
    "",
    `Sign in at: ${loginUrl}`,
    "After signing in, please change your password immediately.",
  ].join("\n");

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your password has been reset",
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to send email (${response.status}): ${errorText || "unknown error"}`,
    );
  }
}

export async function sendGoogleCredentialsPasswordEmail({
  to,
  name,
  temporaryPassword,
}: SendTemporaryPasswordEmailInput) {
  const apiKey = requiredEnv("RESEND_API_KEY");
  const from = requiredEnv("EMAIL_FROM");
  const loginUrl = getLoginUrl();

  const salutation = name?.trim() || "there";
  const text = [
    `Hi ${salutation},`,
    "",
    "Your account was created using Google sign-in.",
    "We generated a password so you can also sign in with email and password.",
    `Temporary password: ${temporaryPassword}`,
    "",
    `Sign in at: ${loginUrl}`,
    "After signing in, please change your password immediately.",
  ].join("\n");

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your login password for email sign-in",
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to send email (${response.status}): ${errorText || "unknown error"}`,
    );
  }
}

export async function sendContactFormEmail({
  name,
  email,
  phone,
  message,
}: SendContactFormEmailInput) {
  const apiKey = requiredEnv("RESEND_API_KEY");
  const from = requiredEnv("EMAIL_FROM");
  const contactRecipient = requiredEnv("EMAIL_CONTACT");

  const cleanName = name.trim();
  const cleanEmail = email.trim();
  const cleanPhone = phone?.trim() || "Not provided";
  const cleanMessage = message.trim();

  const text = [
    "New contact form submission",
    "",
    `Name: ${cleanName}`,
    `Email: ${cleanEmail}`,
    `Phone: ${cleanPhone}`,
    "",
    "Message:",
    cleanMessage,
  ].join("\n");

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [contactRecipient],
      subject: `Contact form - ${cleanName}`,
      text,
      reply_to: cleanEmail,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to send email (${response.status}): ${errorText || "unknown error"}`,
    );
  }
}
