import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  GraduationCap, BookMarked, BookOpen, Layers, ListChecks, Award, UserCheck,
  Plus, Trash2, ChevronRight, ChevronDown, ArrowUp, ArrowDown, Clock, Check,
  CircleCheck, CircleAlert, TriangleAlert, Info, Play, Pause, Users, Target,
  Link2, Lock, GripVertical, Video, RotateCcw, ShieldCheck, CalendarClock,
  Package, Eye, Settings2, User, Building2, Repeat2, Image as ImageGlyph,
  ArrowLeft, ArrowRight,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, ENTITIES,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, EntityTag,
  Avatar, AvatarStack, EmptyState, Card, Panel, Section, GroupLabel, ListRow, Stat,
  Banner, Divider,
  Field, Input, Textarea, Select, Checkbox, Toggle, TileGroup, SearchInput,
  Modal, ConfirmDelete, Menu, MenuItem, MenuLabel, FilterPill,
  SubTabs, PageHeader, Toolbar, PageBody, Breadcrumbs,
} from '@/ds';
import { useStore, patchIn, addTo, removeFrom, uid, NOW } from '@/store/store.js';
import { navigate } from '@/lib/router.js';
import { USR } from '@/store/seed/ids.js';

/**
 * Learning — the module that proves the thesis.
 *
 * Curriculum > Course > Module > Lesson. A LESSON IS A REFERENCE to a knowledge
 * atom id, never a copy: the same record that the help centre publishes and the
 * agent workspace surfaces beside a ticket. Everything derived from that fact is
 * made visible rather than assumed —
 *
 *   · the course builder badges every atom with where else it is already used,
 *   · the author-once panel counts how many of a course's lessons are live help
 *     articles right now,
 *   · estimated time is SUMMED from the lessons and never typed,
 *   · lessons are blue (the knowledge hue) inside an indigo learning module,
 *     because the colour is the argument.
 */

/* ==================================================================== *
 * Selectors and pure helpers. Nothing here is a component.
 * ==================================================================== */

function pickLearning(s) {
  return {
    curricula: s.curricula, courses: s.courses, knowledge: s.knowledge,
    enrollments: s.enrollments, directory: s.directory, contacts: s.contacts,
    organizations: s.organizations, jobFunctions: s.jobFunctions,
    catalog: s.catalog, currentUser: s.currentUser,
  };
}

const TABS = [
  { value: 'curricula', label: 'Curricula', icon: GraduationCap, accent: 'indigo' },
  { value: 'courses', label: 'Courses', icon: BookMarked, accent: 'indigo' },
  { value: 'learners', label: 'Learners', icon: Users, accent: 'emerald' },
  { value: 'my', label: 'My learning', icon: UserCheck, accent: 'blue' },
];
const TAB_IDS = TABS.map(x => x.value);

const AUDIENCE_LABEL = { internal: 'Internal staff', external: 'External customers', both: 'Both audiences' };
const AUDIENCE_HUE = { internal: 'violet', external: 'green', both: 'teal' };

function indexById(list) {
  const m = new Map();
  for (const r of list || []) m.set(r.id, r);
  return m;
}

function lessonIdsOf(course) {
  return (course?.modules || []).flatMap(m => m.lessonIds || []);
}

function lessonCount(course) {
  return lessonIdsOf(course).length;
}

function minutesOf(course, kb) {
  return lessonIdsOf(course).reduce((n, id) => n + (kb.get(id)?.minutes || 0), 0);
}

function fmtMinutes(n) {
  if (!n) return '0m';
  if (n < 60) return `${n}m`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * `2026-08-21` parses as UTC midnight, which renders as the 20th anywhere west
 * of Greenwich. Seeded due dates are calendar days, so read them as local ones.
 */
function parseDate(value) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(iso) {
  const d = parseDate(iso);
  if (!d) return '—';
  const sameYear = d.getFullYear() === NOW.getFullYear();
  return d.toLocaleDateString('en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysFromNow(iso) {
  const d = parseDate(iso);
  if (!d) return null;
  return Math.round((d.getTime() - NOW.getTime()) / 86400000);
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isDone(enrollment) {
  return enrollment?.status === 'passed';
}

function isOverdue(enrollment) {
  if (!enrollment || isDone(enrollment) || !enrollment.dueAt) return false;
  const due = parseDate(enrollment.dueAt);
  return !!due && due.getTime() < NOW.getTime();
}

/** Progress is DERIVED. Adding a lesson to a live course must move everyone's bar. */
function progressOf(enrollment, course) {
  const total = lessonCount(course);
  if (!total) return 0;
  const done = (enrollment?.completedLessonIds || []).filter(id => lessonIdsOf(course).includes(id));
  return Math.round((done.length / total) * 100);
}

function enrollmentStatus(enrollment) {
  if (isDone(enrollment)) return enrollment.certified ? 'certified' : 'passed';
  if (isOverdue(enrollment)) return 'overdue';
  return enrollment?.status || 'not_started';
}

/** Flatten the catalog to its leaf items — the help-centre surface for an atom. */
function flatItems(nodes, out = []) {
  for (const n of nodes || []) {
    if (n.type === 'item') out.push(n);
    if (n.children) flatItems(n.children, out);
  }
  return out;
}

/** Where else does this atom already live? Reuse is the intended path, so show it. */
function usageOf(lessonId, courses, items, exceptCourseId) {
  return {
    courses: (courses || []).filter(c => c.id !== exceptCourseId && lessonIdsOf(c).includes(lessonId)),
    items: (items || []).filter(i => (i.knowledgeIds || []).includes(lessonId)),
  };
}

function authorOnce(course, kb, items, courses) {
  const ids = lessonIdsOf(course);
  const helpLive = ids.filter(id => {
    const k = kb.get(id);
    return k && k.status === 'published' && items.some(i => (i.knowledgeIds || []).includes(id));
  });
  const shared = ids.filter(id => (courses || []).some(c => c.id !== course.id && lessonIdsOf(c).includes(id)));
  const unpublished = ids.filter(id => (kb.get(id)?.status || 'draft') !== 'published');
  const external = ids.filter(id => ['external', 'both'].includes(kb.get(id)?.audience));
  return { total: ids.length, helpLive, shared, unpublished, external };
}

/** The ordered run of things a learner steps through: lessons, then module quizzes. */
function stepsOf(course) {
  const out = [];
  for (const m of course?.modules || []) {
    for (const id of m.lessonIds || []) out.push({ key: `l:${m.id}:${id}`, kind: 'lesson', lessonId: id, moduleId: m.id });
    if (m.quiz) out.push({ key: `q:${m.quiz.id}`, kind: 'quiz', quizId: m.quiz.id, moduleId: m.id });
  }
  return out;
}

function stepDone(step, enrollment) {
  if (!enrollment) return false;
  if (step.kind === 'lesson') return (enrollment.completedLessonIds || []).includes(step.lessonId);
  return (enrollment.passedQuizIds || []).includes(step.quizId);
}

/** Linear courses gate the next step; per-lesson prerequisites gate on top of that. */
function lockReason(step, index, steps, enrollment, course, kb) {
  if (course.sequencing === 'linear') {
    const priorOpen = steps.slice(0, index).find(s => !stepDone(s, enrollment));
    if (priorOpen) return 'This course is sequenced — finish the step before it first.';
  }
  if (step.kind === 'lesson') {
    const prereqs = (course.lessonPrereqs || {})[step.lessonId] || [];
    const missing = prereqs.filter(id => !(enrollment?.completedLessonIds || []).includes(id));
    if (missing.length) return `Requires: ${missing.map(id => kb.get(id)?.title || id).join(', ')}`;
  }
  return null;
}

function moduleOfLesson(course, lessonId) {
  return (course?.modules || []).find(m => (m.lessonIds || []).includes(lessonId)) || null;
}

function personRecord(id, dirIndex, contactIndex, orgIndex) {
  const p = dirIndex.get(id);
  if (p) return { id, name: p.name, title: p.title, jobFunction: p.jobFunction, kind: 'employee', org: null };
  const c = contactIndex.get(id);
  if (c) {
    return {
      id, name: c.name, title: c.title, jobFunction: 'customer', kind: 'contact',
      org: orgIndex.get(c.orgId)?.name || null,
    };
  }
  return { id, name: id, title: '', jobFunction: null, kind: 'employee', org: null };
}

function curriculumTotals(curriculum, courseIndex, kb) {
  const courses = (curriculum.courseIds || []).map(id => courseIndex.get(id)).filter(Boolean);
  return {
    courses,
    lessons: courses.reduce((n, c) => n + lessonCount(c), 0),
    minutes: courses.reduce((n, c) => n + minutesOf(c, kb), 0),
    modules: courses.reduce((n, c) => n + (c.modules || []).length, 0),
  };
}

function shortTitle(title) {
  const head = String(title || '').split(':')[0];
  return head.length > 26 ? `${head.slice(0, 25)}…` : head;
}

function formatMeta(atom) {
  if (!atom) return { hue: 'gray', label: 'Missing atom', icon: CircleAlert };
  return atom.format === 'guide'
    ? { hue: ENTITIES.guide.hue, label: 'Guide', icon: Layers }
    : { hue: ENTITIES.article.hue, label: 'Article', icon: BookOpen };
}

/* ==================================================================== *
 * Store mutations — every one is a whole-course rewrite so the outline can
 * never drift out of sync with the editor.
 * ==================================================================== */

function writeModules(course, modules) {
  patchIn('courses', course.id, { modules, updatedAt: new Date().toISOString() });
}

function mapModules(course, moduleId, fn) {
  writeModules(course, (course.modules || []).map(m => (m.id === moduleId ? fn(m) : m)));
}

function addLessonsTo(course, moduleId, ids) {
  mapModules(course, moduleId, m => ({
    ...m,
    lessonIds: [...(m.lessonIds || []), ...ids.filter(id => !(m.lessonIds || []).includes(id))],
  }));
}

function dropLesson(course, moduleId, lessonId) {
  mapModules(course, moduleId, m => ({ ...m, lessonIds: (m.lessonIds || []).filter(id => id !== lessonId) }));
}

/** Up/down within a module; at an edge it hops into the neighbouring module. */
function nudgeLesson(course, moduleId, lessonId, dir) {
  const modules = (course.modules || []).map(m => ({ ...m, lessonIds: [...(m.lessonIds || [])] }));
  const mi = modules.findIndex(m => m.id === moduleId);
  if (mi < 0) return;
  const li = modules[mi].lessonIds.indexOf(lessonId);
  if (li < 0) return;
  const target = li + dir;
  if (target >= 0 && target < modules[mi].lessonIds.length) {
    modules[mi].lessonIds.splice(li, 1);
    modules[mi].lessonIds.splice(target, 0, lessonId);
  } else {
    const ni = mi + dir;
    if (ni < 0 || ni >= modules.length) return;
    modules[mi].lessonIds.splice(li, 1);
    if (dir < 0) modules[ni].lessonIds.push(lessonId);
    else modules[ni].lessonIds.unshift(lessonId);
  }
  writeModules(course, modules);
}

function relocateLesson(course, fromModuleId, lessonId, toModuleId, toIndex) {
  const modules = (course.modules || []).map(m => ({ ...m, lessonIds: [...(m.lessonIds || [])] }));
  const from = modules.find(m => m.id === fromModuleId);
  const to = modules.find(m => m.id === toModuleId);
  if (!from || !to) return;
  const li = from.lessonIds.indexOf(lessonId);
  if (li < 0) return;
  // Guard BEFORE mutating: dropping onto a module that already holds this atom
  // must be a no-op, not a removal.
  if (fromModuleId !== toModuleId && to.lessonIds.includes(lessonId)) return;
  from.lessonIds.splice(li, 1);
  const at = toIndex == null || toIndex > to.lessonIds.length ? to.lessonIds.length : toIndex;
  to.lessonIds.splice(at, 0, lessonId);
  writeModules(course, modules);
}

function nudgeModule(course, moduleId, dir) {
  const modules = [...(course.modules || [])];
  const i = modules.findIndex(m => m.id === moduleId);
  const target = i + dir;
  if (i < 0 || target < 0 || target >= modules.length) return;
  const [m] = modules.splice(i, 1);
  modules.splice(target, 0, m);
  writeModules(course, modules);
}

function appendModule(course) {
  const id = uid('mod');
  writeModules(course, [...(course.modules || []), {
    id, title: `Module ${(course.modules || []).length + 1}`, summary: '', lessonIds: [], quiz: null,
  }]);
  return id;
}

function deleteModule(course, moduleId) {
  writeModules(course, (course.modules || []).filter(m => m.id !== moduleId));
}

function setModuleQuiz(course, moduleId, quiz) {
  mapModules(course, moduleId, m => ({ ...m, quiz }));
}

function setPrereqs(course, lessonId, ids) {
  const next = { ...(course.lessonPrereqs || {}) };
  if (ids.length) next[lessonId] = ids;
  else delete next[lessonId];
  patchIn('courses', course.id, { lessonPrereqs: next, updatedAt: new Date().toISOString() });
}

function completeStep(enrollment, course, step, score) {
  const lessons = lessonIdsOf(course);
  const doneLessons = step.kind === 'lesson'
    ? Array.from(new Set([...(enrollment.completedLessonIds || []), step.lessonId]))
    : (enrollment.completedLessonIds || []);
  const doneQuizzes = step.kind === 'quiz'
    ? Array.from(new Set([...(enrollment.passedQuizIds || []), step.quizId]))
    : (enrollment.passedQuizIds || []);
  const remaining = lessons.filter(id => !doneLessons.includes(id));
  const finished = remaining.length === 0;
  patchIn('enrollments', enrollment.id, {
    completedLessonIds: doneLessons,
    passedQuizIds: doneQuizzes,
    currentLessonId: remaining[0] || null,
    status: finished ? 'passed' : 'in_lesson',
    startedAt: enrollment.startedAt || todayISO(),
    completedAt: finished ? todayISO() : null,
    score: finished ? (score ?? enrollment.score ?? 100) : enrollment.score,
    certified: finished ? !!course.certificate : enrollment.certified,
    certificateId: finished && course.certificate ? (enrollment.certificateId || uid('cert')) : enrollment.certificateId,
  });
}

/* ==================================================================== *
 * Local compositions — not new design primitives, just token arrangements
 * the DS has no opinion about (a progress meter and a key/value row).
 * ==================================================================== */

function Meter({ value, accent = 'indigo', showValue = true, className }) {
  const { t, a } = useTheme();
  const c = a(accent);
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <span className={cx('flex items-center gap-2 min-w-0', className)}>
      <span className={cx('flex-1 h-1.5 rounded-full overflow-hidden min-w-8', t.bgSubtle)}>
        <span className={cx('block h-full rounded-full transition-all', c.solid)} style={{ width: `${pct}%` }} />
      </span>
      {showValue && <span className={cx('text-[11px] tabular-nums w-8 text-right flex-shrink-0', t.textMuted)}>{pct}%</span>}
    </span>
  );
}

function Fact({ label, value, hint }) {
  const { t } = useTheme();
  return (
    <div className="min-w-0">
      <p className={cx('text-[10px] font-semibold uppercase tracking-wider', t.textMuted)}>{label}</p>
      <p className={cx('text-sm font-medium truncate', t.text)}>{value}</p>
      {hint && <p className={cx('text-[11px] truncate', t.textMuted)}>{hint}</p>}
    </div>
  );
}

/* ==================================================================== *
 * Root
 * ==================================================================== */

export default function Learning({ route }) {
  const { t } = useTheme();
  const s = useStore(pickLearning);
  const [newCourse, setNewCourse] = useState(false);

  const tab = TAB_IDS.includes(route?.sub) ? route.sub : 'curricula';
  const openId = route?.id || null;

  const kb = useMemo(() => indexById(s.knowledge), [s.knowledge]);
  const courseIndex = useMemo(() => indexById(s.courses), [s.courses]);
  const items = useMemo(() => flatItems(s.catalog), [s.catalog]);
  const dirIndex = useMemo(() => indexById(s.directory), [s.directory]);
  const contactIndex = useMemo(() => indexById(s.contacts), [s.contacts]);
  const orgIndex = useMemo(() => indexById(s.organizations), [s.organizations]);

  const totalLessons = useMemo(
    () => new Set(s.courses.flatMap(c => lessonIdsOf(c))).size, [s.courses]);
  const reusedAtoms = useMemo(() => {
    const seen = new Map();
    for (const c of s.courses) for (const id of new Set(lessonIdsOf(c))) seen.set(id, (seen.get(id) || 0) + 1);
    return [...seen.values()].filter(n => n > 1).length;
  }, [s.courses]);

  const openCourse = tab === 'courses' && openId ? courseIndex.get(openId) : null;
  const openCurriculum = tab === 'curricula' && openId ? s.curricula.find(c => c.id === openId) : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={GraduationCap}
        accent="indigo"
        title="Learning"
        subtitle={`${s.curricula.length} curricula · ${s.courses.length} courses · ${totalLessons} distinct atoms in use · ${reusedAtoms} of them in more than one place`}
        actions={
          <>
            {tab === 'courses' && !openCourse && (
              <Button variant="solid" accent="indigo" icon={Plus} size="sm" onClick={() => setNewCourse(true)}>
                New course
              </Button>
            )}
            {openCourse && (
              <Button variant="outline" size="sm" icon={ArrowLeft} onClick={() => navigate('learning', 'courses')}>
                All courses
              </Button>
            )}
            {openCurriculum && (
              <Button variant="outline" size="sm" icon={ArrowLeft} onClick={() => navigate('learning', 'curricula')}>
                All curricula
              </Button>
            )}
          </>
        }
      >
        <Toolbar>
          <SubTabs
            items={TABS.map(x => ({ ...x, count: tabCount(x.value, s) }))}
            value={tab}
            onChange={(v) => navigate('learning', v)}
          />
        </Toolbar>
      </PageHeader>

      {tab === 'curricula' && !openCurriculum && (
        <PageBody width="max-w-6xl">
          <CurriculaList curricula={s.curricula} courseIndex={courseIndex} kb={kb}
            enrollments={s.enrollments} jobFunctions={s.jobFunctions}
            dirIndex={dirIndex} contactIndex={contactIndex} orgIndex={orgIndex} />
        </PageBody>
      )}

      {tab === 'curricula' && openCurriculum && (
        <PageBody width="max-w-6xl">
          <CurriculumDetail curriculum={openCurriculum} courseIndex={courseIndex} kb={kb}
            enrollments={s.enrollments} jobFunctions={s.jobFunctions} directory={s.directory}
            contacts={s.contacts} dirIndex={dirIndex} contactIndex={contactIndex} orgIndex={orgIndex}
            items={items} />
        </PageBody>
      )}

      {tab === 'courses' && !openCourse && (
        <PageBody width="max-w-6xl">
          <CoursesList courses={s.courses} kb={kb} curricula={s.curricula}
            jobFunctions={s.jobFunctions} enrollments={s.enrollments} items={items} />
        </PageBody>
      )}

      {tab === 'courses' && openCourse && (
        <PageBody width="max-w-7xl">
          <CourseBuilder course={openCourse} courses={s.courses} kb={kb} knowledge={s.knowledge}
            items={items} curricula={s.curricula} jobFunctions={s.jobFunctions}
            enrollments={s.enrollments} dirIndex={dirIndex} />
        </PageBody>
      )}

      {tab === 'learners' && (
        <PageBody width="max-w-7xl">
          <Learners curricula={s.curricula} courses={s.courses} courseIndex={courseIndex} kb={kb}
            enrollments={s.enrollments} directory={s.directory} contacts={s.contacts}
            jobFunctions={s.jobFunctions} dirIndex={dirIndex} contactIndex={contactIndex} orgIndex={orgIndex} />
        </PageBody>
      )}

      {tab === 'my' && (
        <PageBody width="max-w-5xl">
          <MyLearning currentUser={s.currentUser} enrollments={s.enrollments} courseIndex={courseIndex}
            curricula={s.curricula} kb={kb} directory={s.directory} contacts={s.contacts}
            dirIndex={dirIndex} contactIndex={contactIndex} orgIndex={orgIndex} />
        </PageBody>
      )}

      <NewCourseModal open={newCourse} onClose={() => setNewCourse(false)} jobFunctions={s.jobFunctions} />
    </div>
  );
}

function tabCount(value, s) {
  if (value === 'curricula') return s.curricula.length;
  if (value === 'courses') return s.courses.length;
  if (value === 'learners') return new Set(s.enrollments.map(e => e.learnerId)).size;
  return s.enrollments.filter(e => e.learnerId === s.currentUser?.id).length;
}

/* ==================================================================== *
 * CURRICULA
 * ==================================================================== */

function CurriculaList({ curricula, courseIndex, kb, enrollments, jobFunctions, dirIndex, contactIndex, orgIndex }) {
  const { t } = useTheme();
  if (!curricula.length) {
    return <EmptyState icon={GraduationCap} title="No curricula yet"
      hint="A curriculum is the whole reading list for one job function." />;
  }
  return (
    <div className="space-y-6">
      <Banner accent="indigo" icon={Target} title="A curriculum teaches a job function, not a topic">
        Each one below is an argument: <strong className={t.text}>here is everything this role must know</strong>, in
        order, with a competency map showing which course covers what. Every lesson inside is a knowledge atom the
        help centre already publishes — the curriculum is the sequence, not the content.
      </Banner>

      <div className="grid gap-3 @container">
        {curricula.map(cur => (
          <CurriculumCard key={cur.id} curriculum={cur} courseIndex={courseIndex} kb={kb}
            enrollments={enrollments} jobFunctions={jobFunctions}
            dirIndex={dirIndex} contactIndex={contactIndex} orgIndex={orgIndex} />
        ))}
      </div>
    </div>
  );
}

function CurriculumCard({ curriculum, courseIndex, kb, enrollments, jobFunctions, dirIndex, contactIndex, orgIndex }) {
  const { t, a } = useTheme();
  const c = a(ENTITIES.curriculum.hue);
  const totals = curriculumTotals(curriculum, courseIndex, kb);
  const jf = jobFunctions.find(j => j.id === curriculum.jobFunction);
  const learners = learnersFor(curriculum, enrollments);
  const complete = learners.filter(l => l.complete).length;
  const names = learners.map(l => personRecord(l.id, dirIndex, contactIndex, orgIndex).name);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => navigate('learning', 'curricula', curriculum.id)}
        className={cx('w-full text-left flex items-start gap-3', DENSITY.cardPad, t.bgHover)}
      >
        <span className={cx('w-1 self-stretch min-h-12 rounded-full flex-shrink-0', c.rail)} />
        <IconTile icon={GraduationCap} accent={ENTITIES.curriculum.hue} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cx('font-semibold', t.text)}>{curriculum.name}</h3>
            <EntityTag kind="curriculum" />
            <Chip accent={AUDIENCE_HUE[curriculum.audience]}>{AUDIENCE_LABEL[curriculum.audience]}</Chip>
            {curriculum.certificate && <Chip accent={ENTITIES.certificate.hue} icon={Award}>{curriculum.certificateName}</Chip>}
          </div>
          <p className={cx('text-sm mt-1', t.textSecondary)}>{curriculum.summary}</p>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <GroupLabel>Courses</GroupLabel>
            <ChipGroup accent="indigo" icon={BookMarked} max={3}
              items={totals.courses} render={(x) => shortTitle(x.title)} />
          </div>

          <div className={cx('mt-3 grid grid-cols-2 gap-3 @xl:grid-cols-5')}>
            <Fact label="Teaches" value={jf?.label || '—'} hint={jf?.description} />
            <Fact label="Courses" value={totals.courses.length} hint={`${totals.modules} modules`} />
            <Fact label="Lessons" value={totals.lessons} hint="knowledge atoms" />
            <Fact label="Est. time" value={fmtMinutes(totals.minutes)} hint={`target ${curriculum.targetDays} days`} />
            <Fact label="Competencies" value={(curriculum.competencies || []).length} hint="covered by courses" />
          </div>
        </div>
        <div className="hidden @2xl:flex flex-col items-end gap-2 w-40 flex-shrink-0">
          <AvatarStack names={names} max={4} size="md" />
          <Meter value={learners.length ? (complete / learners.length) * 100 : 0} accent="emerald" />
          <span className={cx('text-[11px]', t.textMuted)}>{complete} of {learners.length} complete</span>
        </div>
        <ChevronRight size={ICON.md} className={cx('flex-shrink-0 mt-1', t.textMuted)} />
      </button>
    </Card>
  );
}

