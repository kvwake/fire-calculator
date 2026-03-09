import { useState } from 'react';
import { useAppState } from '../context/AppContext';
import { SpendingPhase, BudgetItem, BudgetCategory, BUDGET_CATEGORY_LABELS } from '../types';
import { BUDGET_PRESETS } from '../data/budgetPresets';
import NumberInput from './NumberInput';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);
}

const CATEGORY_OPTIONS = Object.entries(BUDGET_CATEGORY_LABELS) as [BudgetCategory, string][];

export default function SpendingSetup() {
  const { state, dispatch } = useAppState();
  const { spending } = state;
  const budgetItems = spending.budgetItems || [];
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const updateSpending = (updates: Partial<typeof spending>) => {
    dispatch({ type: 'SET_SPENDING', payload: { ...spending, ...updates } });
  };

  // --- Phase CRUD ---
  const addPhase = () => {
    const lastPhase = spending.phases[spending.phases.length - 1];
    const newPhase: SpendingPhase = {
      id: crypto.randomUUID(),
      label: `Phase ${spending.phases.length + 1}`,
      startAge: lastPhase ? lastPhase.endAge + 1 : 55,
      endAge: lastPhase ? lastPhase.endAge + 10 : 95,
      annualAmount: lastPhase ? lastPhase.annualAmount : 60000,
    };
    updateSpending({ phases: [...spending.phases, newPhase] });
  };

  const updatePhase = (id: string, updates: Partial<SpendingPhase>) => {
    updateSpending({
      phases: spending.phases.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    });
  };

  const removePhase = (id: string) => {
    if (spending.phases.length <= 1) return;
    updateSpending({ phases: spending.phases.filter((p) => p.id !== id) });
  };

  // --- Budget Item CRUD ---
  const addBudgetItem = () => {
    const item: BudgetItem = {
      id: crypto.randomUUID(),
      category: 'other',
      description: '',
      monthlyAmount: 0,
      startAge: null,
      endAge: null,
      isOneTime: false,
      inflationOverride: null,
      preTax: false,
    };
    dispatch({ type: 'ADD_BUDGET_ITEM', payload: item });
  };

  const updateBudgetItem = (item: BudgetItem) => {
    dispatch({ type: 'UPDATE_BUDGET_ITEM', payload: item });
  };

  const removeBudgetItem = (id: string) => {
    dispatch({ type: 'REMOVE_BUDGET_ITEM', payload: id });
  };

  const loadPreset = (presetIndex: number) => {
    const preset = BUDGET_PRESETS[presetIndex];
    if (!preset) return;
    const items: BudgetItem[] = preset.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      startAge: null,
      endAge: null,
      isOneTime: false,
      inflationOverride: null,
      preTax: false,
    }));
    dispatch({ type: 'SET_BUDGET_ITEMS', payload: items });
    setShowPresets(false);
  };

  // --- Budget calculations ---
  const getBudgetTotalForPhase = (phase: SpendingPhase): number => {
    let annual = 0;
    for (const item of budgetItems) {
      const itemStart = item.startAge ?? phase.startAge;
      const itemEnd = item.endAge ?? phase.endAge;
      // Check if item overlaps this phase
      if (itemStart > phase.endAge || itemEnd < phase.startAge) continue;
      if (item.isOneTime) {
        // One-time expenses: only if the target age falls in this phase
        if (itemStart >= phase.startAge && itemStart <= phase.endAge) {
          // Amortize across phase years for annual amount
          const phaseYears = phase.endAge - phase.startAge + 1;
          annual += item.monthlyAmount / phaseYears; // monthlyAmount holds the one-time total
        }
      } else {
        annual += item.monthlyAmount * 12;
      }
    }
    return annual;
  };

  const budgetMonthlyTotal = budgetItems
    .filter((b) => !b.isOneTime)
    .reduce((s, b) => s + b.monthlyAmount, 0);
  const budgetAnnualTotal = budgetMonthlyTotal * 12;
  const oneTimeItems = budgetItems.filter((b) => b.isOneTime);
  const oneTimeTotal = oneTimeItems.reduce((s, b) => s + b.monthlyAmount, 0);

  const applyBudgetToPhase = (phaseId: string) => {
    const phase = spending.phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const total = getBudgetTotalForPhase(phase);
    updatePhase(phaseId, { annualAmount: Math.round(total), budgetEnabled: true });
  };

  const applyBudgetToAllPhases = () => {
    const updatedPhases = spending.phases.map((phase) => ({
      ...phase,
      annualAmount: Math.round(getBudgetTotalForPhase(phase)),
      budgetEnabled: true,
    }));
    updateSpending({ phases: updatedPhases });
  };

  // --- Summary ---
  const totalAnnualSpendExample = () => {
    const baseSpend = spending.phases[0]?.annualAmount ?? 0;
    const healthcarePre65 =
      spending.healthcare.pre65AnnualPerPerson * state.people.length;
    return baseSpend + healthcarePre65;
  };

  // --- Budget items grouped by category ---
  const groupedItems: Record<BudgetCategory, BudgetItem[]> = {} as any;
  for (const cat of CATEGORY_OPTIONS) {
    groupedItems[cat[0]] = [];
  }
  for (const item of budgetItems) {
    if (!groupedItems[item.category]) groupedItems[item.category] = [];
    groupedItems[item.category].push(item);
  }

  const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold dark:text-white">Spending Plan</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Define your post-tax spending needs. Use the budget builder for detailed line items,
          or enter a single annual amount per phase. The calculator determines gross withdrawals
          needed to cover taxes on top of this amount.
        </p>
      </div>

      {/* Budget Builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium dark:text-white">Budget Builder</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Presets
            </button>
            <button
              onClick={addBudgetItem}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              + Add Item
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Build a detailed monthly budget. Items apply across all spending phases unless you set
          custom age ranges. Use "Apply to Phases" to populate phase amounts from the budget.
        </p>

        {/* Presets dropdown */}
        {showPresets && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Start from a preset (replaces current budget items):
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {BUDGET_PRESETS.map((preset, i) => (
                <button
                  key={preset.name}
                  onClick={() => loadPreset(i)}
                  className="rounded-lg border border-gray-200 p-3 text-left hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{preset.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Budget items table */}
        {budgetItems.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Category</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Description</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Monthly</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Annual</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-300">Options</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_OPTIONS.map(([cat, label]) => {
                    const items = groupedItems[cat];
                    if (items.length === 0) return null;
                    const catTotal = items.filter(b => !b.isOneTime).reduce((s, b) => s + b.monthlyAmount, 0);
                    return (
                      <CategoryGroup
                        key={cat}
                        categoryLabel={label}
                        categoryTotal={catTotal}
                        items={items}
                        onUpdate={updateBudgetItem}
                        onRemove={removeBudgetItem}
                        inputClass={inputClass}
                      />
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 font-semibold text-gray-900 dark:text-white">
                      Recurring Total
                    </td>
                    <td className="px-3 py-2 text-right font-semibold font-mono text-gray-900 dark:text-white">
                      {formatCurrency(budgetMonthlyTotal)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold font-mono text-gray-900 dark:text-white">
                      {formatCurrency(budgetAnnualTotal)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                  {oneTimeTotal > 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-1 text-gray-600 dark:text-gray-400">
                        + One-time expenses ({oneTimeItems.length} items)
                      </td>
                      <td></td>
                      <td className="px-3 py-1 text-right font-mono text-gray-600 dark:text-gray-400">
                        {formatCurrency(oneTimeTotal)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            {/* Apply to phases */}
            <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Populate spending phases from this budget
              </p>
              <button
                onClick={applyBudgetToAllPhases}
                className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
              >
                Apply to All Phases
              </button>
            </div>
          </div>
        )}

        {budgetItems.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No budget items yet. Add items manually or start from a preset.
            </p>
          </div>
        )}
      </div>

      {/* Spending Phases */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium dark:text-white">Spending Phases</h3>
          <button
            onClick={addPhase}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            + Add Phase
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Define different spending levels for different age ranges. Ages reference the
          primary person. Use the budget builder above to populate amounts, or enter them directly.
        </p>

        {spending.phases.map((phase) => (
          <div
            key={phase.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Label</label>
                <input
                  type="text"
                  value={phase.label}
                  onChange={(e) => updatePhase(phase.id, { label: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Age</label>
                <NumberInput
                  value={phase.startAge}
                  onChange={(v) => updatePhase(phase.id, { startAge: v })}
                  decimals={false}
                  min={18}
                  max={120}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Age</label>
                <NumberInput
                  value={phase.endAge}
                  onChange={(v) => updatePhase(phase.id, { endAge: v })}
                  decimals={false}
                  min={phase.startAge}
                  max={120}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Annual Spend ($)
                  </label>
                  <NumberInput
                    value={phase.annualAmount}
                    onChange={(v) => updatePhase(phase.id, { annualAmount: v, budgetEnabled: false })}
                    min={0}
                  />
                </div>
                <div className="flex flex-col gap-1 mb-0.5">
                  {budgetItems.length > 0 && (
                    <button
                      onClick={() => applyBudgetToPhase(phase.id)}
                      className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                      title="Populate from budget"
                    >
                      Budget
                    </button>
                  )}
                  {spending.phases.length > 1 && (
                    <button
                      onClick={() => removePhase(phase.id)}
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            {phase.budgetEnabled && budgetItems.length > 0 && (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                Populated from budget ({formatCurrency(getBudgetTotalForPhase(phase))}/yr)
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Healthcare Costs */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium dark:text-white">Healthcare Costs</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pre-65 healthcare costs are typically much higher (ACA marketplace premiums).
          After 65, Medicare reduces the cost significantly. These are per-person amounts
          added on top of your base spending.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Pre-65 Healthcare (per person/year)
            </label>
            <NumberInput
              value={spending.healthcare.pre65AnnualPerPerson}
              onChange={(v) =>
                updateSpending({
                  healthcare: { ...spending.healthcare, pre65AnnualPerPerson: v },
                })
              }
              min={0}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              ACA marketplace premiums average $7,000-$15,000/year per person
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Post-65 Healthcare (per person/year)
            </label>
            <NumberInput
              value={spending.healthcare.post65AnnualPerPerson}
              onChange={(v) =>
                updateSpending({
                  healthcare: { ...spending.healthcare, post65AnnualPerPerson: v },
                })
              }
              min={0}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Medicare Part B + supplemental typically $2,000-$5,000/year
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="healthcare-inflation"
              checked={spending.healthcare.inflationRate !== null && spending.healthcare.inflationRate !== undefined}
              onChange={(e) =>
                updateSpending({
                  healthcare: {
                    ...spending.healthcare,
                    inflationRate: e.target.checked ? 5.5 : null,
                  },
                })
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
            />
            <label htmlFor="healthcare-inflation" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Separate Healthcare Inflation Rate
            </label>
          </div>
          {spending.healthcare.inflationRate !== null && spending.healthcare.inflationRate !== undefined && (
            <div>
              <NumberInput
                value={spending.healthcare.inflationRate}
                onChange={(v) =>
                  updateSpending({
                    healthcare: { ...spending.healthcare, inflationRate: v },
                  })
                }
                min={0}
                max={15}
                step={0.1}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Healthcare historically inflates at ~5–6% vs ~3% general inflation.
                The excess rate compounds over time, increasing healthcare costs in
                real terms. Leave unchecked to use the general inflation rate.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/30">
        <h4 className="font-medium text-blue-900 dark:text-blue-300">Spending Summary (early retirement)</h4>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Base spending + pre-65 healthcare: {formatCurrency(totalAnnualSpendExample())}/year
          (in today's dollars)
        </p>
        {budgetItems.length > 0 && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Budget total: {formatCurrency(budgetAnnualTotal)}/yr recurring
            {oneTimeTotal > 0 && ` + ${formatCurrency(oneTimeTotal)} one-time`}
          </p>
        )}
      </div>
    </div>
  );
}

// --- Category Group Sub-component ---
function CategoryGroup({
  categoryLabel,
  categoryTotal,
  items,
  onUpdate,
  onRemove,
  inputClass,
}: {
  categoryLabel: string;
  categoryTotal: number;
  items: BudgetItem[];
  onUpdate: (item: BudgetItem) => void;
  onRemove: (id: string) => void;
  inputClass: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <>
      {/* Category header */}
      <tr className="bg-gray-50 dark:bg-gray-900/30">
        <td colSpan={2} className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          {categoryLabel}
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-mono text-gray-500 dark:text-gray-400">
          {formatCurrency(categoryTotal)}
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-mono text-gray-500 dark:text-gray-400">
          {formatCurrency(categoryTotal * 12)}
        </td>
        <td colSpan={2}></td>
      </tr>
      {items.map((item) => (
        <BudgetItemRow
          key={item.id}
          item={item}
          onUpdate={onUpdate}
          onRemove={onRemove}
          inputClass={inputClass}
          isExpanded={!!expanded[item.id]}
          onToggleExpand={() => setExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
        />
      ))}
    </>
  );
}

// --- Budget Item Row Sub-component ---
function BudgetItemRow({
  item,
  onUpdate,
  onRemove,
  inputClass,
  isExpanded,
  onToggleExpand,
}: {
  item: BudgetItem;
  onUpdate: (item: BudgetItem) => void;
  onRemove: (id: string) => void;
  inputClass: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <>
      <tr className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
        <td className="px-3 py-1.5">
          <select
            value={item.category}
            onChange={(e) => onUpdate({ ...item, category: e.target.value as BudgetCategory })}
            className="w-full text-xs rounded border border-gray-200 bg-white px-1 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {CATEGORY_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </td>
        <td className="px-3 py-1.5">
          <input
            type="text"
            value={item.description}
            onChange={(e) => onUpdate({ ...item, description: e.target.value })}
            placeholder="Description"
            className="w-full text-xs rounded border border-gray-200 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </td>
        <td className="px-3 py-1.5">
          {item.isOneTime ? (
            <span className="text-xs text-gray-400 dark:text-gray-500 text-right block">one-time</span>
          ) : (
            <NumberInput
              value={item.monthlyAmount}
              onChange={(v) => onUpdate({ ...item, monthlyAmount: v })}
              min={0}
              className="text-xs"
            />
          )}
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-xs text-gray-700 dark:text-gray-300">
          {item.isOneTime
            ? formatCurrency(item.monthlyAmount)
            : formatCurrency(item.monthlyAmount * 12)
          }
        </td>
        <td className="px-3 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1">
            {item.isOneTime && (
              <span className="inline-block rounded bg-purple-100 px-1 py-0.5 text-[9px] font-medium text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                1x
              </span>
            )}
            {item.preTax && (
              <span className="inline-block rounded bg-green-100 px-1 py-0.5 text-[9px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                pre-tax
              </span>
            )}
            {item.inflationOverride !== null && item.inflationOverride !== undefined && (
              <span className="inline-block rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                {item.inflationOverride}%
              </span>
            )}
            {(item.startAge || item.endAge) && (
              <span className="inline-block rounded bg-blue-100 px-1 py-0.5 text-[9px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                {item.startAge ?? '?'}-{item.endAge ?? '?'}
              </span>
            )}
            <button
              onClick={onToggleExpand}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs px-1"
              title="Options"
            >
              ...
            </button>
          </div>
        </td>
        <td className="px-2 py-1.5">
          <button
            onClick={() => onRemove(item.id)}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs"
            title="Remove"
          >
            x
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-3 py-2 bg-gray-50 dark:bg-gray-900/30">
            <div className="grid gap-3 sm:grid-cols-4 text-xs">
              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">Start Age</label>
                <NumberInput
                  value={item.startAge ?? 0}
                  onChange={(v) => onUpdate({ ...item, startAge: v || null })}
                  decimals={false}
                  min={0}
                  max={120}
                  className="text-xs"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">0 or blank = phase start</p>
              </div>
              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">End Age</label>
                <NumberInput
                  value={item.endAge ?? 0}
                  onChange={(v) => onUpdate({ ...item, endAge: v || null })}
                  decimals={false}
                  min={0}
                  max={120}
                  className="text-xs"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">0 or blank = phase end</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!item.isOneTime}
                    onChange={(e) => onUpdate({ ...item, isOneTime: e.target.checked })}
                    className="h-3 w-3 rounded border-gray-300 text-blue-600 dark:border-gray-600"
                  />
                  <label className="text-gray-600 dark:text-gray-400">One-time expense</label>
                </div>
                {item.isOneTime && (
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Total Amount ($)</label>
                    <NumberInput
                      value={item.monthlyAmount}
                      onChange={(v) => onUpdate({ ...item, monthlyAmount: v })}
                      min={0}
                      className="text-xs"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!item.preTax}
                    onChange={(e) => onUpdate({ ...item, preTax: e.target.checked })}
                    className="h-3 w-3 rounded border-gray-300 text-blue-600 dark:border-gray-600"
                  />
                  <label className="text-gray-600 dark:text-gray-400">Pre-tax (e.g. HSA medical)</label>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={item.inflationOverride !== null && item.inflationOverride !== undefined}
                    onChange={(e) => onUpdate({ ...item, inflationOverride: e.target.checked ? 5 : null })}
                    className="h-3 w-3 rounded border-gray-300 text-blue-600 dark:border-gray-600"
                  />
                  <label className="text-gray-600 dark:text-gray-400">Custom inflation</label>
                </div>
                {item.inflationOverride !== null && item.inflationOverride !== undefined && (
                  <NumberInput
                    value={item.inflationOverride}
                    onChange={(v) => onUpdate({ ...item, inflationOverride: v })}
                    min={0}
                    max={15}
                    step={0.5}
                    className="text-xs"
                  />
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">Override general inflation for this item</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
