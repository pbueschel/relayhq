import React from 'react';
import { useTheme, cx, EmptyState, PageHeader } from '@/ds';
import { Construction } from 'lucide-react';

export default function Approvals() {
  const { t } = useTheme();
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={Construction} accent="gray" title="Approvals" subtitle="Module placeholder" />
      <div className="flex-1 overflow-auto p-4">
        <EmptyState icon={Construction} title="Approvals" hint="This module has not been built yet." />
      </div>
    </div>
  );
}
