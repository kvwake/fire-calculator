import { useAppState } from '../context/AppContext';
import { getAllStates } from '../data/stateTax';
import { FilingStatus, RothConversionStrategy, Account } from '../types';
import { useRef } from 'react';
import NumberInput from './NumberInput';

const states = getAllStates();

export default function SettingsPanel() {
  const { state, dispatch, exportData, importData } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateSettings = (updates: Partial<typeof state.settings>) => {
    dispatch({
      type: 'SET_SETTINGS',
      payload: { ...state.settings, ...updates },
    });
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fire-calculator-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const success = importData(text);
      if (!success) {
        alert('Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold dark:text-white">Settings</h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Retirement Year
          </label>
          <NumberInput
            value={state.settings.retirementYear}
            onChange={(v) => updateSettings({ retirementYear: v })}
            decimals={false}
            min={new Date().getFullYear()}
            max={new Date().getFullYear() + 50}
          />
          {state.people.length > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {state.people.map((p) => {
                const ageAtRetirement = p.currentAge + (state.settings.retirementYear - new Date().getFullYear());
                return `${p.name}: age ${ageAtRetirement}`;
              }).join(' / ')}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">State of Residence</label>
          <select
            value={state.settings.state}
            onChange={(e) => updateSettings({ state: e.target.value })}
            className={inputClass}
          >
            {states.map((s) => (
              <option key={s.abbreviation} value={s.abbreviation}>
                {s.name} ({s.abbreviation})
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filing Status</label>
          <select
            value={state.settings.filingStatus}
            onChange={(e) =>
              updateSettings({ filingStatus: e.target.value as FilingStatus })
            }
            className={inputClass}
          >
            <option value="single">Single</option>
            <option value="married">Married Filing Jointly</option>
          </select>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Inflation Rate (%)</label>
          <NumberInput
            value={state.settings.inflationRate}
            onChange={(v) => updateSettings({ inflationRate: v })}
            min={0}
            max={15}
            step={0.1}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            How much prices rise each year (historical average: ~3%). All results are shown in today's
            purchasing power — if your investments earn 10% nominal and inflation is 3%, the simulation uses
            the 7% "real" return so every dollar shown means the same thing it does today.
            Enter nominal (before-inflation) returns on each account.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Cash Buffer &amp; Floor
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            The cash buffer is your safety cushion — cash on hand so you don't have to sell investments
            during a downturn. The floor is the minimum reserve before the plan is considered a failure.
            The buffer can dip below its target to absorb bad years (sequence of returns risk), but not below the floor.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Buffer Target (years)
              </label>
              <NumberInput
                value={state.settings.cashYearsOfExpenses}
                onChange={(v) => updateSettings({ cashYearsOfExpenses: v })}
                decimals={false}
                min={0}
                max={10}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Cash to keep on hand. 2 years at $60k/yr = $120k buffer.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Floor Minimum (years)
              </label>
              <NumberInput
                value={state.settings.cashFloorYears ?? 1}
                onChange={(v) => updateSettings({ cashFloorYears: v })}
                decimals={false}
                min={0}
                max={5}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Below this triggers austerity (if enabled).
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  id="austerity"
                  checked={state.settings.austerityReduction !== null && state.settings.austerityReduction !== undefined}
                  onChange={(e) =>
                    updateSettings({ austerityReduction: e.target.checked ? 25 : null })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                <label htmlFor="austerity" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Austerity Mode
                </label>
              </div>
              {state.settings.austerityReduction !== null && state.settings.austerityReduction !== undefined && (
                <div className="flex items-center gap-2">
                  <NumberInput
                    value={state.settings.austerityReduction}
                    onChange={(v) => updateSettings({ austerityReduction: v })}
                    min={5}
                    max={50}
                    step={5}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Cut spending by this % when cash drops below floor.
                Recovers when cash returns to buffer target.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="glidePath"
              checked={state.settings.glidePath?.enabled ?? false}
              onChange={(e) =>
                updateSettings({
                  glidePath: {
                    ...(state.settings.glidePath ?? { safeYearsStart: 7, safeYearsEnd: 3 }),
                    enabled: e.target.checked,
                  },
                })
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
            />
            <label htmlFor="glidePath" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Asset Allocation Glide Path
            </label>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Automatically shifts from conservative (more bonds) to growth (more equity) over retirement.
            "Safe years" = how many years of expenses are held in bonds+cash. Early retirement benefits from
            more conservative allocation to protect against sequence-of-returns risk.
            Only applies to Monte Carlo and historical backtesting.
          </p>
          {state.settings.glidePath?.enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Safe Years at Start of Retirement
                </label>
                <NumberInput
                  value={state.settings.glidePath?.safeYearsStart ?? 7}
                  onChange={(v) =>
                    updateSettings({
                      glidePath: { ...state.settings.glidePath, enabled: true, safeYearsStart: v },
                    })
                  }
                  min={0}
                  max={15}
                  step={1}
                  decimals={false}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  More conservative early on — higher bond allocation protects against bad early sequences.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Safe Years at End of Retirement
                </label>
                <NumberInput
                  value={state.settings.glidePath?.safeYearsEnd ?? 3}
                  onChange={(v) =>
                    updateSettings({
                      glidePath: { ...state.settings.glidePath, enabled: true, safeYearsEnd: v },
                    })
                  }
                  min={0}
                  max={15}
                  step={1}
                  decimals={false}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Less conservative later — surviving portfolios benefit from equity growth.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Roth Conversion Strategy
          </label>
          <select
            value={state.settings.rothConversionStrategy ?? 'none'}
            onChange={(e) =>
              updateSettings({ rothConversionStrategy: e.target.value as RothConversionStrategy })
            }
            className={inputClass}
          >
            <option value="none">None</option>
            <option value="fill12">Convert below 12% (fill 10%)</option>
            <option value="fill22">Convert below 22% (fill 10–12%)</option>
            <option value="fill24">Convert below 24% (fill 10–22%)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            In low-income years, move money from traditional retirement accounts to Roth.
            You pay a small tax now at low rates to avoid paying more later at higher rates.
            "Below 22%" means: only convert when the tax rate on the conversion is under 22%
            (i.e., filling the 10% and 12% brackets). This also reduces future required withdrawals (RMDs).
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cap-gains-harvesting"
              checked={state.settings.capitalGainsHarvesting ?? false}
              onChange={(e) =>
                updateSettings({ capitalGainsHarvesting: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
            />
            <label htmlFor="cap-gains-harvesting" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Capital Gains Harvesting
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            When your income is low enough to qualify for the 0% capital gains tax rate,
            "sell" and immediately "rebuy" investments to lock in the gains tax-free.
            Your portfolio doesn't change, but your cost basis resets higher — meaning
            less tax when you actually sell later. Completely free money.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hsa-contrib-retirement"
              checked={state.settings.hsaContributionInRetirement ?? false}
              onChange={(e) => {
                const enabled = e.target.checked;
                updateSettings({ hsaContributionInRetirement: enabled });
                if (enabled) {
                  // Auto-create HSA accounts for people who don't have one
                  for (const person of state.people) {
                    const hasHSA = state.accounts.some(
                      (a) => a.type === 'hsa' && a.owner === person.id
                    );
                    if (!hasHSA) {
                      const hsaAccount: Account = {
                        id: crypto.randomUUID(),
                        name: `${person.name}'s HSA`,
                        type: 'hsa',
                        owner: person.id,
                        balance: 0,
                        annualContribution: 0,
                        contributionEndAge: 65,
                        expectedReturn: 10,
                        costBasis: 0,
                        seppEnabled: false,
                        dividendYield: 0,
                      };
                      dispatch({ type: 'ADD_ACCOUNT', payload: hsaAccount });
                    }
                  }
                }
              }}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
            />
            <label htmlFor="hsa-contrib-retirement" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              HSA Contributions in Retirement
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Continue contributing to HSA accounts during retirement (for people under 65 with an HSA).
            HSA contributions reduce your MAGI, which helps preserve ACA subsidies and lowers taxes.
            The money grows tax-free and can be withdrawn tax-free for medical expenses at any age,
            or penalty-free for any purpose after 65. Requires HDHP coverage.
          </p>
          {state.settings.hsaContributionInRetirement && state.people.length > 0 && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              HSA accounts created for: {state.people.filter((p) =>
                state.accounts.some((a) => a.type === 'hsa' && a.owner === p.id)
              ).map((p) => p.name).join(', ') || 'none yet'}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Withdrawal Rate Guardrails
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Control how much of your portfolio can be withdrawn each year. The draw rate is
            (spending + taxes - SS - pension) / portfolio. The hard limit caps actual withdrawals —
            unmet spending appears as a deficit.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  id="soft-limit"
                  checked={state.settings.withdrawalSoftLimit !== null && state.settings.withdrawalSoftLimit !== undefined}
                  onChange={(e) =>
                    updateSettings({ withdrawalSoftLimit: e.target.checked ? 4 : null })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                <label htmlFor="soft-limit" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Soft Limit (warning)
                </label>
              </div>
              {state.settings.withdrawalSoftLimit !== null && state.settings.withdrawalSoftLimit !== undefined && (
                <div className="flex items-center gap-2">
                  <NumberInput
                    value={state.settings.withdrawalSoftLimit}
                    onChange={(v) => updateSettings({ withdrawalSoftLimit: v })}
                    min={1}
                    max={20}
                    step={0.5}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  id="hard-limit"
                  checked={state.settings.withdrawalHardLimit !== null && state.settings.withdrawalHardLimit !== undefined}
                  onChange={(e) =>
                    updateSettings({ withdrawalHardLimit: e.target.checked ? 5 : null })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                <label htmlFor="hard-limit" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Hard Limit (cap withdrawals)
                </label>
              </div>
              {state.settings.withdrawalHardLimit !== null && state.settings.withdrawalHardLimit !== undefined && (
                <div className="flex items-center gap-2">
                  <NumberInput
                    value={state.settings.withdrawalHardLimit}
                    onChange={(v) => updateSettings({ withdrawalHardLimit: v })}
                    min={1}
                    max={20}
                    step={0.5}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Export/Import */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium dark:text-white">Data Management</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Your data is stored locally in your browser. Export it to save a backup, or import
          a previously saved file to continue where you left off.
        </p>

        <div className="flex gap-4">
          <button
            onClick={handleExport}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Export Data
          </button>

          <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
            Import Data
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
