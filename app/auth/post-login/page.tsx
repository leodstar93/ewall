import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPostLoginRedirectPath } from "@/lib/navigation/post-login";

export default async function PostLoginPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  redirect(getPostLoginRedirectPath(session.user.roles));
}
