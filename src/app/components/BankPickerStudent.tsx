/**
 * BankPickerStudent — splash-page bank chooser for students.
 *
 * Students don't sign in. They pick a bank slug their professor gave
 * them (or "Built-in problems only" if they're just exploring on their
 * own). Selection persists in localStorage and drives every student
 * page through useAllProblems().
 */

import { useAllBanks, getActiveBank, setActiveBank } from '../data/bankProblems';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { isConfigured } from '../lib/supabase';
import { GraduationCap } from 'lucide-react';

export default function BankPickerStudent() {
  const navigate = useNavigate();
  const { banks, loading } = useAllBanks();
  const [active, setActive] = useState<string>(() => getActiveBank());

  // Keep local state in sync if another tab changes it
  useEffect(() => {
    const handler = () => setActive(getActiveBank());
    window.addEventListener('lp-active-bank-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('lp-active-bank-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  if (!isConfigured) return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setActive(value);
    setActiveBank(value);
  };

  return (
    <div className="w-full max-w-2xl mt-3">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-300">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <label className="block">
              <span className="text-sm font-semibold text-slate-100">Class problem bank</span>
              <span className="block text-slate-400 text-xs leading-snug mt-0.5 mb-2">
                Pick the bank your professor told you to use. Their problems show up alongside the built-in ones.
              </span>
              <select
                aria-label="Class problem bank"
                value={active}
                onChange={handleChange}
                disabled={loading}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm font-mono focus:border-cyan-500 focus:outline-none"
              >
                <option value="">{loading ? 'Loading…' : 'Built-in problems only'}</option>
                {banks.map(b => (
                  <option key={b.bank_name} value={b.bank_name}>
                    {b.display_label && b.display_label !== b.bank_name
                      ? `${b.display_label} (${b.bank_name})`
                      : b.bank_name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => navigate('/practice')}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              {active ? 'Browse problems' : 'Browse built-in problems'}
              <span className="text-base">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
