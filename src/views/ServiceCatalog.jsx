import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { EmptyState, PageHeader } from '@/ds';

/* Placeholder so the router resolves while this module is being built. */
export default function ServiceCatalog() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={ShoppingBag} module="catalog" title="Service Catalog"
        subtitle="Orderable services — being built" />
      <div className="flex-1 overflow-auto p-4">
        <EmptyState icon={ShoppingBag} title="Service Catalog" hint="This module is under construction." />
      </div>
    </div>
  );
}
