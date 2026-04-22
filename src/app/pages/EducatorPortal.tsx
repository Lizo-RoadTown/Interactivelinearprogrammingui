/**
 * EducatorPortal — the UI for the team-project problem bank.
 *
 * Three sections, one per beginner's Python function:
 *   • BEGINNER A — list / filter the bank (backend/educator/listing.py)
 *   • BEGINNER B — validate a problem     (backend/educator/validation.py)
 *   • BEGINNER C — export to Markdown     (backend/educator/export.py)
 *
 * Each section calls the matching /api/educator/* endpoint. When a
 * beginner's function is still a stub (NotImplementedError), the
 * backend returns implemented: false and the section shows a
 * "⚠ Stub — waiting for Beginner X" badge. That way the UI stays
 * fully usable while the team is still working, and the live demo
 * can literally watch each section go green as each person finishes.
 *
 * Layout is deliberately demo-friendly: each beginner owns a distinct
 * card they can point at during the presentation. Inputs on the left,
 * output on the right, status badge in the header.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { ArrowLeft, CheckCircle2, AlertTriangle, Search, ShieldCheck, FileText, Sparkles } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const API_BASE = _env.VITE_API_URL ? `${_env.VITE_API_URL}/api`
               : _env.DEV            ? 'http://localhost:8000/api'
                                     : '/api';

// ── Types matching backend/models.py ─────────────────────────────────────────

interface BankProblem {
  id: string;
  title: string;
  category?: string;
  difficulty?: string;
  scenario?: string;
  numVars?: number;
  objectiveType?: string;
  variables?: (string | { name?: string; description?: string })[];
  objectiveCoefficients?: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constraints?: any[];
}

interface ListResp { problems: BankProblem[]; implemented: boolean }
interface ValidateResp { errors: string[]; implemented: boolean }
interface ExportResp { markdown: string; implemented: boolean }

// ── Main page ────────────────────────────────────────────────────────────────

export default function EducatorPortal() {
  const [allProblems, setAllProblems] = useState<BankProblem[]>([]);
  const [allStatus, setAllStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Track implementation status across the three sections so the header
  // banner can show an aggregate "X / 3 functions implemented".
  const [implA, setImplA] = useState<boolean | null>(null);
  const [implB, setImplB] = useState<boolean | null>(null);
  const [implC, setImplC] = useState<boolean | null>(null);

  // Seed the unfiltered problem list once — used by section C's dropdown
  // AND used as a fallback so section A has data even before it's called.
  useEffect(() => {
    fetch(`${API_BASE}/educator/problems`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then(data => {
        setAllProblems(data.problems ?? []);
        setAllStatus('ok');
      })
      .catch(err => {
        setAllStatus('error');
        setErrMsg(`Backend unreachable at ${API_BASE}. Make sure the FastAPI server is running (uvicorn main:app --reload --port 8000).`);
        console.error(err);
      });
  }, []);

  const implementedCount = [implA, implB, implC].filter(x => x === true).length;
  const knownStatus = [implA, implB, implC].filter(x => x !== null).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card/60 backdrop-blur border-b border-border px-4 py-2.5 flex items-center gap-3 sticky top-0 z-10">
        <Link to="/">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Home
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Problem Bank — Educator Portal</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Team demo: three Python functions, one UI
            </p>
          </div>
        </div>
        <div className="ml-auto text-[11px] tabular-nums">
          {knownStatus === 0
            ? <span className="text-muted-foreground">Loading status…</span>
            : <span className={implementedCount === 3 ? 'text-emerald-300 font-semibold' : 'text-amber-300'}>
                {implementedCount} / 3 functions implemented
              </span>}
        </div>
      </header>

      {allStatus === 'error' && (
        <div className="px-6 pt-4">
          <div className="bg-rose-500/10 border border-rose-500/40 rounded-lg px-4 py-3 text-sm text-rose-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Backend unreachable</p>
              <p className="text-[11px] text-rose-200/80 mt-1">{errMsg}</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <IntroCard />
        <BeginnerASection
          allProblems={allProblems}
          onStatus={setImplA}
        />
        <BeginnerBSection
          onStatus={setImplB}
        />
        <BeginnerCSection
          allProblems={allProblems}
          onStatus={setImplC}
        />
      </div>
    </div>
  );
}

// ── Intro card ───────────────────────────────────────────────────────────────

function IntroCard() {
  return (
    <div className="bg-card/60 border border-border rounded-xl p-4 space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-primary font-bold">About this portal</p>
      <p className="text-sm text-foreground/90 leading-relaxed">
        This page is a live front-end for three Python functions a three-person team
        wrote. Each function works on a shared bank of LP word problems. Pointing this
        UI at the FastAPI backend lets us demo every function end-to-end without
        touching a terminal. Each card below is owned by one team member.
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Source files: <code className="font-mono">backend/educator/listing.py</code>,{' '}
        <code className="font-mono">backend/educator/validation.py</code>,{' '}
        <code className="font-mono">backend/educator/export.py</code>. Each file is
        self-contained and ~20–40 lines of code.
      </p>
    </div>
  );
}

// ── BEGINNER A — filter/search ───────────────────────────────────────────────

function BeginnerASection({
  allProblems, onStatus,
}: {
  allProblems: BankProblem[];
  onStatus: (v: boolean) => void;
}) {
  const [difficulty, setDifficulty] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [results, setResults] = useState<BankProblem[]>([]);
  const [implemented, setImplemented] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Populate dropdowns from what's actually in the bank — no hard-coded lists.
  const difficulties = Array.from(new Set(allProblems.map(p => p.difficulty).filter(Boolean))) as string[];
  const categories = Array.from(new Set(allProblems.map(p => p.category).filter(Boolean))) as string[];

  const runFilter = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/educator/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty: difficulty || null,
          category: category || null,
          search: search || null,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: ListResp = await res.json();
      setResults(data.problems);
      setImplemented(data.implemented);
      onStatus(data.implemented);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Auto-run on mount with no filters so the section isn't empty on page load.
  useEffect(() => { if (allProblems.length > 0) runFilter(); }, [allProblems.length]); // eslint-disable-line

  return (
    <SectionCard
      owner="Beginner A"
      title="Filter & search the bank"
      icon={<Search className="w-4 h-4" />}
      implemented={implemented}
      sourceFile="backend/educator/listing.py"
      summary="Takes the full bank + optional difficulty / category / search filters, returns a filtered list."
    >
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <div className="space-y-3">
          <FormField label="Search text">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="e.g. protein, bakery, assembly"
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:border-primary"
            />
          </FormField>
          <FormField label="Difficulty">
            <select
              aria-label="Difficulty filter"
              title="Difficulty filter"
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:border-primary"
            >
              <option value="">(any)</option>
              {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </FormField>
          <FormField label="Category">
            <select
              aria-label="Category filter"
              title="Category filter"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:border-primary"
            >
              <option value="">(any)</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <Button
            onClick={runFilter}
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white"
          >
            {loading ? 'Filtering…' : 'Apply filters'}
          </Button>
          {err && <p className="text-[11px] text-rose-300">{err}</p>}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Results ({results.length})
          </p>
          <div className="bg-muted/20 border border-border rounded-lg divide-y divide-border max-h-80 overflow-y-auto">
            {results.length === 0 && (
              <p className="text-[11px] text-muted-foreground/70 italic px-3 py-4">
                No problems match those filters.
              </p>
            )}
            {results.map(p => (
              <div key={p.id} className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{p.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                      {p.scenario?.slice(0, 140)}{p.scenario && p.scenario.length > 140 ? '…' : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    {p.difficulty && <Pill tone="primary">{p.difficulty}</Pill>}
                    {p.category && <Pill tone="muted">{p.category}</Pill>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ── BEGINNER B — validate a problem ──────────────────────────────────────────

const SAMPLE_VALID_PROBLEM = {
  id: 'demo-bakery',
  title: 'Bakery Production Mix',
  category: 'production',
  difficulty: 'beginner',
  scenario: 'A small bakery makes muffins and cookies...',
  numVars: 2,
  objectiveType: 'max',
  objectiveCoefficients: [3, 2],
  variables: ['muffins', 'cookies'],
  constraints: [
    { coefficients: [2, 1], operator: '<=', rhs: 100 },
    { coefficients: [1, 2], operator: '<=', rhs: 80 },
  ],
};

const SAMPLE_BROKEN_PROBLEM = {
  id: '',
  title: 'Broken Demo',
  category: 'production',
  difficulty: 'expert',  // invalid
  scenario: 'A problem with multiple issues for Beginner B to catch.',
  numVars: 2,
  objectiveType: 'maximize', // invalid (should be 'max')
  objectiveCoefficients: [3],  // wrong length
  variables: ['a', 'b'],
  constraints: [
    { coefficients: [2, 1], operator: '<<', rhs: 100 }, // invalid operator
  ],
};

function BeginnerBSection({ onStatus }: { onStatus: (v: boolean) => void }) {
  const [text, setText] = useState<string>(JSON.stringify(SAMPLE_VALID_PROBLEM, null, 2));
  const [errors, setErrors] = useState<string[] | null>(null);
  const [implemented, setImplemented] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [netErr, setNetErr] = useState<string | null>(null);

  const runValidate = async () => {
    setParseErr(null);
    setNetErr(null);
    let problem: unknown;
    try {
      problem = JSON.parse(text);
    } catch {
      setParseErr('JSON is not valid — fix the syntax before validating.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/educator/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: ValidateResp = await res.json();
      setErrors(data.errors);
      setImplemented(data.implemented);
      onStatus(data.implemented);
    } catch (e) {
      setNetErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard
      owner="Beginner B"
      title="Validate a proposed problem"
      icon={<ShieldCheck className="w-4 h-4" />}
      implemented={implemented}
      sourceFile="backend/educator/validation.py"
      summary="Takes a problem dict, returns a list of human-readable error messages (empty list = valid)."
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Problem JSON
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setText(JSON.stringify(SAMPLE_VALID_PROBLEM, null, 2))}
                className="text-[10px] text-primary hover:text-primary/80 underline decoration-dotted"
              >
                load valid example
              </button>
              <span className="text-muted-foreground/50">·</span>
              <button
                type="button"
                onClick={() => setText(JSON.stringify(SAMPLE_BROKEN_PROBLEM, null, 2))}
                className="text-[10px] text-amber-300 hover:text-amber-200 underline decoration-dotted"
              >
                break it on purpose
              </button>
            </div>
          </div>
          <textarea
            aria-label="Problem JSON to validate"
            title="Problem JSON to validate"
            placeholder="Paste a problem dict as JSON here"
            value={text}
            onChange={e => setText(e.target.value)}
            spellCheck={false}
            className="w-full h-80 font-mono text-xs bg-muted/40 border border-border rounded-md p-3 focus:outline-none focus:border-primary"
          />
          <Button
            onClick={runValidate}
            disabled={loading}
            className="mt-3 bg-primary hover:bg-primary/90 text-white"
          >
            {loading ? 'Validating…' : 'Validate'}
          </Button>
          {parseErr && <p className="text-[11px] text-rose-300 mt-2">{parseErr}</p>}
          {netErr && <p className="text-[11px] text-rose-300 mt-2">Network error: {netErr}</p>}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            {errors === null ? 'Waiting to validate' : errors.length === 0 ? 'Result' : `${errors.length} error${errors.length === 1 ? '' : 's'} found`}
          </p>
          <div className="bg-muted/20 border border-border rounded-lg p-3 min-h-[12rem]">
            {errors === null && (
              <p className="text-[11px] text-muted-foreground/70 italic">
                Click Validate to run Beginner B&apos;s function on the JSON on the left.
              </p>
            )}
            {errors && errors.length === 0 && (
              <div className="flex items-start gap-2 text-emerald-200">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">No errors — the problem is valid.</p>
              </div>
            )}
            {errors && errors.length > 0 && (
              <ul className="space-y-1.5">
                {errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-rose-100">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-300" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ── BEGINNER C — export to Markdown ──────────────────────────────────────────

function BeginnerCSection({
  allProblems, onStatus,
}: {
  allProblems: BankProblem[];
  onStatus: (v: boolean) => void;
}) {
  const [pickedId, setPickedId] = useState<string>('');
  const [markdown, setMarkdown] = useState<string>('');
  const [implemented, setImplemented] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!pickedId && allProblems.length > 0) setPickedId(allProblems[0].id);
  }, [allProblems, pickedId]);

  const runExport = async () => {
    if (!pickedId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_BASE}/educator/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: pickedId }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data: ExportResp = await res.json();
      setMarkdown(data.markdown);
      setImplemented(data.implemented);
      onStatus(data.implemented);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard
      owner="Beginner C"
      title="Export a problem as a Markdown worksheet"
      icon={<FileText className="w-4 h-4" />}
      implemented={implemented}
      sourceFile="backend/educator/export.py"
      summary="Takes a problem dict, returns printable Markdown for a student worksheet."
    >
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <div className="space-y-3">
          <FormField label="Pick a problem">
            <select
              aria-label="Problem to export"
              title="Problem to export"
              value={pickedId}
              onChange={e => setPickedId(e.target.value)}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:border-primary"
            >
              {allProblems.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </FormField>
          <Button
            onClick={runExport}
            disabled={loading || !pickedId}
            className="w-full bg-primary hover:bg-primary/90 text-white"
          >
            {loading ? 'Exporting…' : 'Export to Markdown'}
          </Button>
          {err && <p className="text-[11px] text-rose-300">{err}</p>}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Markdown output
          </p>
          <pre className="bg-muted/20 border border-border rounded-lg p-3 text-[11px] font-mono whitespace-pre-wrap min-h-[16rem] max-h-96 overflow-y-auto">
            {markdown || <span className="text-muted-foreground/70 italic">Click Export to generate.</span>}
          </pre>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Shared primitives ────────────────────────────────────────────────────────

function SectionCard({
  owner, title, icon, implemented, sourceFile, summary, children,
}: {
  owner: string;
  title: string;
  icon: React.ReactNode;
  implemented: boolean | null;
  sourceFile: string;
  summary: string;
  children: React.ReactNode;
}) {
  const badge =
    implemented === null
      ? <span className="text-[10px] px-2 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground">Not yet called</span>
      : implemented
        ? <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/50 text-emerald-200 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Implemented
          </span>
        : <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/50 text-amber-200 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Stub — waiting for {owner}
          </span>;

  return (
    <section className="bg-card/40 border-2 border-border rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-primary/15 via-card/40 to-card/40 border-b border-border px-4 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[10px] uppercase tracking-wider text-primary font-bold">{owner}</p>
            {badge}
          </div>
          <p className="text-sm font-semibold text-foreground mt-0.5">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{summary}</p>
          <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">{sourceFile}</p>
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: 'primary' | 'muted' }) {
  const cls = tone === 'primary'
    ? 'bg-primary/15 border border-primary/40 text-primary'
    : 'bg-muted/40 border border-border text-muted-foreground';
  return (
    <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      {children}
    </span>
  );
}
