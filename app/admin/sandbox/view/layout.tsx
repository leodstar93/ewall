import { redirect } from "next/navigation";
import { getActingContext } from "@/lib/auth/get-acting-context";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";

export default async function SandboxViewLayout(props: {
  children: React.ReactNode;
}) {
  try {
    await requireSandboxAccess();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/forbidden");
  }

  const actingContext = await getActingContext();
  if (!actingContext.actingAsUserId) {
    redirect("/admin/sandbox");
  }

  return props.children;
}
