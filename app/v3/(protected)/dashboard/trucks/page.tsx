import { auth } from '@/auth'
import { ClientTrucksPage } from './trucks'

export default async function TrucksPage() {
  const session = await auth()
  return <ClientTrucksPage userName={session?.user?.name ?? undefined} />
}