/** Everyone who has at least one enrollment in this curriculum's courses. */
function learnersFor(curriculum, enrollments) {
  const ids = curriculum.courseIds || [];
  const byLearner = new Map();
  for (const e of enrollments) {
    if (!ids.includes(e.courseId)) continue;
    if (!byLearner.has(e.learnerId)) byLearner.set(e.learnerId, []);
    byLearner.get(e.learnerId).push(e);
  }
  return [...byLearner.entries()].map(([id, list]) => ({
    id,
    enrollments: list,
    complete: ids.every(cid => list.some(e => e.courseId === cid && isDone(e))),
    overdue: list.some(isOverdue),
  }));
}

function CurriculumDetail({
  curriculum, courseIndex, kb, enrollments, jobFunctions, directory, contacts,
  dirIndex, contactIndex, orgIndex, items,
}) {
  const { t, a } = useTheme();
  const c = a(ENTITIES.curriculum.hue);
  const totals = curriculumTotals(curriculum, courseIndex, kb);
  const jf = jobFunctions.find(j => j.id === curriculum.jobFunction);
  const [addOpen, setAddOpen] = useState(false);

  const externalCourses = totals.courses.filter(x => x.audience !== curriculum.audience);
  const allLessonIds = totals.courses.flatMap(x => lessonIdsOf(x));
  const distinct = new Set(allLessonIds).size;
  const helpLive = [...new Set(allLessonIds)].filter(id => {
    const k = kb.get(id);
    return k && k.status === 'published' && items.some(i => (i.knowledgeIds || []).includes(id));
  }).length;

  const roster = curriculum.audience === 'external'
    ? contacts.map(p => p.id)
    : directory.filter(p => p.jobFunction === curriculum.jobFunction).map(p => p.id);
  const learners = learnersFor(curriculum, enrollments);
  const learnerIndex = new Map(learners.map(l => [l.id, l]));
  const team = roster.map(id => ({
    person: personRecord(id, dirIndex, contactIndex, orgIndex),
    record: learnerIndex.get(id) || null,
  }));
  const completeCount = team.filter(x => x.record?.complete).length;

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[{ id: 'root', name: 'Curricula' }, { id: curriculum.id, name: curriculum.name }]}
        onNavigate={() => navigate('learning', 'curricula')}
      />

      {/* The @container lives on the CARD, never on the grid that queries it —
          an element cannot answer its own container query. */}
      <Card className={cx(DENSITY.cardPad, 'flex items-start gap-3 @container')}>
        <span className={cx('w-1 self-stretch min-h-16 rounded-full flex-shrink-0', c.rail)} />
        <IconTile icon={GraduationCap} accent={ENTITIES.curriculum.hue} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cx('text-lg font-semibold', t.text)}>{curriculum.name}</h2>
            <StatusPill status={curriculum.status} />
            <Chip accent={AUDIENCE_HUE[curriculum.audience]}>{AUDIENCE_LABEL[curriculum.audience]}</Chip>
            {curriculum.certificate && (
              <Chip accent={ENTITIES.certificate.hue} icon={Award}>{curriculum.certificateName}</Chip>
            )}
          </div>
          <p className={cx('text-sm mt-1', t.textSecondary)}>{curriculum.summary}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 @xl:grid-cols-6">
            <Fact label="Job function" value={jf?.label || '—'} hint={jf?.description} />
            <Fact label="Courses" value={totals.courses.length} />
            <Fact label="Modules" value={totals.modules} />
            <Fact label="Lessons" value={totals.lessons} hint={`${distinct} distinct atoms`} />
            <Fact label="Est. time" value={fmtMinutes(totals.minutes)} hint="summed from lessons" />
            <Fact label="Target" value={`${curriculum.targetDays} days`} hint="for a new starter" />
          </div>
        </div>
      </Card>

      <Banner accent="blue" icon={Repeat2} title="Author once, serve three surfaces">
        {helpLive} of the {distinct} distinct atoms in this curriculum are live help-centre content right now.
        Nothing here was written for training — the sequence is the only new artefact.
      </Banner>

      {externalCourses.length > 0 && (
        <Banner accent="amber" icon={Info} title="This curriculum crosses the audience line — deliberately">
          <ChipGroup accent="green" icon={BookMarked} max={2} items={externalCourses} render={(x) => x.title} /> is an
          external academy course inside an internal curriculum. {curriculum.note}
        </Banner>
      )}

      <Section
        title="The programme"
        hint="Ordered. A new starter works down this list; the order is the pedagogy."
        action={
          <div className="relative">
            <Button variant="soft" accent="indigo" size="sm" icon={Plus} onClick={() => setAddOpen(v => !v)}>
              Add course
            </Button>
            <Menu open={addOpen} onClose={() => setAddOpen(false)} align="right" width="w-72">
              <MenuLabel>Courses not yet in this curriculum</MenuLabel>
              {[...courseIndex.values()].filter(x => !(curriculum.courseIds || []).includes(x.id)).map(x => (
                <MenuItem key={x.id} icon={BookMarked} accent="indigo"
                  label={shortTitle(x.title)}
                  hint={`${lessonCount(x)} lessons · ${AUDIENCE_LABEL[x.audience]}`}
                  onClick={() => {
                    patchIn('curricula', curriculum.id, { courseIds: [...(curriculum.courseIds || []), x.id] });
                    setAddOpen(false);
                  }} />
              ))}
            </Menu>
          </div>
        }
      >
        <div className={DENSITY.rowGap}>
          {totals.courses.map((course, i) => (
            <CurriculumCourseRow key={course.id} index={i} course={course} curriculum={curriculum} kb={kb}
              enrollments={enrollments} />
          ))}
          {!totals.courses.length && (
            <EmptyState icon={BookMarked} title="No courses in this curriculum yet"
              hint="Add one from the menu above — courses can appear in more than one curriculum." />
          )}
        </div>
      </Section>

      <Section title="Coverage" hint="Every competency the role needs, and which course covers it. A blank row is a gap in the programme, not a gap in the person.">
        <CoverageMatrix curriculum={curriculum} courses={totals.courses} />
      </Section>

      <Section
        title="Team readiness"
        hint={curriculum.audience === 'external'
          ? `${plural(team.length, 'customer contact', 'customer contacts')} in the academy roster`
          : `${plural(team.length, 'person holds', 'people hold')} the ${jf?.label || 'role'} job function`}
      >
        <Card className={cx(DENSITY.cardPad, 'space-y-3 @container')}>
          <div className="flex items-center gap-3 flex-wrap">
            <Stat label="fully complete" value={`${team.length ? Math.round((completeCount / team.length) * 100) : 0}%`}
              accent="emerald" icon={ShieldCheck} active />
            <Stat label="in progress" value={team.filter(x => x.record && !x.record.complete).length} accent="amber" />
            <Stat label="not started" value={team.filter(x => !x.record).length} accent="gray" />
            <Stat label="overdue" value={team.filter(x => x.record?.overdue).length} accent="red" />
          </div>
          <Divider />
          <div className={DENSITY.rowGap}>
            {team.map(({ person, record }) => (
              <TeamRow key={person.id} person={person} record={record} curriculum={curriculum}
                courseIndex={courseIndex} />
            ))}
          </div>
        </Card>
      </Section>
    </div>
  );
}

