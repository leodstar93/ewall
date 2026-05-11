import { auth } from '@/auth'
import { ClientBillingPage } from './billing'

export default async function BillingPage() {
  const session = await auth()
  return <ClientBillingPage userName={session?.user?.name ?? undefined} />
}
