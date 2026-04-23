import { signIn } from "@/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Use NextAuth signIn - this will authenticate credentials via the provider
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!result || !result.ok) {
      return Response.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    return Response.json(
      { success: true, message: "Login successful" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Login error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