function CurriculumCourseRow({ index, course, curriculum, kb, enrollments }) {
  const { t } = useTheme();
  const mins = minutesOf(course, kb);
  const enrolled = enrollments.filter(e => e.courseId === course.id);
  const passed = enrolled.filter(isDone).length;
  return (
    <ListRow
      accent={ENTITIES.course.hue}
      icon={BookMarked}
      title={`${index + 1}. ${course.title}`}
      subtitle={`${(course.modules || []).length} modules · ${lessonCount(course)} lessons · ${fmtMinutes(mins)} · ${course.sequencing === 'linear' ? 'Linear' : 'Free navigation'}`}
      onClick={() => navigate('learning', 'courses', course.id)}
      meta={
        <>
          {course.audience !== curriculum.audience && <Chip accent={AUDIENCE_HUE[course.audience]}>{AUDIENCE_LABEL[course.audience]}</Chip>}
          {course.certificate && <Chip accent={ENTITIES.certificate.hue} icon={Award}>Certificate</Chip>}
          <span className={cx('text-xs tabular-nums', t.textMuted)}>{passed}/{enrolled.length} passed</span>
          <StatusPill status={course.status} />
        </>
      }
      actions={
        <>
          <IconButton icon={ArrowUp} label="Move up" onClick={(e) => { e.stopPropagation(); moveCourseInCurriculum(curriculum, course.id, -1); }} />
          <IconButton icon={ArrowDown} label="Move down" onClick={(e) => { e.stopPropagation(); moveCourseInCurriculum(curriculum, course.id, 1); }} />
          <IconButton icon={Trash2} label="Remove from curriculum" accent="red"
            onClick={(e) => {
              e.stopPropagation();
              patchIn('curricula', curriculum.id, { courseIds: (curriculum.courseIds || []).filter(id => id !== course.id) });
            }} />
        </>
      }
    />
  );
}

function moveCourseInCurriculum(curriculum, courseId, dir) {
  const ids = [...(curriculum.courseIds || [])];
  const i = ids.indexOf(courseId);
  const target = i + dir;
  if (i < 0 || target < 0 || target >= ids.length) return;
  ids.splice(i, 1);
  ids.splice(target, 0, courseId);
  patchIn('curricula', curriculum.id, { courseIds: ids });
}

