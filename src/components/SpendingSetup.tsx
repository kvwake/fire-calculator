import { useAppState } from '../context/AppContext';
import { SpendingPhase } from '../types';
import NumberInput from './NumberInput';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);
}

export default function SpendingSetup() {
  const { state, dispatch } = useAppState();
  const { spending } = state;

  const updateSpending = (updates: Partial<typeof spending>) => {
    dispatch({ type: 'SET_SPENDING', payload: { ...spending, ...updates } });
  };

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

  const totalAnnualSpendExample = () => {
    const baseSpend = spending.phases[0]?.annualAmount ?? 0;
    const healthcarePre65 =
      spending.healthcare.pre65AnnualPerPerson * state.people.length;
    return baseSpend + healthcarePre65;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Spending Plan</h2>
        <p className="text-sm text-gray-500">
          Define your post-tax spending needs. The calculator will determine the gross
          withdrawals needed to cover taxes on top of this amount.
        </p>
      </div>

      {/* Spending Phases */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Spending Phases</h3>
          <button
            onClick={addPhase}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Phase
          </button>
        </div>

        <p className="text-sm text-gray-500">
          Define different spending levels for different age ranges. Ages reference the
          primary person (first person added).
        </p>

        {spending.phases.map((phase) => (
          <div
            key={phase.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Label</label>
                <input
                  type="text"
                  value={phase.label}
                  onChange={(e) => updatePhase(phase.id, { label: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Age</label>
                <NumberInput
                  value={phase.startAge}
                  onChange={(v) => updatePhase(phase.id, { startAge: v })}
                  decimals={false}
                  min={18}
                  max={120}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Age</label>
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
                  <label className="block text-sm font-medium text-gray-700">
                    Annual Spend ($)
                  </label>
                  <NumberInput
                    value={phase.annualAmount}
                    onChange={(v) => updatePhase(phase.id, { annualAmount: v })}
                    min={0}
                  />
                </div>
                {spending.phases.length > 1 && (
                  <button
                    onClick={() => removePhase(phase.id)}
                    className="mb-0.5 rounded px-2 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Healthcare Costs */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Healthcare Costs</h3>
        <p className="text-sm text-gray-500">
          Pre-65 healthcare costs are typically much higher (ACA marketplace premiums).
          After 65, Medicare reduces the cost significantly. These are per-person amounts
          added on top of your base spending.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700">
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
            <p className="mt-1 text-xs text-gray-500">
              ACA marketplace premiums average $7,000-$15,000/year per person
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700">
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
            <p className="mt-1 text-xs text-gray-500">
              Medicare Part B + supplemental typically $2,000-$5,000/year
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-blue-50 p-4">
        <h4 className="font-medium text-blue-900">Spending Summary (early retirement)</h4>
        <p className="text-sm text-blue-700">
          Base spending + pre-65 healthcare: {formatCurrency(totalAnnualSpendExample())}/year
          (in today's dollars)
        </p>
      </div>
    </div>
  );
}
