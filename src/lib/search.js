import {
  Inbox, CheckSquare, Briefcase, Folder, Layers, Circle, FileText, BookOpen,
  GraduationCap, Monitor, Key, MapPin, GitBranch, AlertOctagon, Workflow, Stamp, User,
} from 'lucide-react';

/**
 * One search index across every record type, used by both the top bar and ⌘K.
 * Kept in one place so the two never drift — in v1 they were separate code
 * paths that happened to agree.
 */

const walkCatalog = (nodes, trail = [], out = []) => {
  for (const n of nodes || []) {
    out.push({ node: n, trail });
    if (n.children) walkCatalog(n.children, [...trail, n.name], out);
  }
  return out;
};

const CATALOG_ICON = { product: Folder, subcategory: Layers, item: Circle };
const CATALOG_ACCENT = { product: 'amber', subcategory: 'purple', item: 'emerald' };

export function searchAll(state, raw) {
  const q = (raw || '').trim().toLowerCase();
  if (!q) return [];
  const hit = (...vals) => vals.some(v => String(v ?? '').toLowerCase().includes(q));
  const out = [];

  for (const tk of state.tickets || []) {
    if (hit(tk.title, tk.id, tk.requesterName, tk.queue)) {
      out.push({ group: 'Tickets', icon: Inbox, accent: 'ticket', id: tk.id,
        title: tk.title, subtitle: [tk.requesterName, tk.queue].filter(Boolean).join(' · '),
        to: ['workspace', 'tickets', tk.id] });
    }
  }
  for (const ap of state.approvals || []) {
    if (hit(ap.subject, ap.id)) {
      out.push({ group: 'Approvals', icon: Stamp, accent: 'approval', id: ap.id,
        title: ap.subject, subtitle: ap.state, to: ['approvals', null, ap.id] });
    }
  }
  for (const ch of state.changes || []) {
    if (hit(ch.title, ch.id)) {
      out.push({ group: 'Changes', icon: GitBranch, accent: 'change', id: ch.id,
        title: ch.title, subtitle: `${ch.changeType || ''} · ${ch.status || ''}`, to: ['changes', null, ch.id] });
    }
  }
  for (const pb of state.problems || []) {
    if (hit(pb.title, pb.id)) {
      out.push({ group: 'Problems', icon: AlertOctagon, accent: 'problem', id: pb.id,
        title: pb.title, subtitle: pb.status, to: ['problems', null, pb.id] });
    }
  }
  for (const ts of state.tasks || []) {
    if (hit(ts.title, ts.id, ts.assigneeId)) {
      out.push({ group: 'Tasks', icon: CheckSquare, accent: ts.projectId ? 'projectTask' : 'task', id: ts.id,
        title: ts.title, subtitle: ts.projectId ? 'Project task' : 'Personal task',
        to: ['workspace', 'tasks', ts.id] });
    }
  }
  for (const p of state.projects || []) {
    if (hit(p.name, p.description)) {
      out.push({ group: 'Projects', icon: Briefcase, accent: 'project', id: p.id,
        title: p.name, subtitle: p.description, to: ['projects', null, p.id] });
    }
  }
  for (const { node, trail } of walkCatalog(state.catalog)) {
    if (hit(node.name)) {
      out.push({ group: 'Catalog', icon: CATALOG_ICON[node.type] || Circle,
        accent: CATALOG_ACCENT[node.type] || 'gray', id: node.id,
        title: node.name, subtitle: trail.length ? trail.join(' › ') : node.type,
        to: ['catalog', null, node.id] });
    }
  }
  for (const kb of state.knowledge || []) {
    if (hit(kb.title, kb.summary, ...(kb.tags || []))) {
      out.push({ group: 'Knowledge', icon: BookOpen, accent: kb.format === 'guide' ? 'guide' : 'article', id: kb.id,
        title: kb.title, subtitle: kb.summary, to: ['knowledge', null, kb.id] });
    }
  }
  for (const c of state.courses || []) {
    if (hit(c.title, c.summary)) {
      out.push({ group: 'Learning', icon: GraduationCap, accent: 'course', id: c.id,
        title: c.title, subtitle: c.summary, to: ['learning', 'courses', c.id] });
    }
  }
  for (const f of state.forms || []) {
    if (hit(f.name, f.description)) {
      out.push({ group: 'Forms', icon: FileText, accent: 'form', id: f.id,
        title: f.name, subtitle: f.description, to: ['forms', null, f.id] });
    }
  }
  for (const a of state.assets || []) {
    if (hit(a.name, a.serial, a.assetTag, a.vendor, a.manufacturer)) {
      out.push({ group: 'Assets', icon: a.kind === 'software' ? Key : Monitor,
        accent: a.kind === 'software' ? 'software' : 'hardware', id: a.id,
        title: a.name, subtitle: a.assetTag || a.vendor || '', to: ['assets', a.kind, a.id] });
    }
  }
  for (const l of state.locations || []) {
    if (hit(l.name, l.address)) {
      out.push({ group: 'Locations', icon: MapPin, accent: 'location', id: l.id,
        title: l.name, subtitle: l.address, to: ['assets', 'locations', l.id] });
    }
  }
  for (const au of state.automations || []) {
    if (hit(au.name, au.description)) {
      out.push({ group: 'Automations', icon: Workflow, accent: 'automation', id: au.id,
        title: au.name, subtitle: au.description, to: ['automations', null, au.id] });
    }
  }
  for (const c of state.contacts || []) {
    if (hit(c.name, c.email)) {
      out.push({ group: 'Contacts', icon: User, accent: 'contact', id: c.id,
        title: c.name, subtitle: c.email, to: ['workspace', 'contacts', c.id] });
    }
  }

  return out;
}

/** Group a flat result list, preserving the order groups first appear in. */
export function groupResults(results) {
  const groups = [];
  results.forEach((r, i) => {
    const g = groups.find(x => x.group === r.group);
    if (g) g.items.push({ ...r, idx: i });
    else groups.push({ group: r.group, items: [{ ...r, idx: i }] });
  });
  return groups;
}
