"use client";

import DocumentsPage from "@/features/documents/page-component";

export default function DocumentsTab({
  integrated = false,
}: {
  integrated?: boolean;
}) {
  return (
    <DocumentsPage
      embedded
      integrated={integrated}
      title="Documents"
      subtitle="Manage your documents."
    />
  );
}
