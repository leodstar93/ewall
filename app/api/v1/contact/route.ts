import { sendContactFormEmail } from "@/lib/email";

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  message?: unknown;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ContactPayload;

    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const message =
      typeof payload.message === "string" ? payload.message.trim() : "";

    if (!name || !email || !message) {
      return Response.json(
        { error: "Name, email and message are required" },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return Response.json({ error: "Invalid email format" }, { status: 400 });
    }

    await sendContactFormEmail({
      name,
      email,
      phone,
      message,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Contact form submit error:", error);
    return Response.json(
      { error: "Failed to send contact message" },
      { status: 500 },
    );
  }
}
