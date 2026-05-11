import { auth } from '@/auth'
import { ClientSupportPage } from './support'

export default async function SupportPage() {
  const session = await auth()
  return <ClientSupportPage userName={session?.user?.name ?? undefined} />
}
