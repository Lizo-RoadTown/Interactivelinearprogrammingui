/**
 * AdminPortal — the professor-facing UI for managing a problem bank.
 *
 * This is the actual product surface for the OR professor who's going
 * to use this tool in their classroom. They open /admin, pick a bank
 * id (which is just a remembered partition key, not a credential), see
 * the problems already in it, add new ones, edit them, delete them.
 *
 * The /educator page is a different beast — it's the team-project
 * demo where three Python functions are shown live. /admin is the
 * tool a professor actually uses.
 *
 * Storage is per-bank in SQLite on the backend. Each professor picks
 * a bank_id (e.g. "prof-jenkins-orie310") and that's their personal
 * bank. The bank_id is remembered in localStorage so they don't
 * re-enter it every visit.
 *
 * Future slices (per ROADMAP):
 *   * Bring-your-own-agent button to draft problems with Claude/GPT.
 *   * Curriculum profiles (paste a syllabus, agent uses it for context).
 *   * Multi-turn conversation to refine drafts before saving.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Plus, Pencil, Trash2,
  Sparkles, FolderTree, Save, X,
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const API_BASE = _env.VITE_API_URL ? `${_env.VITE_API_URL}/api`
               : _env.DEV            ? 'http://localhost:8000/api'
                                     : '/api';

const BANK_ID_KEY = 'lp-admin.bankId';

// ── Types matching the bank schema ──────────────────────────────────────────

interface Constraint {
  coefficients: number[];
  operator: '<=' | '>=' | '=';
  rhs: number;
  label?: string;
}

interface Problem {
  id: string;
  title: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  scenario: string;
  numVars: number;
  objectiveType: 'max' | 'min';
  variables: string[];
  objectiveCoefficients: number[];
  constraints: Constraint[];
}

const EMPTY_PROBLEM: Problem = {
  id: '',
  title: '',
  category: 'production',
  difficulty: 'beginner',
  scenario: '',
  numVars: 2,
  objectiveType: 'max',
  variables: ['x1', 'x2'],
  objectiveCoefficients: [0, 0],
  constraints: [
    { coefficients: [0, 0], operator: '<=', rhs: 0, label: '' },
  ],
};

// ── Page component ──────────────────────────────────────────────────────────

export default function AdminPortal() {
  // Bank identity. If nothing is in localStorage, prompt for one.
  const [bankId, setBankId] = useState<string>(() => {
    return typeof window !== 'undefined'
      ? (localStorage.getItem(BANK_ID_KEY) ?? '')
      : '';
  });
  const [showBankPrompt, setShowBankPrompt] = useState<boolean>(!bankId);

  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Editing state. null = no editor open. {} fields = editing a problem.
  const [editing, setEditing] = useState<Problem | null>(null);
  const [editingIsNew, setEditingIsNew] = useState<boolean>(false);

  const persistBankId = (id: string) => {
    setBankId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(BANK_ID_KEY, id);
    }
    setShowBankPrompt(false);
  };

  const loadProblems = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await fetch(`${API_BASE}/admin/banks/${encodeURIComponent(id)}/problems`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setProblems(data.problems ?? []);
    } catch (e) {
      setLoadErr(`Could not reach the backend at ${API_BASE}. Make sure uvicorn is running on port 8000.`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (bankId) void loadProblems(bankId); }, [bankId]);

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
            <FolderTree className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Bank Admin — Professor's Workspace</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Manage your personal problem bank
            </p>
          </div>
        </div>
        {bankId && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Bank</span>
            <code className="text-[11px] bg-muted/40 border border-border rounded px-2 py-1 font-mono">{bankId}</code>
            <button
              type="button"
              onClick={() => setShowBankPrompt(true)}
              className="text-[10px] text-primary hover:text-primary/80 underline decoration-dotted"
            >
              switch
            </button>
          </div>
        )}
      </header>

      {showBankPrompt && (
        <BankPickerOverlay
          currentId={bankId}
          onPick={persistBankId}
          onCancel={bankId ? () => setShowBankPrompt(false) : undefined}
        />
      )}

      {!bankId ? null : (
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          {loadErr && (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-lg px-4 py-3 text-sm text-rose-100 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{loadErr}</p>
            </div>
          )}

          <IntroCard problemCount={problems.length} />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading…' : `${problems.length} problem${problems.length === 1 ? '' : 's'} in this bank`}
            </p>
            <Button
              onClick={() => { setEditing({ ...EMPTY_PROBLEM }); setEditingIsNew(true); }}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Plus className="w-4 h-4 mr-1" /> New problem
            </Button>
          </div>

          <div className="bg-card/40 border border-border rounded-xl divide-y divide-border overflow-hidden">
            {problems.length === 0 && !loading && (
              <div className="p-6 text-center text-sm text-muted-foreground italic">
                This bank is empty. Click <strong>New problem</strong> to add the first one,
                or use the <em>switch</em> link in the header to fork the demo bank as a starting point.
              </div>
            )}
            {problems.map(p => (
              <ProblemRow
                key={p.id}
                problem={p}
                onEdit={() => { setEditing({ ...p }); setEditingIsNew(false); }}
                onDelete={async () => {
                  if (!confirm(`Delete ${p.id}?`)) return;
                  await fetch(
                    `${API_BASE}/admin/banks/${encodeURIComponent(bankId)}/problems/${encodeURIComponent(p.id)}`,
                    { method: 'DELETE' },
                  );
                  void loadProblems(bankId);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {editing && (
        <ProblemEditor
          problem={editing}
          isNew={editingIsNew}
          bankId={bankId}
          existingIds={problems.map(p => p.id)}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void loadProblems(bankId);
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function IntroCard({ problemCount }: { problemCount: number }) {
  return (
    <div className="bg-card/60 border border-border rounded-xl p-4 space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Your problem bank</p>
      <p className="text-sm text-foreground/90 leading-relaxed">
        This is your personal bank — the LP word problems your students will work on. {problemCount > 0
          ? `You have ${problemCount} problem${problemCount === 1 ? '' : 's'} so far.`
          : 'It\'s currently empty.'} Add new problems with the button on the right; edit or delete by hovering a row. Validation runs on save.
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Coming next: connect your own Claude or ChatGPT API key, paste in your syllabus, and have the
        agent draft problems aligned to what you're teaching. See the roadmap.
      </p>
    </div>
  );
}

function BankPickerOverlay({
  currentId, onPick, onCancel,
}: {
  currentId: string;
  onPick: (id: string) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(currentId);
  const [forkFromDemo, setForkFromDemo] = useState(false);

  const submit = async () => {
    const trimmed = text.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (!trimmed) return;
    if (forkFromDemo && trimmed !== 'demo') {
      // Tell the backend to copy the demo bank into the new bank id.
      try {
        await fetch(`${API_BASE}/admin/banks/fork`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_bank: 'demo', target_bank: trimmed }),
        });
      } catch (e) {
        console.error('fork failed', e);
      }
    }
    onPick(trimmed);
  };

  return (
    <div className="fixed inset-0 z-30 bg-background/80 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-card border-2 border-primary/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Pick a bank id</p>
            <p className="text-sm font-semibold">Your bank is your workspace</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Type a short id you'll remember — it's how this tool tells your problems apart from
          another professor's. <strong>Lowercase letters, numbers, and dashes only.</strong> Saved
          in your browser; you don't enter it again unless you switch.
        </p>
        <input
          autoFocus
          aria-label="Bank id"
          placeholder="e.g. prof-jenkins-orie310"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
          className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 font-mono focus:outline-none focus:border-primary"
        />
        <label className="flex items-start gap-2 text-[11px] text-foreground/90 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={forkFromDemo}
            onChange={e => setForkFromDemo(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Start from the <strong>demo</strong> bank as a copy. Useful if you want the existing
            problems as a starting point and plan to customize them. Leave unchecked to start empty.
          </span>
        </label>
        <div className="flex gap-2 justify-end">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
              Cancel
            </Button>
          )}
          <Button
            onClick={() => void submit()}
            disabled={!text.trim()}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            Use this bank
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProblemRow({
  problem, onEdit, onDelete,
}: {
  problem: Problem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{problem.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
          {problem.scenario}
        </p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Pill tone="primary">{problem.difficulty}</Pill>
          <Pill tone="muted">{problem.category}</Pill>
          <Pill tone="muted">{problem.numVars} var{problem.numVars === 1 ? '' : 's'}</Pill>
          <Pill tone="muted">{problem.constraints.length} constraint{problem.constraints.length === 1 ? '' : 's'}</Pill>
          <Pill tone="muted">{problem.objectiveType}</Pill>
        </div>
        <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">id: {problem.id}</p>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <Button size="sm" variant="ghost" onClick={onEdit} className="text-muted-foreground hover:text-foreground">
          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/10">
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
        </Button>
      </div>
    </div>
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

// ── Editor ───────────────────────────────────────────────────────────────────

function ProblemEditor({
  problem, isNew, bankId, existingIds, onCancel, onSaved,
}: {
  problem: Problem;
  isNew: boolean;
  bankId: string;
  existingIds: string[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Problem>(problem);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Live validation: every time the draft changes, ask the backend.
  // Debounced lightly so we don't spam.
  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/educator/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ problem: draft }),
        });
        if (!res.ok) return;
        const data = await res.json();
        // Add a duplicate-id check on the client (only useful for "new")
        const idClash = isNew && draft.id && existingIds.includes(draft.id);
        const all: string[] = [...(data.errors ?? [])];
        if (idClash) all.push(`A problem with id "${draft.id}" already exists in this bank — pick a different id`);
        setErrors(all);
      } catch (e) {
        console.error(e);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [draft, isNew, existingIds]);

  const save = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch(`${API_BASE}/admin/banks/${encodeURIComponent(bankId)}/problems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!data.saved) {
        setErrors(data.errors ?? ['Save failed']);
        return;
      }
      onSaved();
    } catch (e) {
      setSaveErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  const updateNumVars = (n: number) => {
    if (n < 1 || n > 10) return;
    const arr = (xs: number[], len: number, fill: number) =>
      Array.from({ length: len }, (_, i) => xs[i] ?? fill);
    setDraft(d => ({
      ...d,
      numVars: n,
      variables: arr(d.variables.map(v => v) as unknown as number[], n, '' as unknown as number) as unknown as string[],
      objectiveCoefficients: arr(d.objectiveCoefficients, n, 0),
      constraints: d.constraints.map(c => ({
        ...c,
        coefficients: arr(c.coefficients, n, 0),
      })),
    }));
  };

  const updateConstraint = (idx: number, patch: Partial<Constraint>) => {
    setDraft(d => ({
      ...d,
      constraints: d.constraints.map((c, i) => i === idx ? { ...c, ...patch } : c),
    }));
  };

  const addConstraint = () => {
    setDraft(d => ({
      ...d,
      constraints: [...d.constraints, {
        coefficients: Array(d.numVars).fill(0),
        operator: '<=',
        rhs: 0,
        label: '',
      }],
    }));
  };

  const removeConstraint = (idx: number) => {
    setDraft(d => ({
      ...d,
      constraints: d.constraints.filter((_, i) => i !== idx),
    }));
  };

  const valid = errors.length === 0;

  return (
    <div className="fixed inset-0 z-20 bg-background/90 backdrop-blur overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="bg-card border-2 border-primary/40 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-primary font-bold">
                {isNew ? 'New problem' : 'Editing'}
              </p>
              <p className="text-sm font-semibold">{draft.title || '(untitled)'}</p>
            </div>
            <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" /> Close without saving
            </Button>
          </div>

          {/* ── Top-level fields ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Problem id (no spaces, lowercase, dash-separated)">
              <input
                aria-label="Problem id"
                value={draft.id}
                onChange={e => setDraft({ ...draft, id: e.target.value })}
                className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 font-mono focus:outline-none focus:border-primary"
                placeholder="e.g. wp-bakery-mix"
              />
            </Field>
            <Field label="Title (human-readable)">
              <input
                aria-label="Title"
                value={draft.title}
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:border-primary"
                placeholder="e.g. Bakery Production Mix"
              />
            </Field>
            <Field label="Category">
              <input
                aria-label="Category"
                value={draft.category}
                onChange={e => setDraft({ ...draft, category: e.target.value })}
                className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:border-primary"
                placeholder="production, diet, transportation, …"
              />
            </Field>
            <Field label="Difficulty">
              <select
                aria-label="Difficulty"
                value={draft.difficulty}
                onChange={e => setDraft({ ...draft, difficulty: e.target.value as Problem['difficulty'] })}
                className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="beginner">beginner</option>
                <option value="intermediate">intermediate</option>
                <option value="advanced">advanced</option>
              </select>
            </Field>
          </div>

          <Field label="Scenario (the word problem the student reads)">
            <textarea
              aria-label="Scenario"
              value={draft.scenario}
              onChange={e => setDraft({ ...draft, scenario: e.target.value })}
              rows={4}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary"
              placeholder="A small bakery makes muffins and cookies. Each muffin uses 2 cups of flour..."
            />
          </Field>

          {/* ── Variables / Objective ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Number of variables">
              <input
                aria-label="numVars"
                type="number"
                min={1}
                max={10}
                value={draft.numVars}
                onChange={e => updateNumVars(parseInt(e.target.value, 10) || 0)}
                className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 font-mono focus:outline-none focus:border-primary"
              />
            </Field>
            <Field label="Objective">
              <select
                aria-label="Objective type"
                value={draft.objectiveType}
                onChange={e => setDraft({ ...draft, objectiveType: e.target.value as 'max' | 'min' })}
                className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="max">Max</option>
                <option value="min">Min</option>
              </select>
            </Field>
          </div>

          <Field label="Variable names + objective coefficients">
            <div className="space-y-1.5">
              {Array.from({ length: draft.numVars }, (_, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground font-mono">x{i + 1} =</span>
                  <input
                    aria-label={`Variable ${i + 1} name`}
                    placeholder="(name, e.g. muffins)"
                    value={draft.variables[i] ?? ''}
                    onChange={e => {
                      const arr = [...draft.variables];
                      arr[i] = e.target.value;
                      setDraft({ ...draft, variables: arr });
                    }}
                    className="flex-1 text-sm bg-muted/40 border border-border rounded-md px-2 py-1 focus:outline-none focus:border-primary"
                  />
                  <span className="text-muted-foreground font-mono">coef</span>
                  <input
                    aria-label={`Objective coefficient for variable ${i + 1}`}
                    type="number"
                    step="any"
                    value={draft.objectiveCoefficients[i] ?? 0}
                    onChange={e => {
                      const arr = [...draft.objectiveCoefficients];
                      arr[i] = parseFloat(e.target.value) || 0;
                      setDraft({ ...draft, objectiveCoefficients: arr });
                    }}
                    className="w-24 text-sm bg-muted/40 border border-border rounded-md px-2 py-1 font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </Field>

          {/* ── Constraints ───────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Constraints
              </p>
              <Button size="sm" variant="ghost" onClick={addConstraint} className="text-primary hover:text-primary/80">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add constraint
              </Button>
            </div>
            <div className="space-y-2">
              {draft.constraints.map((c, idx) => (
                <div key={idx} className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`Constraint ${idx + 1} label`}
                      placeholder="(label, e.g. flour)"
                      value={c.label ?? ''}
                      onChange={e => updateConstraint(idx, { label: e.target.value })}
                      className="flex-1 text-xs bg-muted/40 border border-border rounded-md px-2 py-1 focus:outline-none focus:border-primary"
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeConstraint(idx)} className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/10">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap font-mono text-sm">
                    {Array.from({ length: draft.numVars }, (_, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && '+'}
                        <input
                          aria-label={`Constraint ${idx + 1} coefficient ${i + 1}`}
                          type="number"
                          step="any"
                          value={c.coefficients[i] ?? 0}
                          onChange={e => {
                            const arr = [...c.coefficients];
                            arr[i] = parseFloat(e.target.value) || 0;
                            updateConstraint(idx, { coefficients: arr });
                          }}
                          className="w-16 text-xs bg-muted/40 border border-border rounded-md px-1.5 py-1 text-center focus:outline-none focus:border-primary"
                        />
                        <span className="text-muted-foreground">x{i + 1}</span>
                      </span>
                    ))}
                    <select
                      aria-label={`Constraint ${idx + 1} operator`}
                      value={c.operator}
                      onChange={e => updateConstraint(idx, { operator: e.target.value as Constraint['operator'] })}
                      className="text-sm bg-muted/40 border border-border rounded-md px-2 py-1 focus:outline-none focus:border-primary"
                    >
                      <option value="<=">≤</option>
                      <option value=">=">≥</option>
                      <option value="=">=</option>
                    </select>
                    <input
                      aria-label={`Constraint ${idx + 1} RHS`}
                      type="number"
                      step="any"
                      value={c.rhs}
                      onChange={e => updateConstraint(idx, { rhs: parseFloat(e.target.value) || 0 })}
                      className="w-20 text-xs bg-muted/40 border border-border rounded-md px-1.5 py-1 text-center focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Validation feedback ───────────────────────────────────────── */}
          <div className={`rounded-lg p-3 border ${
            valid ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-amber-500/10 border-amber-500/40'
          }`}>
            <div className="flex items-start gap-2 text-sm">
              {valid ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-300" />
                  <span className="text-emerald-100">No validation errors. Ready to save.</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" />
                  <div className="text-amber-100">
                    <p className="font-semibold mb-1">{errors.length} issue{errors.length === 1 ? '' : 's'} to fix:</p>
                    <ul className="text-[12px] space-y-0.5">
                      {errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>

          {saveErr && (
            <p className="text-[12px] text-rose-300">Save error: {saveErr}</p>
          )}

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button
              onClick={() => void save()}
              disabled={!valid || saving}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'Saving…' : isNew ? 'Save new problem' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
