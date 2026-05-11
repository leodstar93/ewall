import { auth } from '@/auth'
import { ClientDriversPage } from './drivers'

export default async function DriversPage() {
  const session = await auth()
  return <ClientDriversPage userName={session?.user?.name ?? undefined} />
}
