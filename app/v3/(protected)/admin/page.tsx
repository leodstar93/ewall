import { auth } from '@/auth'
import { AdminOverview } from './overview'

export default async function AdminPage() {
  const session = await auth()
  const userName = session?.user?.name ?? 'Admin'
  return <AdminOverview userName={userName} />
}
