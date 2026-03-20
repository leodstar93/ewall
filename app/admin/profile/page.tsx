import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ProfilePage from "@/app/(dashboard)/users/[id]/profile-client";

export default async function AdminProfilePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <ProfilePage />;
}
