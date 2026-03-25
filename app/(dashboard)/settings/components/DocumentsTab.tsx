"use client";

import DocumentsPage from "@/features/documents/page-component";

export default function DocumentsTab() {
  return (
    <DocumentsPage
      embedded
      title="Account documents"
      subtitle="Upload, review, and manage your user documents directly inside account settings."
    />
  );
}
