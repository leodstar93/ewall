import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ClientDocumentsPage } from './documents'

function fmtSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1_024) return `${Math.round(bytes / 1_024)} KB`
  return `${bytes} B`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function DocumentsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const userId = session.user.id

  const docs = await prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, category: true, fileSize: true, fileUrl: true, createdAt: true },
  })

  const rows = docs.map(d => ({
    id: d.id,
    name: d.name,
    tag: d.category ?? '—',
    size: fmtSize(d.fileSize),
    uploaded: fmtDate(d.createdAt),
    fileUrl: d.fileUrl,
  }))

  return <ClientDocumentsPage docRows={rows} />
}
