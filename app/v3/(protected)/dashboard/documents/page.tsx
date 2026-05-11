import { auth } from '@/auth'
import { ClientDocumentsPage } from './documents'

export default async function DocumentsPage() {
  const session = await auth()
  return <ClientDocumentsPage userName={session?.user?.name ?? undefined} />
}
