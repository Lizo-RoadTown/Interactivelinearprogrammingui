/**
 * AdminPortal — the professor-facing UI for managing a problem bank.
 *
 * Authenticated professors only (gated by RequireAuth). Each professor
 * owns one or more banks scoped to their Supabase user_id. A bank is
 * identified by a globally unique slug (e.g. "jenkins-orie310-fall26")
 * that students type to find it.
 *
 * Data layer: writes/reads talk to Supabase directly. Row-Level Security
 * policies (see migrations/001_supabase_auth_schema.sql) enforce that
 * professors can only mutate their own banks.
 *
 * The agent-draft endpoint stays on FastAPI — that one proxies the
 * professor's BYO API key to Anthropic/OpenAI without persisting it,
 * which can't move to the browser without leaking the key path.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Plus, Pencil, Trash2,
  Sparkles, FolderTree, Save, X, Bot, Settings, Loader2, LogOut,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const API_BASE = _env.VITE_API_URL ? `${_env.VITE_API_URL}/api`
               : _env.DEV            ? 'http://localhost:8000/api'
                                     : '/api';

// Active-bank pick is per-account, so localStorage scoping uses user.id.
const ACTIVE_BANK_KEY = (userId: string) => `lp-admin.activeBank.${userId}`;
const AGENT_PROVIDER_KEY = 'lp-admin.agent.provider';
const AGENT_KEY_KEY = 'lp-admin.agent.apiKey';
const AGENT_MODEL_KEY = 'lp-admin.agent.model';
const AGENT_CURRICULUM_KEY = 'lp-admin.agent.curriculum';

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

interface BankRow {
  bank_name: string;
  display_label: string | null;
}

export default function AdminPortal() {
  const { user, signOut } = useAuth();
  const userId = user?.id ?? '';

  const [myBanks, setMyBanks] = useState<BankRow[]>([]);
  const [activeBank, setActiveBank] = useState<string>('');
  const [showBankPicker, setShowBankPicker] = useState<boolean>(false);

  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Editing state. null = no editor open.
  const [editing, setEditing] = useState<Problem | null>(null);
  const [editingIsNew, setEditingIsNew] = useState<boolean>(false);

  // Agent settings — bring-your-own-key, stored in localStorage.
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(() => readAgentSettings());

  // Load this professor's banks. If they signed up with a pending bank
  // claim (email-confirmation flow), claim it now.
  const loadMyBanks = async (): Promise<BankRow[]> => {
    if (!supabase || !userId) return [];

    // First-sign-in claim of a slug they picked at signup.
    if (typeof window !== 'undefined') {
      const pending = localStorage.getItem('lp.pendingBankClaim');
      const pendingLabel = localStorage.getItem('lp.pendingDisplayName');
      if (pending) {
        const { error } = await supabase.from('banks').insert({
          bank_name: pending,
          user_id: userId,
          display_label: pendingLabel || pending,
        });
        // Even if it fails (slug taken, etc.), clear the pending so we
        // don't keep retrying. The professor can claim from the picker.
        localStorage.removeItem('lp.pendingBankClaim');
        localStorage.removeItem('lp.pendingDisplayName');
        if (error) {
          console.warn('Pending bank claim failed:', error.message);
        }
      }
    }

    const { data, error } = await supabase
      .from('banks')
      .select('bank_name, display_label')
      .eq('user_id', userId)
      .order('bank_name');
    if (error) {
      setLoadErr(`Couldn't load your banks: ${error.message}`);
      return [];
    }
    const rows = (data ?? []) as BankRow[];
    setMyBanks(rows);
    return rows;
  };

  const loadProblems = async (bankName: string) => {
    if (!supabase || !bankName) return;
    setLoading(true);
    setLoadErr(null);
    try {
      const { data, error } = await supabase
        .from('problems')
        .select('data')
        .eq('bank_name', bankName)
        .order('problem_id');
      if (error) throw error;
      setProblems(((data ?? []) as { data: Problem }[]).map(r => r.data));
    } catch (e) {
      setLoadErr(`Couldn't load problems: ${e instanceof Error ? e.message : String(e)}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Initial load: fetch my banks, pick the remembered active one (or first).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const rows = await loadMyBanks();
      if (cancelled) return;
      const remembered = typeof window !== 'undefined'
        ? localStorage.getItem(ACTIVE_BANK_KEY(userId))
        : null;
      const initial = rows.find(b => b.bank_name === remembered)?.bank_name
                   ?? rows[0]?.bank_name
                   ?? '';
      if (initial) {
        setActiveBank(initial);
      } else {
        // No banks yet — show the picker so the professor can claim one.
        setShowBankPicker(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Reload problems whenever active bank changes.
  useEffect(() => {
    if (!activeBank) return;
    if (typeof window !== 'undefined' && userId) {
      localStorage.setItem(ACTIVE_BANK_KEY(userId), activeBank);
    }
    void loadProblems(activeBank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBank]);

  const handleSelectBank = (bankName: string) => {
    setActiveBank(bankName);
    setShowBankPicker(false);
  };

  const handleClaimNewBank = async (slug: string, label: string): Promise<string | null> => {
    if (!supabase || !userId) return 'Not signed in.';
    const { error } = await supabase.from('banks').insert({
      bank_name: slug,
      user_id: userId,
      display_label: label || slug,
    });
    if (error) return error.message;
    await loadMyBanks();
    setActiveBank(slug);
    setShowBankPicker(false);
    return null;
  };

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
              {user?.email ?? ''}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAgentSettingsOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-3.5 h-3.5 mr-1" /> Agent
            {agentSettings.apiKey
              ? <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              : <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />}
          </Button>
          {activeBank && (
            <>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Bank</span>
              <code className="text-[11px] bg-muted/40 border border-border rounded px-2 py-1 font-mono">{activeBank}</code>
              <button
                type="button"
                onClick={() => setShowBankPicker(true)}
                className="text-[10px] text-primary hover:text-primary/80 underline decoration-dotted"
              >
                switch
              </button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void signOut()}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      {showBankPicker && (
        <BankPickerOverlay
          myBanks={myBanks}
          activeBank={activeBank}
          onSelect={handleSelectBank}
          onClaim={handleClaimNewBank}
          onCancel={activeBank ? () => setShowBankPicker(false) : undefined}
        />
      )}

      {!activeBank ? null : (
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
                This bank is empty. Click <strong>New problem</strong> to add the first one.
                Whatever you save here will appear to any student who picks <code className="font-mono">{activeBank}</code> from the splash.
              </div>
            )}
            {problems.map(p => (
              <ProblemRow
                key={p.id}
                problem={p}
                onEdit={() => { setEditing({ ...p }); setEditingIsNew(false); }}
                onDelete={async () => {
                  if (!supabase) return;
                  if (!confirm(`Delete ${p.id}?`)) return;
                  const { error } = await supabase
                    .from('problems')
                    .delete()
                    .eq('bank_name', activeBank)
                    .eq('problem_id', p.id);
                  if (error) {
                    setLoadErr(`Delete failed: ${error.message}`);
                    return;
                  }
                  void loadProblems(activeBank);
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
          bankName={activeBank}
          existingIds={problems.map(p => p.id)}
          agentSettings={agentSettings}
          onUpdateDraft={(p) => setEditing(p)}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void loadProblems(activeBank);
          }}
        />
      )}

      {agentSettingsOpen && (
        <AgentSettingsOverlay
          settings={agentSettings}
          onSave={(s) => {
            setAgentSettings(s);
            writeAgentSettings(s);
            setAgentSettingsOpen(false);
          }}
          onClose={() => setAgentSettingsOpen(false)}
        />
      )}
    </div>
  );
}

// ── Agent settings: types + storage helpers ────────────────────────────────

interface AgentSettings {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model: string;
  curriculum: string;
}

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  provider: 'anthropic',
  apiKey: '',
  model: '',
  curriculum: '',
};

function readAgentSettings(): AgentSettings {
  if (typeof window === 'undefined') return DEFAULT_AGENT_SETTINGS;
  return {
    provider: ((localStorage.getItem(AGENT_PROVIDER_KEY) as AgentSettings['provider']) || 'anthropic'),
    apiKey: localStorage.getItem(AGENT_KEY_KEY) || '',
    model: localStorage.getItem(AGENT_MODEL_KEY) || '',
    curriculum: localStorage.getItem(AGENT_CURRICULUM_KEY) || '',
  };
}

function writeAgentSettings(s: AgentSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AGENT_PROVIDER_KEY, s.provider);
  localStorage.setItem(AGENT_KEY_KEY, s.apiKey);
  localStorage.setItem(AGENT_MODEL_KEY, s.model);
  localStorage.setItem(AGENT_CURRICULUM_KEY, s.curriculum);
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
  myBanks, activeBank, onSelect, onClaim, onCancel,
}: {
  myBanks: BankRow[];
  activeBank: string;
  onSelect: (bankName: string) => void;
  onClaim: (slug: string, label: string) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<'pick' | 'claim'>(myBanks.length === 0 ? 'claim' : 'pick');
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const cleaned = slug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,}$/.test(cleaned)) {
      setErr('Bank slug: lowercase letters, digits, dashes only (min 3 chars).');
      return;
    }
    setBusy(true);
    const error = await onClaim(cleaned, label.trim());
    setBusy(false);
    if (error) setErr(error);
  };

  return (
    <div className="fixed inset-0 z-30 bg-background/80 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-card border-2 border-primary/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Your banks</p>
            <p className="text-sm font-semibold">
              {mode === 'pick' ? 'Pick a bank to manage' : 'Claim a new bank slug'}
            </p>
          </div>
        </div>

        {mode === 'pick' && (
          <>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              These are the bank slugs you own. Students type one of these on the splash to find your problems.
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {myBanks.map(b => (
                <button
                  key={b.bank_name}
                  onClick={() => onSelect(b.bank_name)}
                  className={`w-full text-left px-3 py-2 rounded-md border transition ${
                    b.bank_name === activeBank
                      ? 'bg-primary/15 border-primary/50'
                      : 'bg-muted/20 border-border hover:bg-muted/40'
                  }`}
                >
                  <code className="text-sm font-mono font-semibold">{b.bank_name}</code>
                  {b.display_label && b.display_label !== b.bank_name && (
                    <span className="block text-[11px] text-muted-foreground mt-0.5">{b.display_label}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-between items-center pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => { setMode('claim'); setErr(null); }}
                className="text-[11px] text-primary hover:text-primary/80 underline decoration-dotted"
              >
                + Claim a new slug
              </button>
              {onCancel && (
                <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
                  Cancel
                </Button>
              )}
            </div>
          </>
        )}

        {mode === 'claim' && (
          <>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Pick a globally unique slug your students will type to find your problems.
              <strong> Lowercase letters, digits, and dashes only.</strong>
            </p>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Bank slug
              </label>
              <input
                autoFocus
                aria-label="Bank slug"
                placeholder="jenkins-orie310-fall26"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
                className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 font-mono focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Display label (optional)
              </label>
              <input
                aria-label="Display label"
                placeholder="ORIE 310 — Fall 2026"
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary"
              />
            </div>
            {err && (
              <div className="bg-rose-500/10 border border-rose-500/40 rounded px-3 py-2 text-[11px] text-rose-100">
                {err}
              </div>
            )}
            <div className="flex gap-2 justify-between items-center pt-2 border-t border-border/40">
              {myBanks.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setMode('pick'); setErr(null); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted"
                >
                  ← Back to my banks
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                {onCancel && (
                  <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={() => void submit()}
                  disabled={busy || !slug.trim()}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Claim slug
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AgentSettingsOverlay({
  settings, onSave, onClose,
}: {
  settings: AgentSettings;
  onSave: (s: AgentSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AgentSettings>(settings);
  const modelPlaceholder = draft.provider === 'anthropic'
    ? 'claude-opus-4-7'
    : 'gpt-4o-mini';

  return (
    <div className="fixed inset-0 z-30 bg-background/80 backdrop-blur flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border-2 border-primary/40 rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl my-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider text-primary font-bold">Agent settings</p>
            <p className="text-sm font-semibold">Bring your own API key</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Your API key is stored only in <strong>this browser&apos;s localStorage</strong>. It never goes anywhere
          except directly to the provider you choose, via this app&apos;s backend, for one request at a time. Clear
          your browser data to remove it.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider">
            <select
              aria-label="Provider"
              value={draft.provider}
              onChange={e => setDraft({ ...draft, provider: e.target.value as AgentSettings['provider'] })}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:border-primary"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
            </select>
          </Field>
          <Field label={`Model (default: ${modelPlaceholder})`}>
            <input
              aria-label="Model"
              type="text"
              value={draft.model}
              placeholder={modelPlaceholder}
              onChange={e => setDraft({ ...draft, model: e.target.value })}
              className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 font-mono focus:outline-none focus:border-primary"
            />
          </Field>
        </div>

        <Field label={`${draft.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key`}>
          <input
            aria-label="API key"
            type="password"
            value={draft.apiKey}
            onChange={e => setDraft({ ...draft, apiKey: e.target.value })}
            placeholder={draft.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
            className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-1.5 font-mono focus:outline-none focus:border-primary"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Don&apos;t have one yet? Get an API key from{' '}
            {draft.provider === 'anthropic' ? (
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline decoration-dotted"
              >
                console.anthropic.com/settings/keys
              </a>
            ) : (
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline decoration-dotted"
              >
                platform.openai.com/api-keys
              </a>
            )}
            . You&apos;ll need a billable account on the provider — the key
            is just an authentication token, it doesn&apos;t carry credit.
          </p>
        </Field>

        <Field label="Curriculum context (optional, included with every draft request)">
          <textarea
            aria-label="Curriculum context"
            rows={5}
            value={draft.curriculum}
            placeholder="Paste your syllabus, chapter, or specific constraints. Example: 'Chapter 4 covers transportation and assignment problems. All problems should be solvable in under 10 minutes by hand and use only ≤ constraints.'"
            onChange={e => setDraft({ ...draft, curriculum: e.target.value })}
            className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary"
          />
        </Field>

        <div className="flex justify-between items-center pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={() => { setDraft({ ...DEFAULT_AGENT_SETTINGS }); }}
            className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted"
          >
            Clear all
          </button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(draft)} className="bg-primary hover:bg-primary/90 text-white">
              <Save className="w-4 h-4 mr-1" /> Save settings
            </Button>
          </div>
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
  problem, isNew, bankName, existingIds, agentSettings,
  onUpdateDraft, onCancel, onSaved,
}: {
  problem: Problem;
  isNew: boolean;
  bankName: string;
  existingIds: string[];
  agentSettings: AgentSettings;
  onUpdateDraft: (p: Problem) => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Problem>(problem);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Agent drafting state
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentErr, setAgentErr] = useState<string | null>(null);
  const [agentRaw, setAgentRaw] = useState<string | null>(null);
  const [agentValidationErrors, setAgentValidationErrors] = useState<string[]>([]);

  const runAgentDraft = async () => {
    if (!agentSettings.apiKey) {
      setAgentErr('Set an API key in the Agent settings (header) first.');
      return;
    }
    if (!agentPrompt.trim()) {
      setAgentErr('Type a prompt — e.g. "a transportation problem with 3 variables".');
      return;
    }
    setAgentBusy(true);
    setAgentErr(null);
    setAgentRaw(null);
    setAgentValidationErrors([]);
    try {
      const res = await fetch(`${API_BASE}/admin/agent/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: agentSettings.provider,
          api_key: agentSettings.apiKey,
          model: agentSettings.model || null,
          prompt: agentPrompt,
          curriculum_context: agentSettings.curriculum || null,
          nDecVars_hint: draft.numVars || null,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setAgentErr(data.error);
        if (data.raw) setAgentRaw(data.raw);
        return;
      }
      if (!data.problem) {
        setAgentErr('Agent returned no problem.');
        return;
      }
      // Beginner D's check: if the LLM produced a structurally bad
      // problem, surface those errors and DO NOT pre-fill the form
      // (so the professor isn't tricked into saving garbage by reflex).
      if (Array.isArray(data.agent_validation_errors) && data.agent_validation_errors.length > 0) {
        setAgentValidationErrors(data.agent_validation_errors);
        if (data.raw) setAgentRaw(data.raw);
        return;
      }
      // Coerce the problem dict into our local shape and pre-fill the
      // form. Missing fields fall back to the existing draft values.
      const p = data.problem;
      const next: Problem = {
        id: String(p.id ?? draft.id ?? ''),
        title: String(p.title ?? draft.title ?? ''),
        category: String(p.category ?? draft.category ?? 'production'),
        difficulty: ['beginner', 'intermediate', 'advanced'].includes(p.difficulty)
          ? p.difficulty as Problem['difficulty']
          : draft.difficulty,
        scenario: String(p.scenario ?? ''),
        numVars: Number(p.numVars ?? draft.numVars) || 2,
        objectiveType: ['max', 'min'].includes(p.objectiveType) ? p.objectiveType : 'max',
        variables: Array.isArray(p.variables) ? p.variables.map(String) : draft.variables,
        objectiveCoefficients: Array.isArray(p.objectiveCoefficients)
          ? p.objectiveCoefficients.map(Number)
          : draft.objectiveCoefficients,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constraints: Array.isArray(p.constraints) ? p.constraints.map((c: any) => ({
          coefficients: Array.isArray(c.coefficients) ? c.coefficients.map(Number) : [],
          operator: ['<=', '>=', '='].includes(c.operator) ? c.operator : '<=',
          rhs: Number(c.rhs ?? 0),
          label: c.label ? String(c.label) : '',
        })) : draft.constraints,
      };
      setDraft(next);
      onUpdateDraft(next);
      setAgentPanelOpen(false);
      setAgentPrompt('');
    } catch (e) {
      setAgentErr(`Network error: ${e}`);
    } finally {
      setAgentBusy(false);
    }
  };

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
    if (!supabase) {
      setSaveErr('Supabase not configured.');
      return;
    }
    setSaving(true);
    setSaveErr(null);
    try {
      const { error } = await supabase
        .from('problems')
        .upsert({
          bank_name: bankName,
          problem_id: draft.id,
          data: draft,
        }, { onConflict: 'bank_name,problem_id' });
      if (error) {
        setSaveErr(error.message);
        return;
      }
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
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
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAgentPanelOpen(o => !o)}
                className={`${agentSettings.apiKey ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Bot className="w-4 h-4 mr-1" />
                {agentPanelOpen ? 'Hide agent' : 'Draft with agent'}
              </Button>
              <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>
          </div>

          {agentPanelOpen && (
            <div className="bg-primary/5 border-2 border-primary/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <p className="text-[11px] uppercase tracking-wider text-primary font-bold">Ask the agent to draft this problem</p>
              </div>
              {!agentSettings.apiKey && (
                <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/40 rounded px-2 py-1.5 space-y-1">
                  <p>
                    No API key set. Open <strong>Agent</strong> in the page header to add one.
                  </p>
                  <p className="text-amber-200/80">
                    Get a key from{' '}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-dotted hover:text-amber-100"
                    >
                      Anthropic
                    </a>{' '}
                    or{' '}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-dotted hover:text-amber-100"
                    >
                      OpenAI
                    </a>.
                  </p>
                </div>
              )}
              <textarea
                aria-label="Agent prompt"
                rows={3}
                placeholder='e.g. "A transportation problem with 3 variables and a budget constraint, intermediate difficulty"'
                value={agentPrompt}
                onChange={e => setAgentPrompt(e.target.value)}
                className="w-full text-sm bg-muted/40 border border-border rounded-md px-3 py-2 focus:outline-none focus:border-primary"
              />
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                <span>Provider: <strong>{agentSettings.provider}</strong></span>
                <span>·</span>
                <span>Model: <strong>{agentSettings.model || (agentSettings.provider === 'anthropic' ? 'claude-opus-4-7' : 'gpt-4o-mini')}</strong></span>
                {agentSettings.curriculum && (
                  <>
                    <span>·</span>
                    <span>Curriculum context: <strong>{agentSettings.curriculum.length} chars</strong> attached</span>
                  </>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => void runAgentDraft()}
                  disabled={agentBusy || !agentSettings.apiKey || !agentPrompt.trim()}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  {agentBusy
                    ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Drafting…</>
                    : <><Sparkles className="w-4 h-4 mr-1" /> Generate</>}
                </Button>
              </div>
              {agentErr && (
                <div className="bg-rose-500/10 border border-rose-500/40 rounded px-3 py-2 text-[11px] text-rose-100 space-y-1">
                  <p><AlertTriangle className="inline w-3 h-3 mr-1" />{agentErr}</p>
                  {agentRaw && (
                    <details className="text-rose-200/80">
                      <summary className="cursor-pointer">Raw model output</summary>
                      <pre className="text-[10px] whitespace-pre-wrap mt-1 max-h-40 overflow-y-auto">{agentRaw}</pre>
                    </details>
                  )}
                </div>
              )}
              {agentValidationErrors.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/40 rounded px-3 py-2 text-[11px] text-amber-100 space-y-1">
                  <p>
                    <AlertTriangle className="inline w-3 h-3 mr-1" />
                    The agent returned a structurally invalid problem.
                    The form was <strong>not</strong> pre-filled — fix your prompt or try again.
                  </p>
                  <ul className="list-disc pl-5">
                    {agentValidationErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                  {agentRaw && (
                    <details className="text-amber-200/80">
                      <summary className="cursor-pointer">Raw model output</summary>
                      <pre className="text-[10px] whitespace-pre-wrap mt-1 max-h-40 overflow-y-auto">{agentRaw}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

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
