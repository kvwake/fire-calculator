import { useAppState } from '../context/AppContext';
import {
  MAX_MONTHLY_BENEFIT_AT_FRA,
  EARLIEST_CLAIMING_AGE,
  LATEST_CLAIMING_AGE,
  getClaimingAdjustmentPercent,
  getAnnualSSBenefit,
} from '../data/socialSecurity';
import NumberInput from './NumberInput';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);
}

export default function SocialSecuritySetup() {
  const { state, dispatch } = useAppState();

  if (state.people.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
        <p className="text-gray-500 dark:text-gray-400">Add people first.</p>
      </div>
    );
  }

  // Warn if retirement age suggests fewer than 35 years of work
  const retirementYear = state.settings.retirementYear;
  const earlyRetirementWarnings = state.people
    .filter((p) => {
      const retireAge = p.currentAge + (retirementYear - new Date().getFullYear());
      // Assume most people start working around age ~20, so 35 years = retire by ~55
      return retireAge < 53;
    })
    .map((p) => p.name);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold dark:text-white">Social Security</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Enter your expected monthly benefit at full retirement age (67).
        The calculator will adjust for early or delayed claiming.
        Maximum benefit at FRA: {formatCurrency(MAX_MONTHLY_BENEFIT_AT_FRA)}/month.
      </p>

      {earlyRetirementWarnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 dark:bg-amber-900/20 dark:border-amber-800">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Early retirement may reduce your SS benefit
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            {earlyRetirementWarnings.join(' and ')} will retire before age 53, likely
            resulting in fewer than 35 years of work history. Social Security uses your
            highest 35 years of earnings — missing years count as $0 and reduce your
            benefit. The amount shown on SSA.gov assumes you keep working until claiming age.
            Check your actual statement at{' '}
            <a href="https://www.ssa.gov/myaccount/" target="_blank" rel="noopener noreferrer"
               className="underline font-medium">ssa.gov/myaccount</a>{' '}
            and consider entering a lower benefit estimate.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {state.people.map((person) => {
          const ssConfig = state.socialSecurity.find((ss) => ss.personId === person.id);
          if (!ssConfig) return null;

          const adjustmentPercent = getClaimingAdjustmentPercent(ssConfig.claimingAge);
          const annualBenefit = getAnnualSSBenefit(
            ssConfig.monthlyBenefitAtFRA,
            ssConfig.claimingAge
          );

          return (
            <div
              key={person.id}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <h3 className="mb-4 font-medium dark:text-white">{person.name}</h3>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`ss-enabled-${person.id}`}
                    checked={ssConfig.enabled}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_SS_CONFIG',
                        payload: { ...ssConfig, enabled: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                  />
                  <label htmlFor={`ss-enabled-${person.id}`} className="text-sm text-gray-700 dark:text-gray-300">
                    Will receive Social Security
                  </label>
                </div>

                {ssConfig.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Monthly Benefit at FRA (age 67)
                      </label>
                      <NumberInput
                        value={ssConfig.monthlyBenefitAtFRA}
                        onChange={(v) => {
                          const val = Math.min(v, MAX_MONTHLY_BENEFIT_AT_FRA);
                          dispatch({
                            type: 'UPDATE_SS_CONFIG',
                            payload: { ...ssConfig, monthlyBenefitAtFRA: val },
                          });
                        }}
                        min={0}
                        max={MAX_MONTHLY_BENEFIT_AT_FRA}
                      />
                      {ssConfig.monthlyBenefitAtFRA > MAX_MONTHLY_BENEFIT_AT_FRA && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          Maximum benefit at FRA is {formatCurrency(MAX_MONTHLY_BENEFIT_AT_FRA)}/month
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Claiming Age
                      </label>
                      <input
                        type="range"
                        min={EARLIEST_CLAIMING_AGE}
                        max={LATEST_CLAIMING_AGE}
                        value={ssConfig.claimingAge}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_SS_CONFIG',
                            payload: { ...ssConfig, claimingAge: parseInt(e.target.value) },
                          })
                        }
                        className="mt-2 w-full accent-blue-600"
                      />
                      <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>62 (early)</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Age {ssConfig.claimingAge}
                        </span>
                        <span>70 (delayed)</span>
                      </div>
                    </div>

                    <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-700/50">
                      <div className="text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Adjustment: </span>
                        <span
                          className={
                            adjustmentPercent < 0
                              ? 'font-medium text-red-600 dark:text-red-400'
                              : adjustmentPercent > 0
                                ? 'font-medium text-green-600 dark:text-green-400'
                                : 'font-medium dark:text-white'
                          }
                        >
                          {adjustmentPercent > 0 ? '+' : ''}
                          {adjustmentPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Annual benefit: </span>
                        <span className="font-semibold dark:text-white">{formatCurrency(annualBenefit)}</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {' '}
                          ({formatCurrency(annualBenefit / 12)}/mo)
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