function CoverageMatrix({ curriculum, courses }) {
  const { t, a } = useTheme();
  const ok = a('emerald');
  const competencies = curriculum.competencies || [];
  const uncovered = competencies.filter(cmp => !(cmp.courseIds || []).some(id => courses.some(c => c.id === id)));

  return (
    <Card className="overflow-hidden">
      <div className={cx(DENSITY.sectionPad, 'flex items-center justify-between gap-3 border-b', t.borderLight)}>
        <div className="flex items-center gap-2 min-w-0">
          <IconTile icon={Target} accent="indigo" size="sm" />
          <span className={cx('text-sm font-medium', t.text)}>{competencies.length} competencies</span>
        </div>
        {uncovered.length
          ? <Chip accent="red" icon={TriangleAlert}>{uncovered.length} not covered</Chip>
          : <Chip accent="emerald" icon={CircleCheck}>Fully covered</Chip>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[44rem]">
          <thead>
            <tr className={cx('border-b', t.border)}>
              <th className={cx('px-3 py-2 font-semibold sticky left-0', t.textMuted, t.bgCard)}>Competency</th>
              {courses.map(c => (
                <th key={c.id} className={cx('px-3 py-2 font-semibold whitespace-nowrap', t.textMuted)}>
                  {shortTitle(c.title)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {competencies.map(cmp => {
              const covered = courses.filter(c => (cmp.courseIds || []).includes(c.id));
              return (
                <tr key={cmp.id} className={cx('border-b last:border-0', t.borderLight)}>
                  <td className={cx('px-3 py-2 sticky left-0', t.bgCard)}>
                    <span className={cx('flex items-center gap-1.5 font-medium', t.text)}>
                      {cmp.label}
                      {!covered.length && <Chip accent="red" icon={TriangleAlert}>no course covers this</Chip>}
                    </span>
                    <span className={cx('block text-[11px]', t.textMuted)}>{cmp.detail}</span>
                  </td>
                  {courses.map(c => {
                    const hit = (cmp.courseIds || []).includes(c.id);
                    return (
                      <td key={c.id} className="px-3 py-2">
                        {hit
                          ? <span className={cx('inline-flex items-center justify-center w-5 h-5 rounded-full', ok.softStrong)}>
                              <Check size={ICON.sm} className={ok.fg} />
                            </span>
                          : <span className={cx('text-xs', t.textMuted)}>·</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TeamRow({ person, record, curriculum, courseIndex }) {
  const { t } = useTheme();
  const courses = (curriculum.courseIds || []).map(id => courseIndex.get(id)).filter(Boolean);
  const enrolled = record?.enrollments || [];
  const doneCourses = courses.filter(c => enrolled.some(e => e.courseId === c.id && isDone(e)));
  const pct = courses.length ? Math.round((doneCourses.length / courses.length) * 100) : 0;
  const missing = courses.filter(c => !enrolled.some(e => e.courseId === c.id));

  return (
    <ListRow
      accent={person.kind === 'contact' ? ENTITIES.contact.hue : ENTITIES.enrollment.hue}
      icon={person.kind === 'contact' ? Building2 : User}
      title={person.name}
      subtitle={[person.title, person.org].filter(Boolean).join(' · ')}
      alert={!!record?.overdue}
      meta={
        <>
          <span className={cx('text-xs tabular-nums', t.textMuted)}>{doneCourses.length}/{courses.length}</span>
          <span className="w-28 hidden @lg:block"><Meter value={pct} accent={pct === 100 ? 'emerald' : 'indigo'} /></span>
          {record?.overdue && <StatusPill status="overdue" />}
          {!record && <StatusPill status="not_started" />}
          {record?.complete && <StatusPill status="passed" />}
        </>
      }
      actions={
        missing.length > 0 ? (
          <Button variant="soft" accent="indigo" size="xs" icon={Plus}
            onClick={() => assignCurriculum(person, curriculum, missing)}>
            Assign {missing.length}
          </Button>
        ) : null
      }
    />
  );
}

function assignCurriculum(person, curriculum, missingCourses) {
  const due = new Date(NOW.getTime() + (curriculum.targetDays || 30) * 86400000).toISOString().slice(0, 10);
  for (const c of missingCourses) {
    addTo('enrollments', {
      id: uid('enr'),
      learnerId: person.id,
      learnerKind: person.kind === 'contact' ? 'contact' : 'employee',
      courseId: c.id,
      curriculumId: curriculum.id,
      assignedById: null,
      status: 'enrolled',
      assignedAt: todayISO(),
      startedAt: null,
      dueAt: due,
      completedAt: null,
      completedLessonIds: [],
      passedQuizIds: [],
      currentLessonId: null,
      score: null,
      attempts: 0,
      certified: false,
      certificateId: null,
    });
  }
}

/* ==================================================================== *
 * COURSES — list
 * ==================================================================== */

function CoursesList({ courses, kb, curricula, jobFunctions, enrollments, items }) {
  const { t } = useTheme();
  const [q, setQ] = useState('');
  const [audience, setAudience] = useState('all');
  const [jf, setJf] = useState('all');

  const filtered = courses.filter(c => {
    if (audience !== 'all' && c.audience !== audience) return false;
    if (jf !== 'all' && c.jobFunction !== jf) return false;
    if (q) {
      const hay = `${c.title} ${c.summary}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const usedJf = [...new Set(courses.map(c => c.jobFunction))];

  return (
    <div className="space-y-4">
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search courses…" accent="indigo" width="w-64" />
        <SubTabs
          value={audience}
          onChange={setAudience}
          items={[
            { value: 'all', label: 'All', icon: Layers, accent: 'indigo' },
            { value: 'internal', label: 'Internal staff', icon: User, accent: 'violet' },
            { value: 'external', label: 'External customers', icon: Building2, accent: 'green' },
          ]}
        />
        <Select
          accent="indigo"
          value={jf}
          onChange={(e) => setJf(e.target.value)}
          className="w-48"
          options={[{ value: 'all', label: 'Every job function' },
            ...usedJf.map(id => ({ value: id, label: jobFunctions.find(j => j.id === id)?.label || id }))]}
        />
      </Toolbar>

      <Banner accent="indigo" icon={BookMarked} title="A course is an ordering, not a document">
        Its lessons are references to knowledge atoms. Open one and the builder shows you, per lesson, everywhere
        else that atom is already doing work — another course, or a help-centre catalog item.
      </Banner>

      <div className={DENSITY.rowGap}>
        {filtered.map(course => (
          <CourseRow key={course.id} course={course} kb={kb} curricula={curricula}
            jobFunctions={jobFunctions} enrollments={enrollments} items={items} courses={courses} />
        ))}
        {!filtered.length && (
          <EmptyState icon={BookMarked} title="No courses match"
            hint="Clear the filters, or create a course and build it from existing atoms." />
        )}
      </div>
    </div>
  );
}

function CourseRow({ course, kb, curricula, jobFunctions, enrollments, items, courses }) {
  const { t } = useTheme();
  const stats = authorOnce(course, kb, items, courses);
  const inCurricula = curricula.filter(c => (c.courseIds || []).includes(course.id));
  const enrolled = enrollments.filter(e => e.courseId === course.id);
  const jf = jobFunctions.find(j => j.id === course.jobFunction);

  return (
    <ListRow
      accent={ENTITIES.course.hue}
      icon={BookMarked}
      title={course.title}
      subtitle={`${(course.modules || []).length} modules · ${stats.total} lessons · ${fmtMinutes(minutesOf(course, kb))} · ${jf?.label || 'unassigned'}`}
      onClick={() => navigate('learning', 'courses', course.id)}
      meta={
        <>
          <Chip accent="blue" icon={Repeat2} title="Lessons that are also live help-centre content">
            {stats.helpLive.length}/{stats.total} also help centre
          </Chip>
          <Chip accent={AUDIENCE_HUE[course.audience]}>{AUDIENCE_LABEL[course.audience]}</Chip>
          {course.certificate && <Chip accent={ENTITIES.certificate.hue} icon={Award}>Certificate</Chip>}
          <span className={cx('text-xs tabular-nums', t.textMuted)}>{enrolled.length} enrolled</span>
          <StatusPill status={course.status} />
        </>
      }
    >
      {inCurricula.length > 0 && (
        <div className="mt-1 flex items-center gap-1.5">
          <span className={cx('text-[10px] uppercase tracking-wider font-semibold', t.textMuted)}>In</span>
          <ChipGroup accent="indigo" icon={GraduationCap} max={2} items={inCurricula} render={(x) => x.name} />
        </div>
      )}
    </ListRow>
  );
}

/* ==================================================================== *
 * COURSE BUILDER — two panes: outline left, editor right
 * ==================================================================== */

function CourseBuilder({ course, courses, kb, knowledge, items, curricula, jobFunctions, enrollments, dirIndex }) {
  const { t } = useTheme();
  const [selection, setSelection] = useState({ kind: null, moduleId: null, lessonId: null });
  const [collapsed, setCollapsed] = useState([]);
  const [picker, setPicker] = useState(null);         // moduleId
  const [questionFor, setQuestionFor] = useState(null); // moduleId
  const [confirm, setConfirm] = useState(null);        // { kind, id, name }
  const [preview, setPreview] = useState(null);        // { stepIndex }
  const drag = useRef(null);

  const stats = authorOnce(course, kb, items, courses);
  const inCurricula = curricula.filter(c => (c.courseIds || []).includes(course.id));
  const owner = dirIndex.get(course.ownerId);

  const selectedModule = selection.moduleId ? (course.modules || []).find(m => m.id === selection.moduleId) : null;
  const selectedAtom = selection.kind === 'lesson' ? kb.get(selection.lessonId) : null;

  const onDropLesson = (toModuleId, toIndex) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    relocateLesson(course, d.moduleId, d.lessonId, toModuleId, toIndex);
  };

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[{ id: 'root', name: 'Courses' }, { id: course.id, name: course.title }]}
        onNavigate={() => navigate('learning', 'courses')}
      />

      <Card className={cx(DENSITY.cardPad, 'flex items-start gap-3')}>
        <IconTile icon={BookMarked} accent={ENTITIES.course.hue} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cx('text-lg font-semibold', t.text)}>{course.title}</h2>
            <EntityTag kind="course" />
            <StatusPill status={course.status} />
            <Chip accent={AUDIENCE_HUE[course.audience]}>{AUDIENCE_LABEL[course.audience]}</Chip>
            <span className={cx('text-[11px]', t.textMuted)}>v{course.version}</span>
          </div>
          <p className={cx('text-sm mt-1', t.textSecondary)}>{course.summary}</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {owner && <Chip accent="gray" icon={User}>{owner.name}</Chip>}
            <ChipGroup accent="indigo" icon={GraduationCap} max={2} items={inCurricula} render={(x) => x.name}
              empty={<Chip accent="amber" icon={CircleAlert}>Not in any curriculum</Chip>} />
          </div>
        </div>
        <Button variant="soft" accent="blue" size="sm" icon={Eye} onClick={() => setPreview({ stepIndex: 0 })}>
          Preview
        </Button>
        <Button variant="outline" size="sm" icon={Trash2}
          onClick={() => setConfirm({ kind: 'course', id: course.id, name: course.title })}>
          Delete
        </Button>
      </Card>

      {stats.unpublished.length > 0 && (
        <Banner accent="amber" icon={TriangleAlert} title="Some lessons point at atoms that are not published">
          <ChipGroup accent="amber" icon={BookOpen} max={3} items={stats.unpublished}
            render={(id) => kb.get(id)?.title || id} />{' '}
          — learners see a placeholder until Knowledge publishes them. Nothing is copied here, so publishing there
          fixes it everywhere at once.
        </Banner>
      )}

      <div className="@container">
        <div className="grid gap-3 items-start @4xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* ---------------- OUTLINE ---------------- */}
          <Card className="overflow-hidden">
            <div className={cx(DENSITY.sectionPad, 'flex items-center justify-between gap-2 border-b', t.borderLight)}>
              <div className="flex items-center gap-2 min-w-0">
                <IconTile icon={Layers} accent={ENTITIES.courseModule.hue} size="sm" />
                <div className="min-w-0">
                  <p className={cx('text-sm font-medium', t.text)}>Outline</p>
                  <p className={cx('text-[11px]', t.textMuted)}>
                    {(course.modules || []).length} modules · {stats.total} lessons · {fmtMinutes(minutesOf(course, kb))}
                  </p>
                </div>
              </div>
              <IconButton icon={Plus} label="Add module" accent="indigo"
                onClick={() => { const id = appendModule(course); setSelection({ kind: 'module', moduleId: id, lessonId: null }); }} />
            </div>

            <div className="p-2 space-y-2">
              {(course.modules || []).map((m, mi) => (
                <ModuleGroup
                  key={m.id}
                  course={course}
                  module={m}
                  index={mi}
                  kb={kb}
                  courses={courses}
                  items={items}
                  collapsed={collapsed.includes(m.id)}
                  onToggle={() => setCollapsed(list => list.includes(m.id) ? list.filter(x => x !== m.id) : [...list, m.id])}
                  selection={selection}
                  onSelect={setSelection}
                  onAddLesson={() => setPicker(m.id)}
                  onDeleteModule={() => setConfirm({ kind: 'module', id: m.id, name: m.title })}
                  drag={drag}
                  onDropLesson={onDropLesson}
                />
              ))}
              {!(course.modules || []).length && (
                <EmptyState icon={Layers} title="No modules yet"
                  hint="A module groups lessons that belong together and can carry its own quiz."
                  action={<Button variant="solid" accent="indigo" size="sm" icon={Plus}
                    onClick={() => appendModule(course)}>Add module</Button>} />
              )}
            </div>

            <div className={cx('px-3 py-2 border-t text-[11px]', t.borderLight, t.textMuted)}>
              Drag a lesson between modules, or use the arrows — at the top or bottom of a module the arrow moves it
              into the neighbouring one.
            </div>
          </Card>

          {/* ---------------- EDITOR ----------------
              Its own container, so the field grids inside condense off the
              PANE's width rather than the whole builder's. */}
          <div className="space-y-3 @container">
            <AuthorOncePanel course={course} stats={stats} kb={kb} items={items} courses={courses} />

            {selection.kind === 'lesson' && selectedAtom && (
              <LessonEditor
                course={course} atom={selectedAtom} moduleId={selection.moduleId}
                courses={courses} items={items} kb={kb}
                onClear={() => setSelection({ kind: null, moduleId: null, lessonId: null })}
                onPreview={() => {
                  const steps = stepsOf(course);
                  const i = steps.findIndex(s => s.kind === 'lesson' && s.lessonId === selectedAtom.id);
                  setPreview({ stepIndex: Math.max(0, i) });
                }}
              />
            )}

            {selection.kind === 'module' && selectedModule && (
              <ModuleEditor
                course={course} module={selectedModule} kb={kb}
                onClear={() => setSelection({ kind: null, moduleId: null, lessonId: null })}
                onAddQuestion={() => setQuestionFor(selectedModule.id)}
              />
            )}

            {!selection.kind && (
              <CourseSettings course={course} kb={kb} jobFunctions={jobFunctions} enrollments={enrollments} />
            )}
          </div>
        </div>
      </div>

      <LessonPicker
        open={!!picker}
        onClose={() => setPicker(null)}
        course={course}
        moduleId={picker}
        knowledge={knowledge}
        courses={courses}
        items={items}
      />

      <QuestionModal
        open={!!questionFor}
        onClose={() => setQuestionFor(null)}
        course={course}
        moduleId={questionFor}
      />

      <ConfirmDelete
        open={!!confirm}
        name={confirm?.name || ''}
        kind={confirm?.kind === 'course' ? 'course' : 'module'}
        cascadeNote={confirm?.kind === 'course'
          ? 'Enrollments on this course are deleted with it. The knowledge atoms it referenced are untouched — they belong to Knowledge, not to this course.'
          : 'The module and its quiz are removed. The lessons inside it are references, so the atoms themselves are not deleted.'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm.kind === 'course') {
            for (const e of enrollments.filter(x => x.courseId === course.id)) removeFrom('enrollments', e.id);
            removeFrom('courses', course.id);
            navigate('learning', 'courses');
          } else {
            deleteModule(course, confirm.id);
            setSelection({ kind: null, moduleId: null, lessonId: null });
          }
          setConfirm(null);
        }}
      />

      {preview && (
        <LessonPlayer
          open
          onClose={() => setPreview(null)}
          course={course}
          enrollment={null}
          kb={kb}
          startStepIndex={preview.stepIndex}
        />
      )}
    </div>
  );
}

function ModuleGroup({
  course, module, index, kb, courses, items, collapsed, onToggle, selection, onSelect,
  onAddLesson, onDeleteModule, drag, onDropLesson,
}) {
  const { t, a } = useTheme();
  const c = a(ENTITIES.courseModule.hue);
  const mins = (module.lessonIds || []).reduce((n, id) => n + (kb.get(id)?.minutes || 0), 0);
  const active = selection.kind === 'module' && selection.moduleId === module.id;

  const onOver = (e) => { e.preventDefault(); };

  return (
    <div
      className={cx('rounded-lg border', active ? cx(c.soft, c.borderStrong) : cx(t.bgCard, t.borderLight))}
      onDragOver={onOver}
      onDrop={(e) => { e.preventDefault(); onDropLesson(module.id, null); }}
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        <IconButton
          icon={collapsed ? ChevronRight : ChevronDown}
          label={collapsed ? 'Expand module' : 'Collapse module'}
          onClick={onToggle}
        />
        <button
          onClick={() => onSelect({ kind: 'module', moduleId: module.id, lessonId: null })}
          className="flex-1 min-w-0 text-left"
        >
          <span className={cx('block text-sm font-medium truncate', t.text)}>{index + 1}. {module.title}</span>
          <span className={cx('block text-[11px] truncate', t.textMuted)}>
            {(module.lessonIds || []).length} lessons · {fmtMinutes(mins)}{module.quiz ? ' · quiz' : ''}
          </span>
        </button>
        {module.quiz && <ListChecks size={ICON.base} className={a(ENTITIES.quiz.hue).fg} />}
        <IconButton icon={ArrowUp} label="Move module up" onClick={() => nudgeModule(course, module.id, -1)} />
        <IconButton icon={ArrowDown} label="Move module down" onClick={() => nudgeModule(course, module.id, 1)} />
        <IconButton icon={Trash2} label="Delete module" accent="red" onClick={onDeleteModule} />
      </div>

      {!collapsed && (
        <div className="px-2 pb-2 space-y-1">
          {(module.lessonIds || []).map((id, li) => (
            <LessonRow
              key={id}
              course={course}
              moduleId={module.id}
              lessonId={id}
              index={li}
              atom={kb.get(id)}
              courses={courses}
              items={items}
              selected={selection.kind === 'lesson' && selection.lessonId === id && selection.moduleId === module.id}
              onSelect={() => onSelect({ kind: 'lesson', moduleId: module.id, lessonId: id })}
              drag={drag}
              onDropLesson={onDropLesson}
            />
          ))}
          <button
            onClick={onAddLesson}
            className={cx('w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed text-xs',
              t.borderLight, t.textMuted, t.bgHover)}
          >
            <Plus size={ICON.sm} /> Add lesson from knowledge
          </button>
        </div>
      )}
    </div>
  );
}

function LessonRow({ course, moduleId, lessonId, index, atom, courses, items, selected, onSelect, drag, onDropLesson }) {
  const { t, a } = useTheme();
  const c = a(ENTITIES.lesson.hue);
  const meta = formatMeta(atom);
  const usage = usageOf(lessonId, courses, items, course.id);
  const reused = usage.courses.length + usage.items.length;
  const prereqs = (course.lessonPrereqs || {})[lessonId] || [];

  return (
    <div
      draggable
      onDragStart={() => { drag.current = { moduleId, lessonId }; }}
      onDragEnd={() => { drag.current = null; }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropLesson(moduleId, index); }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
      className={cx('group flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing',
        selected ? cx(c.soft, c.borderStrong) : cx('border-transparent', t.bgHover))}
    >
      <GripVertical size={ICON.sm} className={cx('flex-shrink-0', t.textMuted)} />
      <span className={cx('w-1 self-stretch min-h-6 rounded-full flex-shrink-0', c.rail)} />
      <meta.icon size={ICON.base} className={cx('flex-shrink-0', a(meta.hue).fg)} />
      <div className="flex-1 min-w-0">
        <span className={cx('block text-xs font-medium truncate', t.text)}>{atom?.title || lessonId}</span>
        <span className={cx('flex items-center gap-1.5 text-[10px]', t.textMuted)}>
          <span>{atom?.minutes || 0}m</span>
          {atom?.check?.length > 0 && <span>· {atom.check.length} check</span>}
          {prereqs.length > 0 && <span className="inline-flex items-center gap-0.5"><Lock size={9} />{prereqs.length}</span>}
          {atom && atom.status !== 'published' && <span className={a('amber').fg}>· {atom.status}</span>}
        </span>
      </div>
      {reused > 0 && (
        <span title={`Also used in ${reused} other place${reused === 1 ? '' : 's'}`}
          className={cx('flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
            a('blue').soft, a('blue').fgOnSoft)}>
          <Repeat2 size={9} />{reused}
        </span>
      )}
      <span className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <IconButton icon={ArrowUp} label="Move up" size={ICON.sm}
          onClick={(e) => { e.stopPropagation(); nudgeLesson(course, moduleId, lessonId, -1); }} />
        <IconButton icon={ArrowDown} label="Move down" size={ICON.sm}
          onClick={(e) => { e.stopPropagation(); nudgeLesson(course, moduleId, lessonId, 1); }} />
        <IconButton icon={Trash2} label="Remove lesson" accent="red" size={ICON.sm}
          onClick={(e) => { e.stopPropagation(); dropLesson(course, moduleId, lessonId); }} />
      </span>
    </div>
  );
}

function AuthorOncePanel({ course, stats, kb, items, courses }) {
  const { t, a } = useTheme();
  const blue = a('blue');
  const pct = stats.total ? Math.round((stats.helpLive.length / stats.total) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <div className={cx(DENSITY.cardPad, 'flex items-start gap-3', blue.soft)}>
        <IconTile icon={Repeat2} accent="blue" size="lg" />
        <div className="flex-1 min-w-0">
          <p className={cx('text-sm font-semibold', t.text)}>
            {stats.helpLive.length} of {stats.total} lessons are also published help articles — authored once, serving both.
          </p>
          <p className={cx('text-xs mt-0.5', t.textSecondary)}>
            Every lesson in this course is a reference to a knowledge atom. Editing one in Knowledge updates the
            course, the help centre and the agent panel in the same keystroke.
          </p>
          <div className="mt-2 max-w-xs"><Meter value={pct} accent="blue" /></div>
        </div>
      </div>
      <div className={cx('grid grid-cols-2 @xl:grid-cols-4 divide-x border-t', t.divide, t.borderLight)}>
        <div className="px-3 py-2">
          <p className={cx('text-lg font-semibold tabular-nums', t.text)}>{stats.helpLive.length}</p>
          <p className={cx('text-[11px]', t.textMuted)}>live help articles</p>
        </div>
        <div className="px-3 py-2">
          <p className={cx('text-lg font-semibold tabular-nums', t.text)}>{stats.shared.length}</p>
          <p className={cx('text-[11px]', t.textMuted)}>shared with other courses</p>
        </div>
        <div className="px-3 py-2">
          <p className={cx('text-lg font-semibold tabular-nums', t.text)}>{stats.external.length}</p>
          <p className={cx('text-[11px]', t.textMuted)}>customer-facing atoms</p>
        </div>
        <div className="px-3 py-2">
          <p className={cx('text-lg font-semibold tabular-nums', t.text)}>{stats.unpublished.length}</p>
          <p className={cx('text-[11px]', t.textMuted)}>not published yet</p>
        </div>
      </div>
    </Card>
  );
}

function CourseSettings({ course, kb, jobFunctions, enrollments }) {
  const { t } = useTheme();
  const mins = minutesOf(course, kb);
  const enrolled = enrollments.filter(e => e.courseId === course.id);
  const set = (patch) => patchIn('courses', course.id, { ...patch, updatedAt: new Date().toISOString() });

  return (
    <Panel icon={Settings2} accent="indigo" title="Course settings"
      subtitle="Selected nothing in the outline, so this is the course itself">
      <div className={cx(DENSITY.cardPad, 'space-y-4')}>
        <Field label="Title" required>
          <Input accent="indigo" value={course.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Summary" hint="Shown in the catalog of courses and on the learner's card.">
          <Textarea accent="indigo" rows={2} value={course.summary} onChange={(e) => set({ summary: e.target.value })} />
        </Field>

        <Field label="Audience" hint="Internal courses never appear in the customer academy, and vice versa.">
          <TileGroup
            value={course.audience}
            onChange={(v) => set({ audience: v })}
            columns={2}
            options={[
              { value: 'internal', label: 'Internal staff', icon: User, accent: 'violet', hint: 'Northwind employees' },
              { value: 'external', label: 'External customers', icon: Building2, accent: 'green', hint: 'Northwind Academy' },
            ]}
          />
        </Field>

        <div className="grid gap-3 @xl:grid-cols-2">
          <Field label="Job function" hint="What role this course serves.">
            <Select accent="indigo" value={course.jobFunction || ''} onChange={(e) => set({ jobFunction: e.target.value })}
              options={jobFunctions.map(j => ({ value: j.id, label: j.label }))} />
          </Field>
          <Field label="Status">
            <Select accent="indigo" value={course.status} onChange={(e) => set({ status: e.target.value })}
              options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]} />
          </Field>
        </div>

        <Field label="Estimated time" hint="Derived — the sum of every lesson's minutes. Reorder or add a lesson and it moves on its own.">
          <div className={cx('flex items-center gap-2 rounded-lg px-3 py-2 border', t.bgSubtle, t.borderLight)}>
            <Clock size={ICON.base} className={t.textMuted} />
            <span className={cx('text-sm font-medium tabular-nums', t.text)}>{fmtMinutes(mins)}</span>
            <span className={cx('text-xs', t.textMuted)}>across {lessonCount(course)} lessons</span>
          </div>
        </Field>

        <Field label="Sequencing" hint="Linear locks each step behind the one before it. Free navigation lets a learner dip in when a ticket calls for it.">
          <TileGroup
            value={course.sequencing}
            onChange={(v) => set({ sequencing: v })}
            columns={2}
            options={[
              { value: 'linear', label: 'Linear', icon: ArrowRight, accent: 'indigo', hint: 'in order' },
              { value: 'free', label: 'Free navigation', icon: Layers, accent: 'teal', hint: 'any order' },
            ]}
          />
        </Field>

        <div className="grid gap-3 @xl:grid-cols-2">
          <Field label="Passing score" hint="Applies to every knowledge check in the course unless a quiz overrides it.">
            <Input accent="indigo" type="number" min="0" max="100" value={course.passingScore}
              onChange={(e) => set({ passingScore: Number(e.target.value) })} />
          </Field>
          <Field label="Certificate">
            <div className="space-y-2">
              <Toggle accent="amber" checked={!!course.certificate}
                onChange={(v) => set({ certificate: v })}
                label={course.certificate ? 'Issues a certificate' : 'No certificate'} />
              {course.certificate && (
                <Input accent="amber" value={course.certificateName || ''} placeholder="Certificate name"
                  onChange={(e) => set({ certificateName: e.target.value })} />
              )}
            </div>
          </Field>
        </div>

        <Banner accent="blue" icon={Info}>
          {enrolled.length} people are enrolled. Because progress is stored as completed lesson ids rather than a
          percentage, adding a lesson here correctly drops everyone's bar instead of leaving a number that used to be true.
        </Banner>
      </div>
    </Panel>
  );
}

function LessonEditor({ course, atom, moduleId, courses, items, kb, onClear, onPreview }) {
  const { t, a } = useTheme();
  const meta = formatMeta(atom);
  const usage = usageOf(atom.id, courses, items, course.id);
  const prereqs = (course.lessonPrereqs || {})[atom.id] || [];
  const module = (course.modules || []).find(m => m.id === moduleId);
  const before = [];
  for (const m of course.modules || []) {
    for (const id of m.lessonIds || []) {
      if (id === atom.id) break;
      before.push(id);
    }
    if ((m.lessonIds || []).includes(atom.id)) break;
  }

  return (
    <Panel
      icon={meta.icon}
      accent={ENTITIES.lesson.hue}
      title={atom.title}
      subtitle={`Lesson in ${module?.title || 'this course'} · ${meta.label} · ${atom.minutes || 0} min`}
      action={
        <div className="flex items-center gap-1">
          <Button variant="soft" accent="blue" size="xs" icon={Play} onClick={onPreview}>Play</Button>
          <IconButton icon={ChevronRight} label="Back to course settings" onClick={onClear} />
        </div>
      }
    >
      <div className={cx(DENSITY.cardPad, 'space-y-4')}>
        <Banner accent="blue" icon={Link2} title="This lesson is a reference, not a copy">
          The body lives in Knowledge as <strong className={t.text}>{atom.id}</strong>. Edit it there and every course
          and help-centre surface below changes with it.
        </Banner>

        <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
          <Fact label="Format" value={meta.label} />
          <Fact label="Audience" value={AUDIENCE_LABEL[atom.audience]} />
          <Fact label="Minutes" value={atom.minutes || 0} />
          <Fact label="Status" value={atom.status} />
        </div>

        {atom.objective && (
          <div>
            <GroupLabel>Objective</GroupLabel>
            <p className={cx('text-sm mt-1', t.textSecondary)}>{atom.objective}</p>
          </div>
        )}

        <div>
          <GroupLabel>Already in use</GroupLabel>
          <div className="mt-1.5 space-y-1.5">
            {usage.courses.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cx('text-xs', t.textMuted)}>Also in course</span>
                <ChipGroup accent="indigo" icon={BookMarked} max={3} items={usage.courses} render={(x) => shortTitle(x.title)} />
              </div>
            )}
            {usage.items.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cx('text-xs', t.textMuted)}>Also on catalog item</span>
                <ChipGroup accent="emerald" icon={Package} max={3} items={usage.items} render={(x) => x.name} />
              </div>
            )}
            {!usage.courses.length && !usage.items.length && (
              <p className={cx('text-xs', t.textMuted)}>
                Only used here so far. That is allowed, but an atom that serves one surface is the exception in RelayHQ.
              </p>
            )}
          </div>
        </div>

        <Field label="Prerequisites" hint="Lessons earlier in this course that must be finished first. Course-scoped — it does not change the atom.">
          <div className="space-y-1.5">
            {before.length === 0 && <p className={cx('text-xs', t.textMuted)}>Nothing precedes this lesson in the outline.</p>}
            {before.map(id => (
              <Checkbox
                key={id}
                accent="blue"
                checked={prereqs.includes(id)}
                onChange={(v) => setPrereqs(course, atom.id, v ? [...prereqs, id] : prereqs.filter(x => x !== id))}
                label={kb.get(id)?.title || id}
                hint={`${kb.get(id)?.minutes || 0} min · ${formatMeta(kb.get(id)).label}`}
              />
            ))}
          </div>
        </Field>

        <div>
          <div className="flex items-center justify-between gap-2">
            <GroupLabel>Knowledge check on the atom</GroupLabel>
            <Chip accent={ENTITIES.quiz.hue} icon={ListChecks}>{(atom.check || []).length} questions</Chip>
          </div>
          {(atom.check || []).length === 0 ? (
            <p className={cx('text-xs mt-1', t.textMuted)}>
              This atom carries no check. The module quiz still applies — add one on the module if this content must be assessed.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {atom.check.map(q => <QuestionCard key={q.id} question={q} />)}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function QuestionCard({ question, onRemove }) {
  const { t, a } = useTheme();
  const amber = a(ENTITIES.quiz.hue);
  const ok = a('emerald');
  return (
    <div className={cx('rounded-lg border p-2.5', t.bgSubtle, t.borderLight)}>
      <div className="flex items-start gap-2">
        <ListChecks size={ICON.base} className={cx('mt-0.5 flex-shrink-0', amber.fg)} />
        <div className="flex-1 min-w-0">
          <p className={cx('text-xs font-medium', t.text)}>{question.prompt}</p>
          <ul className="mt-1 space-y-0.5">
            {(question.options || []).map(o => (
              <li key={o.id} className={cx('text-[11px] flex items-center gap-1.5', o.correct ? ok.fg : t.textMuted)}>
                {o.correct ? <Check size={10} /> : <span className="w-2.5" />}
                {o.label}
              </li>
            ))}
          </ul>
          {question.explanation && <p className={cx('text-[11px] mt-1 italic', t.textMuted)}>{question.explanation}</p>}
        </div>
        <Chip accent="gray">{question.type}</Chip>
        {onRemove && <IconButton icon={Trash2} label="Remove question" accent="red" size={ICON.sm} onClick={onRemove} />}
      </div>
    </div>
  );
}

function ModuleEditor({ course, module, kb, onClear, onAddQuestion }) {
  const { t } = useTheme();
  const mins = (module.lessonIds || []).reduce((n, id) => n + (kb.get(id)?.minutes || 0), 0);

  return (
    <Panel
      icon={Layers}
      accent={ENTITIES.courseModule.hue}
      title={module.title}
      subtitle={`${(module.lessonIds || []).length} lessons · ${fmtMinutes(mins)}`}
      action={<IconButton icon={ChevronRight} label="Back to course settings" onClick={onClear} />}
    >
      <div className={cx(DENSITY.cardPad, 'space-y-4')}>
        <Field label="Module title" required>
          <Input accent="indigo" value={module.title}
            onChange={(e) => mapModules(course, module.id, m => ({ ...m, title: e.target.value }))} />
        </Field>
        <Field label="Summary" hint="One line on what this module gets the learner to.">
          <Textarea accent="indigo" rows={2} value={module.summary || ''}
            onChange={(e) => mapModules(course, module.id, m => ({ ...m, summary: e.target.value }))} />
        </Field>

        <div>
          <GroupLabel>Lessons in order</GroupLabel>
          <div className="mt-1.5 space-y-1">
            {(module.lessonIds || []).map((id, i) => {
              const atom = kb.get(id);
              const meta = formatMeta(atom);
              return (
                <div key={id} className={cx('flex items-center gap-2 px-2 py-1.5 rounded-lg border', t.bgCard, t.borderLight)}>
                  <span className={cx('text-[11px] tabular-nums w-4', t.textMuted)}>{i + 1}</span>
                  <meta.icon size={ICON.sm} className={t.textMuted} />
                  <span className={cx('flex-1 text-xs truncate', t.text)}>{atom?.title || id}</span>
                  <span className={cx('text-[11px]', t.textMuted)}>{atom?.minutes || 0}m</span>
                </div>
              );
            })}
            {!(module.lessonIds || []).length && (
              <p className={cx('text-xs', t.textMuted)}>Empty module — add a lesson from the outline.</p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <GroupLabel>Module quiz</GroupLabel>
            <Toggle
              accent="amber"
              checked={!!module.quiz}
              onChange={(v) => setModuleQuiz(course, module.id, v
                ? { id: uid('quiz'), title: `${module.title} check`, passingScore: course.passingScore, questions: [] }
                : null)}
              label={module.quiz ? 'On' : 'Off'}
            />
          </div>
          {!module.quiz ? (
            <Banner accent="gray" icon={Info}>
              Without a module quiz, the only assessment in this module is whatever check each atom carries of its own.
            </Banner>
          ) : (
            <div className="space-y-2">
              <div className="grid gap-2 @xl:grid-cols-2">
                <Field label="Quiz title">
                  <Input accent="amber" value={module.quiz.title}
                    onChange={(e) => setModuleQuiz(course, module.id, { ...module.quiz, title: e.target.value })} />
                </Field>
                <Field label="Passing score" hint={`Course default is ${course.passingScore}%`}>
                  <Input accent="amber" type="number" min="0" max="100" value={module.quiz.passingScore}
                    onChange={(e) => setModuleQuiz(course, module.id, { ...module.quiz, passingScore: Number(e.target.value) })} />
                </Field>
              </div>
              {(module.quiz.questions || []).map(q => (
                <QuestionCard key={q.id} question={q}
                  onRemove={() => setModuleQuiz(course, module.id, {
                    ...module.quiz,
                    questions: module.quiz.questions.filter(x => x.id !== q.id),
                  })} />
              ))}
              <Button variant="soft" accent="amber" size="sm" icon={Plus} onClick={onAddQuestion}>Add question</Button>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ==================================================================== *
 * Lesson picker — the reuse surface
 * ==================================================================== */

function LessonPicker({ open, onClose, course, moduleId, knowledge, courses, items }) {
  const { t, a } = useTheme();
  const [q, setQ] = useState('');
  const [format, setFormat] = useState('all');
  const [audience, setAudience] = useState('all');
  const [picked, setPicked] = useState([]);

  useEffect(() => { if (open) { setPicked([]); setQ(''); } }, [open, moduleId]);

  const already = new Set(lessonIdsOf(course));
  const rows = (knowledge || []).filter(k => {
    if (format !== 'all' && k.format !== format) return false;
    if (audience !== 'all' && k.audience !== audience && k.audience !== 'both') return false;
    if (q) {
      const hay = `${k.title} ${k.summary} ${(k.tags || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const totalMinutes = picked.reduce((n, id) => n + ((knowledge.find(k => k.id === id)?.minutes) || 0), 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      accent={ENTITIES.lesson.hue}
      size="modalLg"
      icon={BookOpen}
      title="Add lessons from knowledge"
      subtitle="Every atom in the knowledge base is eligible. Reuse is the intended path."
      footer={
        <>
          <span className={cx('text-sm', t.textMuted)}>
            {picked.length} selected · {fmtMinutes(totalMinutes)} added to the course estimate
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="solid" accent="indigo" icon={Plus} disabled={!picked.length}
              onClick={() => { addLessonsTo(course, moduleId, picked); onClose(); }}>
              Add {picked.length || ''} lesson{picked.length === 1 ? '' : 's'}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-3">
        <Banner accent="blue" icon={Link2} title="Adding a lesson references the atom — it is never copied">
          If an atom is already a help article or a lesson in another course, that is the point. One author, one
          revision history, three surfaces.
        </Banner>

        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput value={q} onChange={setQ} placeholder="Search titles, summaries and tags…" accent="blue" width="w-64" />
          <SubTabs value={format} onChange={setFormat} items={[
            { value: 'all', label: 'All', accent: 'blue' },
            { value: 'guide', label: 'Guides', icon: Layers, accent: 'purple' },
            { value: 'article', label: 'Articles', icon: BookOpen, accent: 'blue' },
          ]} />
          <SubTabs value={audience} onChange={setAudience} items={[
            { value: 'all', label: 'Any audience', accent: 'gray' },
            { value: 'internal', label: 'Internal', icon: User, accent: 'violet' },
            { value: 'external', label: 'Customer', icon: Building2, accent: 'green' },
          ]} />
        </div>

        <div className={DENSITY.rowGap}>
          {rows.map(k => (
            <PickerRow
              key={k.id}
              atom={k}
              inCourse={already.has(k.id)}
              picked={picked.includes(k.id)}
              onToggle={() => setPicked(list => list.includes(k.id) ? list.filter(x => x !== k.id) : [...list, k.id])}
              usage={usageOf(k.id, courses, items, course.id)}
            />
          ))}
          {!rows.length && <EmptyState icon={BookOpen} title="No atoms match" hint="Widen the filters." />}
        </div>
      </div>
    </Modal>
  );
}

function PickerRow({ atom, inCourse, picked, onToggle, usage }) {
  const { t, a } = useTheme();
  const meta = formatMeta(atom);
  const c = a(ENTITIES.lesson.hue);

  return (
    <div
      onClick={() => !inCourse && onToggle()}
      role="button"
      tabIndex={inCourse ? -1 : 0}
      onKeyDown={(e) => { if (e.key === 'Enter' && !inCourse) onToggle(); }}
      className={cx('flex items-start gap-3 rounded-lg border', DENSITY.rowPad,
        inCourse ? cx(t.bgSubtle, t.borderLight, 'opacity-70')
          : picked ? cx(c.soft, c.borderStrong, 'cursor-pointer')
            : cx(t.bgCard, t.borderLight, t.bgHover, 'cursor-pointer'))}
    >
      {/* stopPropagation so the checkbox and the row do not both toggle. */}
      <span className="mt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox accent="blue" checked={picked || inCourse} onChange={() => !inCourse && onToggle()} />
      </span>
      <meta.icon size={ICON.md} className={cx('flex-shrink-0 mt-0.5', a(meta.hue).fg)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cx('text-sm font-medium', t.text)}>{atom.title}</span>
          <Chip accent={meta.hue}>{meta.label}</Chip>
          <Chip accent={AUDIENCE_HUE[atom.audience]}>{AUDIENCE_LABEL[atom.audience]}</Chip>
          <span className={cx('text-xs tabular-nums', t.textMuted)}>{atom.minutes || 0} min</span>
          {atom.status !== 'published' && <StatusPill status={atom.status} />}
          {(atom.check || []).length > 0 && (
            <Chip accent={ENTITIES.quiz.hue} icon={ListChecks}>{atom.check.length} check</Chip>
          )}
        </div>
        <p className={cx('text-xs mt-0.5', t.textMuted)}>{atom.summary}</p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {usage.courses.length > 0 && (
            <ChipGroup accent="indigo" icon={BookMarked} max={2} items={usage.courses}
              render={(x) => `also in ${shortTitle(x.title)}`} />
          )}
          {usage.items.length > 0 && (
            <ChipGroup accent="emerald" icon={Package} max={2} items={usage.items}
              render={(x) => `also on ${x.name}`} />
          )}
          {inCourse && <Chip accent="gray" icon={Check}>Already in this course</Chip>}
        </div>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Add a question to a module quiz
 * ==================================================================== */

function QuestionModal({ open, onClose, course, moduleId }) {
  const { t } = useTheme();
  const [type, setType] = useState('single');
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState([
    { id: 'o1', label: '', correct: true },
    { id: 'o2', label: '', correct: false },
    { id: 'o3', label: '', correct: false },
  ]);
  const [explanation, setExplanation] = useState('');
  const [boolCorrect, setBoolCorrect] = useState('o1');

  useEffect(() => {
    if (!open) return;
    setType('single'); setPrompt(''); setExplanation(''); setBoolCorrect('o1');
    setOptions([{ id: 'o1', label: '', correct: true }, { id: 'o2', label: '', correct: false }, { id: 'o3', label: '', correct: false }]);
  }, [open, moduleId]);

  const module = (course.modules || []).find(m => m.id === moduleId);
  const boolOptions = [
    { id: 'o1', label: 'True', correct: boolCorrect === 'o1' },
    { id: 'o2', label: 'False', correct: boolCorrect === 'o2' },
  ];
  const effective = type === 'boolean' ? boolOptions : options;
  const valid = prompt.trim() && effective.some(o => o.correct) && effective.every(o => o.label.trim());

  const commit = () => {
    if (!module?.quiz || !valid) return;
    setModuleQuiz(course, moduleId, {
      ...module.quiz,
      questions: [...(module.quiz.questions || []), {
        id: uid('q'), type, prompt: prompt.trim(), options: effective, explanation: explanation.trim() || undefined,
      }],
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      accent={ENTITIES.quiz.hue}
      size="modalMd"
      icon={ListChecks}
      title="Add a quiz question"
      subtitle={module ? `${module.title} · ${(module.quiz?.questions || []).length} questions so far` : ''}
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>Mark at least one option correct.</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="solid" accent="amber" icon={Check} disabled={!valid} onClick={commit}>Add question</Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Question type">
          <TileGroup
            value={type} onChange={setType} columns={3} accent="amber"
            options={[
              { value: 'single', label: 'Single choice', icon: CircleCheck },
              { value: 'multi', label: 'Multiple', icon: ListChecks },
              { value: 'boolean', label: 'True / false', icon: Check },
            ]}
          />
        </Field>
        <Field label="Prompt" required>
          <Textarea accent="amber" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="A customer pastes a live API key into a ticket. What do you do first?" />
        </Field>
        {type !== 'boolean' && (
          <Field label="Options" hint="Tick the correct answer or answers.">
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2">
                  <Checkbox accent="amber" checked={o.correct}
                    onChange={(v) => setOptions(list => list.map((x, xi) => {
                      if (xi !== i) return type === 'single' ? { ...x, correct: false } : x;
                      return { ...x, correct: v };
                    }))} />
                  <Input accent="amber" value={o.label} placeholder={`Option ${i + 1}`}
                    onChange={(e) => setOptions(list => list.map((x, xi) => xi === i ? { ...x, label: e.target.value } : x))} />
                </div>
              ))}
              <Button variant="ghost" size="xs" icon={Plus}
                onClick={() => setOptions(list => [...list, { id: `o${list.length + 1}`, label: '', correct: false }])}>
                Add option
              </Button>
            </div>
          </Field>
        )}
        {type === 'boolean' && (
          <Field label="Correct answer">
            <TileGroup
              value={boolCorrect}
              onChange={setBoolCorrect}
              columns={2} accent="amber"
              options={[{ value: 'o1', label: 'True', icon: Check }, { value: 'o2', label: 'False', icon: CircleAlert }]}
            />
          </Field>
        )}
        <Field label="Explanation" hint="Shown after the learner answers. This is where the teaching actually happens.">
          <Textarea accent="amber" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function NewCourseModal({ open, onClose, jobFunctions }) {
  const { t } = useTheme();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [audience, setAudience] = useState('internal');
  const [jf, setJf] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(''); setSummary(''); setAudience('internal');
    setJf(jobFunctions[0]?.id || '');
  }, [open, jobFunctions]);

  const create = () => {
    const id = uid('crs');
    addTo('courses', {
      id, title: title.trim() || 'Untitled course', summary: summary.trim(),
      audience, jobFunction: jf, status: 'draft', ownerId: null, version: '0.1',
      updatedAt: new Date().toISOString(), sequencing: 'linear', passingScore: 80,
      certificate: false, lessonPrereqs: {},
      modules: [{ id: uid('mod'), title: 'Module 1', summary: '', lessonIds: [], quiz: null }],
    });
    onClose();
    navigate('learning', 'courses', id);
  };

  return (
    <Modal
      open={open} onClose={onClose} accent={ENTITIES.course.hue} size="modalMd" icon={BookMarked}
      title="New course" subtitle="An empty frame. The content already exists in Knowledge."
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>Starts as a draft with one empty module.</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="solid" accent="indigo" icon={Plus} disabled={!title.trim()} onClick={create}>Create course</Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required>
          <Input accent="indigo" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Handling escalations for enterprise accounts" />
        </Field>
        <Field label="Summary">
          <Textarea accent="indigo" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <Field label="Audience">
          <TileGroup value={audience} onChange={setAudience} columns={2}
            options={[
              { value: 'internal', label: 'Internal staff', icon: User, accent: 'violet' },
              { value: 'external', label: 'External customers', icon: Building2, accent: 'green' },
            ]} />
        </Field>
        <Field label="Job function">
          <Select accent="indigo" value={jf} onChange={(e) => setJf(e.target.value)}
            options={jobFunctions.map(j => ({ value: j.id, label: j.label }))} />
        </Field>
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * LEARNERS
 * ==================================================================== */

function Learners({
  curricula, courses, courseIndex, kb, enrollments, directory, contacts,
  jobFunctions, dirIndex, contactIndex, orgIndex,
}) {
  const { t } = useTheme();
  const [jf, setJf] = useState('all');
  const [courseId, setCourseId] = useState('all');
  const [expanded, setExpanded] = useState(null);

  const byLearner = new Map();
  for (const e of enrollments) {
    if (!byLearner.has(e.learnerId)) byLearner.set(e.learnerId, []);
    byLearner.get(e.learnerId).push(e);
  }

  const rows = [...byLearner.entries()]
    .map(([id, list]) => ({ person: personRecord(id, dirIndex, contactIndex, orgIndex), enrollments: list }))
    .filter(r => {
      if (jf !== 'all' && r.person.jobFunction !== jf) return false;
      if (courseId !== 'all' && !r.enrollments.some(e => e.courseId === courseId)) return false;
      return true;
    })
    .sort((a, b) => a.person.name.localeCompare(b.person.name));

  const overdueCount = rows.reduce((n, r) => n + r.enrollments.filter(isOverdue).length, 0);
  const certCount = rows.reduce((n, r) => n + r.enrollments.filter(e => e.certified).length, 0);

  return (
    <div className="space-y-5 @container">
      <Section title="Curriculum readiness" hint="The manager's question: can this team do the job yet?">
        <div className="grid gap-3 @2xl:grid-cols-3">
          {curricula.map(cur => (
            <RollupCard key={cur.id} curriculum={cur} courseIndex={courseIndex} enrollments={enrollments}
              directory={directory} contacts={contacts} jobFunctions={jobFunctions} />
          ))}
        </div>
      </Section>

      <Section title="Learners" hint={`${plural(rows.length, 'person', 'people')} with at least one enrollment · ${overdueCount} overdue · ${plural(certCount, 'certificate', 'certificates')} issued`}>
        <Toolbar className="mb-3">
          <Select accent="emerald" value={jf} onChange={(e) => setJf(e.target.value)} className="w-52"
            options={[{ value: 'all', label: 'Every job function' },
              ...jobFunctions.map(j => ({ value: j.id, label: j.label }))]} />
          <Select accent="emerald" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-64"
            options={[{ value: 'all', label: 'Every course' },
              ...courses.map(c => ({ value: c.id, label: shortTitle(c.title) }))]} />
        </Toolbar>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[52rem]">
              <thead>
                <tr className={cx('border-b', t.border)}>
                  {['Learner', 'Enrolled in', 'Progress', 'Overdue', 'Last completion', ''].map(h => (
                    <th key={h} className={cx('px-3 py-2 text-[11px] font-semibold uppercase tracking-wider', t.textMuted)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <LearnerRows
                    key={r.person.id}
                    row={r}
                    courseIndex={courseIndex}
                    expanded={expanded === r.person.id}
                    onToggle={() => setExpanded(x => x === r.person.id ? null : r.person.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <EmptyState icon={Users} title="Nobody matches" hint="Clear the filters above." />}
        </Card>
      </Section>
    </div>
  );
}

function RollupCard({ curriculum, courseIndex, enrollments, directory, contacts, jobFunctions }) {
  const { t } = useTheme();
  const jf = jobFunctions.find(j => j.id === curriculum.jobFunction);
  const roster = curriculum.audience === 'external'
    ? contacts
    : directory.filter(p => p.jobFunction === curriculum.jobFunction);
  const ids = curriculum.courseIds || [];
  const learners = learnersFor(curriculum, enrollments);
  const index = new Map(learners.map(l => [l.id, l]));
  const complete = roster.filter(p => index.get(p.id)?.complete).length;
  const started = roster.filter(p => index.get(p.id) && !index.get(p.id).complete).length;
  const pct = roster.length ? Math.round((complete / roster.length) * 100) : 0;

  return (
    <Card className={cx(DENSITY.cardPad, 'space-y-2')}>
      <div className="flex items-center gap-2 min-w-0">
        <IconTile icon={GraduationCap} accent={ENTITIES.curriculum.hue} size="sm" />
        <div className="min-w-0 flex-1">
          <button onClick={() => navigate('learning', 'curricula', curriculum.id)}
            className={cx('text-sm font-medium truncate block text-left hover:underline', t.text)}>
            {curriculum.name}
          </button>
          <p className={cx('text-[11px] truncate', t.textMuted)}>
            {jf?.label} · {plural(ids.length, 'course', 'courses')} · {plural(roster.length, 'person', 'people')}
          </p>
        </div>
      </div>
      <Meter value={pct} accent={pct >= 75 ? 'emerald' : pct >= 40 ? 'amber' : 'red'} />
      <div className="flex items-center gap-2 flex-wrap">
        <Chip accent="emerald" icon={ShieldCheck}>{complete} complete</Chip>
        <Chip accent="amber">{started} in progress</Chip>
        <Chip accent="gray">{Math.max(0, roster.length - complete - started)} not started</Chip>
      </div>
      <p className={cx('text-[11px]', t.textMuted)}>
        {pct}% of the {jf?.label || 'team'} roster has finished every course in this curriculum.
      </p>
    </Card>
  );
}

function LearnerRows({ row, courseIndex, expanded, onToggle }) {
  const { t } = useTheme();
  const { person, enrollments } = row;
  const courses = enrollments.map(e => courseIndex.get(e.courseId)).filter(Boolean);
  const pcts = enrollments.map(e => progressOf(e, courseIndex.get(e.courseId)));
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  const overdue = enrollments.filter(isOverdue);
  const lastDone = enrollments.filter(e => e.completedAt).map(e => e.completedAt).sort().pop();

  return (
    <>
      <tr className={cx('border-b', t.borderLight, t.bgHover, 'cursor-pointer')} onClick={onToggle}>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={person.name} size="md" />
            <div className="min-w-0">
              <span className={cx('block text-sm font-medium truncate', t.text)}>{person.name}</span>
              <span className={cx('block text-[11px] truncate', t.textMuted)}>
                {[person.title, person.org].filter(Boolean).join(' · ')}
              </span>
            </div>
            {person.kind === 'contact' && <Chip accent={ENTITIES.contact.hue} icon={Building2}>Customer</Chip>}
          </div>
        </td>
        <td className="px-3 py-2">
          <ChipGroup accent="indigo" icon={BookMarked} max={2} items={courses} render={(c) => shortTitle(c.title)} />
        </td>
        <td className="px-3 py-2 w-40"><Meter value={avg} accent={avg === 100 ? 'emerald' : 'indigo'} /></td>
        <td className="px-3 py-2">
          {overdue.length ? <StatusPill status="overdue" /> : <span className={cx('text-xs', t.textMuted)}>—</span>}
        </td>
        <td className={cx('px-3 py-2 text-xs whitespace-nowrap', t.textSecondary)}>{fmtDate(lastDone)}</td>
        <td className="px-3 py-2">
          {expanded ? <ChevronDown size={ICON.base} className={t.textMuted} /> : <ChevronRight size={ICON.base} className={t.textMuted} />}
        </td>
      </tr>
      {expanded && (
        <tr className={cx('border-b', t.borderLight)}>
          <td colSpan={6} className={cx('px-3 py-3', t.bgSubtle)}>
            <div className={DENSITY.rowGap}>
              {enrollments.map(e => {
                const course = courseIndex.get(e.courseId);
                if (!course) return null;
                const pct = progressOf(e, course);
                const due = daysFromNow(e.dueAt);
                return (
                  <ListRow
                    key={e.id}
                    accent={ENTITIES.enrollment.hue}
                    icon={BookMarked}
                    title={course.title}
                    subtitle={`${(e.completedLessonIds || []).length} of ${lessonCount(course)} lessons · assigned ${fmtDate(e.assignedAt)}${e.dueAt ? ` · due ${fmtDate(e.dueAt)}` : ''}`}
                    onClick={() => navigate('learning', 'courses', course.id)}
                    meta={
                      <>
                        <span className="w-24"><Meter value={pct} accent={pct === 100 ? 'emerald' : 'indigo'} showValue={false} /></span>
                        <span className={cx('text-xs tabular-nums w-9 text-right', t.textMuted)}>{pct}%</span>
                        {e.score != null && <Chip accent="gray">{e.score}%</Chip>}
                        {e.certified && <Chip accent={ENTITIES.certificate.hue} icon={Award}>{course.certificateName || 'Certified'}</Chip>}
                        {isOverdue(e) && <Chip accent="red" icon={CalendarClock}>{Math.abs(due)}d late</Chip>}
                        <StatusPill status={enrollmentStatus(e)} />
                      </>
                    }
                  />
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ==================================================================== *
 * MY LEARNING
 * ==================================================================== */

function MyLearning({
  currentUser, enrollments, courseIndex, curricula, kb, directory, contacts,
  dirIndex, contactIndex, orgIndex,
}) {
  const { t } = useTheme();
  // The demo's live learner is Sam, twelve days into the Support Agent
  // curriculum. That is a deliberate default and the banner below says so —
  // switching back to the signed-in user is one click.
  const demoLearnerId = USR.SAM;
  const [viewerId, setViewerId] = useState(demoLearnerId);
  const [menu, setMenu] = useState(false);
  const [player, setPlayer] = useState(null);   // { enrollmentId, stepIndex }

  const viewer = personRecord(viewerId, dirIndex, contactIndex, orgIndex);
  const mine = enrollments.filter(e => e.learnerId === viewerId);
  const active = mine.filter(e => !isDone(e));
  const done = mine.filter(isDone);
  const learnerIds = [...new Set(enrollments.map(e => e.learnerId))];

  const curriculum = curricula.find(c => mine.some(e => e.curriculumId === c.id));
  const curCourses = curriculum ? (curriculum.courseIds || []).map(id => courseIndex.get(id)).filter(Boolean) : [];
  const curLessons = curCourses.reduce((n, c) => n + lessonCount(c), 0);
  const curDone = curCourses.reduce((n, c) => {
    const e = mine.find(x => x.courseId === c.id);
    return n + (e ? (e.completedLessonIds || []).filter(id => lessonIdsOf(c).includes(id)).length : 0);
  }, 0);

  const resume = active.find(e => (e.completedLessonIds || []).length > 0) || active[0] || null;
  const resumeCourse = resume ? courseIndex.get(resume.courseId) : null;

  const openPlayer = (enrollment, stepIndex) => setPlayer({ enrollmentId: enrollment.id, stepIndex });
  const playerEnrollment = player ? enrollments.find(e => e.id === player.enrollmentId) : null;
  const playerCourse = playerEnrollment ? courseIndex.get(playerEnrollment.courseId) : null;

  return (
    <div className="space-y-5">
      <Banner accent="blue" icon={Info} title="Viewing as a learner">
        This tab shows one person's enrollments. It is currently showing{' '}
        <strong className={t.text}>{viewer.name}</strong>
        {viewerId === demoLearnerId ? ' — the new support agent, twelve days in, so the demo has a live story' : ''}.
        {viewerId !== currentUser?.id && (
          <>
            {' '}You are signed in as {currentUser?.name}.{' '}
            <button className={cx('underline', t.text)} onClick={() => setViewerId(currentUser?.id)}>
              Switch to your own learning
            </button>.
          </>
        )}
      </Banner>

      <Card className={cx(DENSITY.cardPad, 'flex items-center gap-3 flex-wrap')}>
        <Avatar name={viewer.name} size="xl" />
        <div className="min-w-0 flex-1">
          <p className={cx('font-semibold', t.text)}>{viewer.name}</p>
          <p className={cx('text-xs', t.textMuted)}>{[viewer.title, viewer.org].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="relative">
          <FilterPill icon={Users} label="View as" active={menu} open={menu} onClick={() => setMenu(v => !v)} />
          <Menu open={menu} onClose={() => setMenu(false)} align="right" width="w-64">
            <MenuLabel>Learners with enrollments</MenuLabel>
            {learnerIds.map(id => {
              const p = personRecord(id, dirIndex, contactIndex, orgIndex);
              return (
                <MenuItem key={id} icon={p.kind === 'contact' ? Building2 : User} accent="blue"
                  label={p.name} hint={[p.title, p.org].filter(Boolean).join(' · ')}
                  selected={id === viewerId}
                  onClick={() => { setViewerId(id); setMenu(false); }} />
              );
            })}
          </Menu>
        </div>
      </Card>

      {curriculum && (
        <Card className={cx(DENSITY.cardPad, 'space-y-2')}>
          <div className="flex items-center gap-2 flex-wrap">
            <IconTile icon={GraduationCap} accent={ENTITIES.curriculum.hue} size="sm" />
            <span className={cx('text-sm font-medium', t.text)}>{curriculum.name}</span>
            <Chip accent="indigo">{curCourses.length} courses</Chip>
            {curriculum.certificate && <Chip accent={ENTITIES.certificate.hue} icon={Award}>{curriculum.certificateName}</Chip>}
          </div>
          <Meter value={curLessons ? (curDone / curLessons) * 100 : 0} accent="indigo" />
          <p className={cx('text-xs', t.textMuted)}>
            {curDone} of {curLessons} lessons across the whole curriculum ·{' '}
            {curCourses.filter(c => isDone(mine.find(e => e.courseId === c.id) || {})).length} of {curCourses.length} courses finished
          </p>
        </Card>
      )}

      {resume && resumeCourse && (
        <Card accent="blue" className="overflow-hidden">
          <div className={cx(DENSITY.cardPad, 'flex items-center gap-3 flex-wrap')}>
            <IconTile icon={Play} accent="blue" size="lg" />
            <div className="flex-1 min-w-0">
              <GroupLabel>Pick up where you left off</GroupLabel>
              <p className={cx('text-sm font-medium truncate', t.text)}>
                {kb.get(resume.currentLessonId)?.title || resumeCourse.title}
              </p>
              <p className={cx('text-xs truncate', t.textMuted)}>
                {resumeCourse.title} · {moduleOfLesson(resumeCourse, resume.currentLessonId)?.title || 'first module'}
              </p>
            </div>
            <div className="w-40"><Meter value={progressOf(resume, resumeCourse)} accent="blue" /></div>
            <Button variant="solid" accent="blue" icon={Play}
              onClick={() => {
                const steps = stepsOf(resumeCourse);
                const i = Math.max(0, steps.findIndex(s => !stepDone(s, resume)));
                openPlayer(resume, i);
              }}>
              Resume
            </Button>
          </div>
        </Card>
      )}

      <Section title="In progress" hint={`${active.length} course${active.length === 1 ? '' : 's'} assigned and not finished`}>
        <div className={DENSITY.rowGap}>
          {active.map(e => (
            <EnrollmentCard key={e.id} enrollment={e} course={courseIndex.get(e.courseId)} kb={kb}
              onPlay={(i) => openPlayer(e, i)} />
          ))}
          {!active.length && <EmptyState icon={CircleCheck} title="Nothing outstanding" hint="Every assigned course is finished." />}
        </div>
      </Section>

      {done.length > 0 && (
        <Section title="Completed" hint={`${done.filter(e => e.certified).length} certificates`}>
          <div className={DENSITY.rowGap}>
            {done.map(e => {
              const course = courseIndex.get(e.courseId);
              if (!course) return null;
              return (
                <ListRow
                  key={e.id}
                  accent="emerald"
                  icon={CircleCheck}
                  title={course.title}
                  subtitle={`Completed ${fmtDate(e.completedAt)} · ${lessonCount(course)} lessons · ${e.attempts} attempt${e.attempts === 1 ? '' : 's'}`}
                  onClick={() => navigate('learning', 'courses', course.id)}
                  meta={
                    <>
                      {e.score != null && <Chip accent="gray">{e.score}%</Chip>}
                      {e.certified && <Chip accent={ENTITIES.certificate.hue} icon={Award}>{course.certificateName || 'Certified'}</Chip>}
                      <StatusPill status={enrollmentStatus(e)} />
                    </>
                  }
                />
              );
            })}
          </div>
        </Section>
      )}

      {player && playerEnrollment && playerCourse && (
        <LessonPlayer
          open
          onClose={() => setPlayer(null)}
          course={playerCourse}
          enrollment={playerEnrollment}
          kb={kb}
          startStepIndex={player.stepIndex}
        />
      )}
    </div>
  );
}

function EnrollmentCard({ enrollment, course, kb, onPlay }) {
  const { t, a } = useTheme();
  if (!course) return null;
  const steps = stepsOf(course);
  const pct = progressOf(enrollment, course);
  const overdue = isOverdue(enrollment);
  const due = daysFromNow(enrollment.dueAt);
  const nextIndex = Math.max(0, steps.findIndex(s => !stepDone(s, enrollment)));

  return (
    <Card accent={overdue ? 'red' : 'indigo'} className="overflow-hidden">
      <div className={cx(DENSITY.cardPad, 'flex items-start gap-3')}>
        <IconTile icon={BookMarked} accent={ENTITIES.course.hue} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cx('text-sm font-medium', t.text)}>{course.title}</span>
            <StatusPill status={enrollmentStatus(enrollment)} />
            {overdue && <Chip accent="red" icon={CalendarClock}>{Math.abs(due)} days late</Chip>}
            {!overdue && enrollment.dueAt && <Chip accent="gray" icon={CalendarClock}>due {fmtDate(enrollment.dueAt)}</Chip>}
          </div>
          <p className={cx('text-xs mt-0.5', t.textMuted)}>{course.summary}</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex-1 max-w-xs"><Meter value={pct} accent={overdue ? 'red' : 'indigo'} /></span>
            <span className={cx('text-[11px]', t.textMuted)}>
              {(enrollment.completedLessonIds || []).length} of {lessonCount(course)} lessons · {fmtMinutes(minutesOf(course, kb))} total
            </span>
          </div>
        </div>
        <Button variant="solid" accent="blue" size="sm" icon={Play} onClick={() => onPlay(nextIndex)}>
          {(enrollment.completedLessonIds || []).length ? 'Continue' : 'Start'}
        </Button>
      </div>

      <div className={cx('border-t px-3 py-2 flex items-center gap-1.5 flex-wrap', t.borderLight, t.bgSubtle)}>
        {steps.map((s, i) => {
          const atom = s.kind === 'lesson' ? kb.get(s.lessonId) : null;
          const label = s.kind === 'lesson' ? (atom?.title || s.lessonId) : 'Module quiz';
          const finished = stepDone(s, enrollment);
          const hue = s.kind === 'quiz' ? ENTITIES.quiz.hue : ENTITIES.lesson.hue;
          const c = a(finished ? 'emerald' : hue);
          return (
            <button
              key={s.key}
              onClick={() => onPlay(i)}
              title={label}
              className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium max-w-[12rem]',
                finished ? cx(c.soft, c.fgOnSoft) : cx(t.bgCard, t.textMuted, 'border', t.borderLight))}
            >
              {finished ? <Check size={9} /> : (s.kind === 'quiz' ? <ListChecks size={9} /> : <BookOpen size={9} />)}
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ==================================================================== *
 * LESSON PLAYER
 *
 * Guides reuse the Stories presentation (segmented timer, one frame at a
 * time, auto-advance honouring prefers-reduced-motion via index.css).
 * Articles get a readable prose column. Both end in the atom's own check.
 * ==================================================================== */

function LessonPlayer({ open, onClose, course, enrollment, kb, startStepIndex }) {
  const { t, a } = useTheme();
  const steps = useMemo(() => stepsOf(course), [course]);
  const [stepIndex, setStepIndex] = useState(startStepIndex || 0);
  const [slide, setSlide] = useState(0);
  const [phase, setPhase] = useState('content');
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setStepIndex(startStepIndex || 0);
    setSlide(0); setPhase('content'); setAnswers({}); setResult(null); setPlaying(false);
  }, [startStepIndex, course.id]);

  const step = steps[stepIndex];
  const atom = step?.kind === 'lesson' ? kb.get(step.lessonId) : null;
  const module = (course.modules || []).find(m => m.id === step?.moduleId);
  const quiz = step?.kind === 'quiz' ? module?.quiz : null;
  const slides = atom?.format === 'guide' ? (atom.slides || []) : [];
  const questions = step?.kind === 'quiz' ? (quiz?.questions || []) : (atom?.check || []);
  const locked = enrollment ? lockReason(step, stepIndex, steps, enrollment, course, kb) : null;

  const doneCount = enrollment ? steps.filter(s => stepDone(s, enrollment)).length : 0;

  // Auto-advance for guide frames. Paused by default: motion is opt-in.
  useEffect(() => {
    if (!open || !playing || phase !== 'content' || !slides.length) return undefined;
    const secs = slides[slide]?.seconds || 0;
    if (!secs) return undefined;
    const id = setTimeout(() => {
      setSlide(i => (i + 1 < slides.length ? i + 1 : i));
      if (slide + 1 >= slides.length) setPlaying(false);
    }, secs * 1000);
    return () => clearTimeout(id);
  }, [open, playing, phase, slide, slides, stepIndex]);

  if (!step) {
    return (
      <Modal open={open} onClose={onClose} accent={ENTITIES.course.hue} size="modalMd" icon={BookMarked}
        title={course.title} subtitle="Nothing to play yet">
        <EmptyState icon={BookOpen} title="This course has no lessons"
          hint="Add lessons to a module from the outline — every one of them is an atom that already exists in Knowledge." />
      </Modal>
    );
  }

  const goStep = (next) => {
    if (next < 0 || next >= steps.length) return;
    setStepIndex(next); setSlide(0); setPhase('content'); setAnswers({}); setResult(null); setPlaying(false);
  };

  const submit = () => {
    let correct = 0;
    for (const q of questions) {
      const picked = answers[q.id] || [];
      const right = (q.options || []).filter(o => o.correct).map(o => o.id).sort().join(',');
      if (picked.slice().sort().join(',') === right) correct += 1;
    }
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 100;
    const bar = quiz?.passingScore ?? course.passingScore ?? 80;
    setResult({ score, correct, total: questions.length, passed: score >= bar, bar });
  };

  const commit = (score) => {
    if (enrollment) completeStep(enrollment, course, step, score);
    if (stepIndex + 1 < steps.length) goStep(stepIndex + 1);
    else onClose();
  };

  const headerTitle = step.kind === 'quiz' ? (quiz?.title || 'Module quiz') : (atom?.title || step.lessonId);
  const accent = step.kind === 'quiz' ? ENTITIES.quiz.hue : ENTITIES.lesson.hue;
  const stepLabel = `${module?.title || 'Module'} · step ${stepIndex + 1} of ${steps.length}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      accent={accent}
      size="modalXl"
      className="@container"
      icon={step.kind === 'quiz' ? ListChecks : (atom?.format === 'guide' ? Layers : BookOpen)}
      title={headerTitle}
      subtitle={`${course.title} · ${stepLabel}${atom ? ` · ${atom.minutes || 0} min` : ''}`}
      footer={
        <>
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="outline" size="sm" icon={ArrowLeft}
              disabled={phase === 'content' && stepIndex === 0 && slide === 0}
              onClick={() => {
                if (phase === 'check') { setPhase('content'); setResult(null); return; }
                if (slide > 0) { setSlide(i => i - 1); return; }
                goStep(stepIndex - 1);
              }}>
              Previous
            </Button>
            {enrollment && (
              <span className="hidden @lg:flex items-center gap-2 w-40">
                <Meter value={steps.length ? (doneCount / steps.length) * 100 : 0} accent="emerald" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!enrollment && <span className={cx('text-xs', t.textMuted)}>Preview — nothing is recorded</span>}
            {phase === 'content' && slides.length > 0 && slide + 1 < slides.length && (
              <Button variant="solid" accent="blue" size="sm" iconRight={ArrowRight} onClick={() => setSlide(i => i + 1)}>
                Next frame
              </Button>
            )}
            {/* Locked steps are GATED, not shown disabled: the completing actions
                are replaced by the jump that actually helps. */}
            {locked && (
              <Button variant="soft" accent="amber" size="sm" iconRight={ArrowRight}
                onClick={() => goStep(Math.max(0, steps.findIndex(sx => !stepDone(sx, enrollment))))}>
                Go to my next open step
              </Button>
            )}
            {!locked && phase === 'content' && (slides.length === 0 || slide + 1 >= slides.length) && questions.length > 0 && (
              <Button variant="solid" accent={ENTITIES.quiz.hue} size="sm" icon={ListChecks} onClick={() => setPhase('check')}>
                Knowledge check ({questions.length})
              </Button>
            )}
            {!locked && phase === 'content' && (slides.length === 0 || slide + 1 >= slides.length) && questions.length === 0 && (
              <Button variant="solid" accent="emerald" size="sm" icon={Check} onClick={() => commit(null)}>
                Mark complete
              </Button>
            )}
            {!locked && phase === 'check' && !result && (
              <Button variant="solid" accent={ENTITIES.quiz.hue} size="sm" icon={Check}
                disabled={questions.some(q => !(answers[q.id] || []).length)} onClick={submit}>
                Submit answers
              </Button>
            )}
            {!locked && phase === 'check' && result && !result.passed && (
              <Button variant="solid" accent="amber" size="sm" icon={RotateCcw}
                onClick={() => { setAnswers({}); setResult(null); }}>
                Try again
              </Button>
            )}
            {!locked && phase === 'check' && result?.passed && (
              <Button variant="solid" accent="emerald" size="sm" icon={Check} onClick={() => commit(result.score)}>
                {stepIndex + 1 < steps.length ? 'Mark complete & continue' : 'Mark complete & finish'}
              </Button>
            )}
          </div>
        </>
      }
    >
      <div className="space-y-3">
        {locked && (
          <Banner accent="amber" icon={Lock} title="This step is locked">
            {locked} You can read ahead, but it cannot be marked complete out of order — use the jump in the footer.
          </Banner>
        )}

        {phase === 'content' && step.kind === 'lesson' && !atom && (
          <EmptyState icon={CircleAlert} title="This lesson points at an atom that no longer exists"
            hint={`The reference is ${step.lessonId}. Remove the lesson from the outline, or restore the atom in Knowledge.`} />
        )}

        {phase === 'content' && step.kind === 'lesson' && atom && (
          <>
            <Banner accent="blue" icon={Link2}>
              This lesson renders the knowledge atom <strong className={t.text}>{atom.id}</strong> directly.
              The learner and a customer reading the help centre see the same words.
            </Banner>
            {atom.format === 'guide'
              ? <StoryFrame atom={atom} slide={slide} onSlide={setSlide} playing={playing} onPlaying={setPlaying} />
              : <ArticleReader atom={atom} />}
          </>
        )}

        {phase === 'content' && step.kind === 'quiz' && (
          <div className="space-y-3">
            <Banner accent={ENTITIES.quiz.hue} icon={ListChecks} title={quiz?.title}>
              A module-level check written for this course — distinct from the checks the atoms carry.
              Pass mark {quiz?.passingScore ?? course.passingScore}%.
            </Banner>
            <Button variant="solid" accent={ENTITIES.quiz.hue} icon={Play} onClick={() => setPhase('check')}>
              Start the quiz ({questions.length} questions)
            </Button>
          </div>
        )}

        {phase === 'check' && (
          <KnowledgeCheck
            questions={questions}
            answers={answers}
            onAnswer={(qid, ids) => setAnswers(a2 => ({ ...a2, [qid]: ids }))}
            result={result}
            bar={quiz?.passingScore ?? course.passingScore}
          />
        )}
      </div>
    </Modal>
  );
}

function StoryFrame({ atom, slide, onSlide, playing, onPlaying }) {
  const { t, a } = useTheme();
  const slides = atom.slides || [];
  const s = slides[slide];
  const c = a(ENTITIES.lesson.hue);
  if (!s) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {slides.map((x, i) => (
          <button key={x.id} onClick={() => onSlide(i)} aria-label={`Frame ${i + 1}`}
            className={cx('flex-1 h-1 rounded-full overflow-hidden', t.bgSubtle)}>
            <span
              className={cx('block h-full rounded-full', c.solid,
                i === slide && playing && s.seconds ? 'rhq-story-fill' : '')}
              style={{
                width: i < slide ? '100%' : i === slide ? (playing && s.seconds ? undefined : '100%') : '0%',
                animationDuration: i === slide && playing && s.seconds ? `${s.seconds}s` : undefined,
              }}
            />
          </button>
        ))}
      </div>

      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className={cx('relative rounded-2xl overflow-hidden border aspect-[9/16] flex items-center justify-center',
          t.borderLight, t.bgSubtle)}>
          {s.type === 'image' && (
            <img src={s.url} alt={s.alt} className="w-full h-full object-cover" />
          )}
          {s.type === 'video' && (
            <div className={cx('flex flex-col items-center gap-2 p-4 text-center', t.textMuted)}>
              <Video size={ICON.empty} className="opacity-50" />
              <span className="text-xs">{s.alt}</span>
            </div>
          )}
          {s.type === 'text' && (
            <div className={cx('p-5 text-center', t.text)}>
              <ImageGlyph size={ICON.tile} className={cx('mx-auto mb-2 opacity-40', t.textMuted)} />
              <p className="text-sm font-medium">{s.heading}</p>
            </div>
          )}
          <span className={cx('absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium', c.soft, c.fgOnSoft)}>
            {slide + 1}/{slides.length}
          </span>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className={cx('text-base font-semibold flex-1 min-w-0', t.text)}>{s.heading}</h3>
            <IconButton icon={playing ? Pause : Play} label={playing ? 'Pause' : 'Auto-advance'} accent="blue"
              onClick={() => onPlaying(!playing)} />
          </div>
          <div className={cx('rhq-prose text-sm leading-relaxed', t.textSecondary)}
            dangerouslySetInnerHTML={{ __html: s.caption }} />
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="xs" icon={ArrowLeft} disabled={slide === 0} onClick={() => onSlide(slide - 1)}>
              Back
            </Button>
            <Button variant="soft" accent="blue" size="xs" iconRight={ArrowRight} disabled={slide + 1 >= slides.length}
              onClick={() => onSlide(slide + 1)}>
              Next frame
            </Button>
            <span className={cx('text-[11px]', t.textMuted)}>
              {s.seconds ? `${s.seconds}s auto-advance` : 'manual only'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleReader({ atom }) {
  const { t } = useTheme();
  return (
    <article className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Chip accent={ENTITIES.article.hue} icon={BookOpen}>Article</Chip>
        <Chip accent={AUDIENCE_HUE[atom.audience]}>{AUDIENCE_LABEL[atom.audience]}</Chip>
        <Chip accent="gray" icon={Clock}>{atom.minutes || 0} min</Chip>
        <ChipGroup accent="gray" max={3} items={atom.tags || []} />
      </div>
      {atom.objective && (
        <Banner accent="emerald" icon={Target} title="What you will be able to do">
          {atom.objective}
        </Banner>
      )}
      <div className={cx('rhq-prose text-sm leading-relaxed max-w-2xl', t.textSecondary)}
        dangerouslySetInnerHTML={{ __html: atom.body || '' }} />
    </article>
  );
}

function KnowledgeCheck({ questions, answers, onAnswer, result, bar }) {
  const { t, a } = useTheme();
  const amber = a(ENTITIES.quiz.hue);

  if (!questions.length) {
    return <EmptyState icon={ListChecks} title="No check on this step" hint="Mark it complete and carry on." />;
  }

  return (
    <div className="space-y-3">
      {result && (
        <Banner accent={result.passed ? 'emerald' : 'red'} icon={result.passed ? CircleCheck : CircleAlert}
          title={result.passed ? `Passed — ${result.score}%` : `Not yet — ${result.score}%`}>
          {result.correct} of {result.total} correct. Pass mark is {bar}%.
          {!result.passed && ' Read the explanations, then try again — attempts are not capped.'}
        </Banner>
      )}

      {questions.map((q, qi) => {
        const picked = answers[q.id] || [];
        return (
          <Card key={q.id} className={cx(DENSITY.cardPad, 'space-y-2')}>
            <div className="flex items-start gap-2">
              <span className={cx('w-5 h-5 rounded-lg flex items-center justify-center text-[11px] font-semibold flex-shrink-0',
                amber.softStrong, amber.fg)}>{qi + 1}</span>
              <p className={cx('text-sm font-medium flex-1', t.text)}>{q.prompt}</p>
              <Chip accent="gray">{q.type === 'multi' ? 'select all' : q.type === 'boolean' ? 'true / false' : 'one answer'}</Chip>
            </div>
            <div className="space-y-1.5 pl-7">
              {(q.options || []).map(o => {
                const chosen = picked.includes(o.id);
                const reveal = !!result;
                const good = reveal && o.correct;
                const bad = reveal && chosen && !o.correct;
                const tone = good ? a('emerald') : bad ? a('red') : a('blue');
                return (
                  <button
                    key={o.id}
                    disabled={!!result}
                    onClick={() => {
                      if (q.type === 'multi') {
                        onAnswer(q.id, chosen ? picked.filter(x => x !== o.id) : [...picked, o.id]);
                      } else {
                        onAnswer(q.id, [o.id]);
                      }
                    }}
                    className={cx('w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors',
                      good || bad ? cx(tone.soft, tone.borderStrong)
                        : chosen ? cx(tone.soft, tone.borderStrong)
                          : cx(t.bgCard, t.borderLight, t.bgHover))}
                  >
                    <span className={cx('w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0',
                      chosen || good ? cx(tone.solid, 'border-transparent') : t.borderLight)}>
                      {(chosen || good) && <Check size={10} className="text-white" />}
                    </span>
                    <span className={cx('flex-1', t.text)}>{o.label}</span>
                    {good && <Chip accent="emerald">correct</Chip>}
                    {bad && <Chip accent="red">not this one</Chip>}
                  </button>
                );
              })}
            </div>
            {result && q.explanation && (
              <p className={cx('text-xs pl-7 italic', t.textSecondary)}>{q.explanation}</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
