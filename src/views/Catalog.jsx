import React from 'react';
import { useTheme, cx, EmptyState, PageHeader } from '@/ds';
import { Construction } from 'lucide-react';

export default function Catalog() {
  const { t } = useTheme();
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={Construction} accent="gray" title="Catalog" subtitle="Module placeholder" />
      <div className="flex-1 overflow-auto p-4">
        <EmptyState icon={Construction} title="Catalog" hint="This module has not been built yet." />
      </div>
    </div>
  );
}
