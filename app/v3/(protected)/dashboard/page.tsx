import { auth } from '@/auth'
import { ClientHomePage } from './home'

export default async function DashboardPage() {
  const session = await auth()
  return <ClientHomePage userName={session?.user?.name ?? undefined} />
}
