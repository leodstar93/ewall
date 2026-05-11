import { auth } from '@/auth'
import { ClientFilingsPage } from './filings'

export default async function FilingsPage() {
  const session = await auth()
  return <ClientFilingsPage userName={session?.user?.name ?? undefined} />
}
