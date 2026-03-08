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
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-gray-500">Add people first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Social Security</h2>
      <p className="text-sm text-gray-500">
        Enter your expected monthly benefit at full retirement age (67).
        The calculator will adjust for early or delayed claiming.
        Maximum benefit at FRA: {formatCurrency(MAX_MONTHLY_BENEFIT_AT_FRA)}/month.
      </p>

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
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h3 className="mb-4 font-medium">{person.name}</h3>

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
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor={`ss-enabled-${person.id}`} className="text-sm text-gray-700">
                    Will receive Social Security
                  </label>
                </div>

                {ssConfig.enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
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
                        <p className="mt-1 text-xs text-red-600">
                          Maximum benefit at FRA is {formatCurrency(MAX_MONTHLY_BENEFIT_AT_FRA)}/month
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
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
                        className="mt-2 w-full"
                      />
                      <div className="mt-1 flex justify-between text-xs text-gray-500">
                        <span>62 (early)</span>
                        <span className="font-medium text-gray-900">
                          Age {ssConfig.claimingAge}
                        </span>
                        <span>70 (delayed)</span>
                      </div>
                    </div>

                    <div className="rounded-md bg-gray-50 p-3">
                      <div className="text-sm">
                        <span className="text-gray-600">Adjustment: </span>
                        <span
                          className={
                            adjustmentPercent < 0
                              ? 'font-medium text-red-600'
                              : adjustmentPercent > 0
                                ? 'font-medium text-green-600'
                                : 'font-medium'
                          }
                        >
                          {adjustmentPercent > 0 ? '+' : ''}
                          {adjustmentPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Annual benefit: </span>
                        <span className="font-semibold">{formatCurrency(annualBenefit)}</span>
                        <span className="text-gray-500">
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
