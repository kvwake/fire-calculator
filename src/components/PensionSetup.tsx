import { useAppState } from '../context/AppContext';
import { PensionConfig } from '../types';
import NumberInput from './NumberInput';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);
}

export default function PensionSetup() {
  const { state, dispatch } = useAppState();

  if (state.people.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
        <p className="text-gray-500 dark:text-gray-400">Add people first.</p>
      </div>
    );
  }

  const pensions = state.pensions || [];

  const addPension = () => {
    const pension: PensionConfig = {
      id: crypto.randomUUID(),
      personId: state.people[0].id,
      enabled: true,
      name: `Pension ${pensions.length + 1}`,
      annualBenefit: 24000,
      startAge: 60,
      cola: 0,
    };
    dispatch({ type: 'ADD_PENSION', payload: pension });
  };

  const updatePension = (pension: PensionConfig) => {
    dispatch({ type: 'UPDATE_PENSION', payload: pension });
  };

  const removePension = (id: string) => {
    dispatch({ type: 'REMOVE_PENSION', payload: id });
  };

  const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium dark:text-white">Pensions</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Defined-benefit pension income. Taxed as ordinary income.
          </p>
        </div>
        <button
          onClick={addPension}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          + Add Pension
        </button>
      </div>

      {pensions.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No pensions configured. Add one if you have a defined-benefit pension.
        </p>
      )}

      {pensions.map((pension) => {
        const person = state.people.find((p) => p.id === pension.personId);
        return (
          <div
            key={pension.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pension.enabled}
                  onChange={(e) => updatePension({ ...pension, enabled: e.target.checked })}
                  className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                <span className="font-medium dark:text-white">{pension.name || 'Pension'}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ({person?.name ?? 'Unknown'})
                </span>
              </div>
              <button
                onClick={() => removePension(pension.id)}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove
              </button>
            </div>

            {pension.enabled && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                  <input
                    type="text"
                    value={pension.name}
                    onChange={(e) => updatePension({ ...pension, name: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Owner</label>
                  <select
                    value={pension.personId}
                    onChange={(e) => updatePension({ ...pension, personId: e.target.value })}
                    className={inputClass}
                  >
                    {state.people.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Annual Benefit ($)
                  </label>
                  <NumberInput
                    value={pension.annualBenefit}
                    onChange={(v) => updatePension({ ...pension, annualBenefit: v })}
                    min={0}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    In today's dollars
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Start Age
                  </label>
                  <NumberInput
                    value={pension.startAge}
                    onChange={(v) => updatePension({ ...pension, startAge: v })}
                    decimals={false}
                    min={40}
                    max={80}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    COLA (%)
                  </label>
                  <NumberInput
                    value={pension.cola}
                    onChange={(v) => updatePension({ ...pension, cola: v })}
                    min={0}
                    max={10}
                    step={0.1}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Annual cost-of-living adjustment. 0% = no inflation protection,
                    3% = keeps pace with typical inflation.
                  </p>
                </div>
              </div>
            )}

            {pension.enabled && (
              <div className="mt-3 rounded-md bg-gray-50 p-3 dark:bg-gray-700/50">
                <div className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Annual benefit at start: </span>
                  <span className="font-semibold dark:text-white">{formatCurrency(pension.annualBenefit)}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {' '}({formatCurrency(pension.annualBenefit / 12)}/mo)
                  </span>
                </div>
                {pension.cola > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    With {pension.cola}% COLA, benefit grows each year to offset inflation.
                  </div>
                )}
                {pension.cola === 0 && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    No COLA — purchasing power will decline with inflation over time.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
