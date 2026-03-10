import React, { useMemo, useState, ReactNode } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { useAppState } from '../context/AppContext';
import { useDark } from '../App';
import { runSimulation } from '../engine/simulation';
import { runMonteCarlo, runHistoricalBacktest, MonteCarloResult, HistoricalResult } from '../engine/monteCarlo';
import { ACCOUNT_TYPE_LABELS, YearResult, Account } from '../types';
import Term from './Term';

const CURRENT_YEAR = new Date().getFullYear();

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);
}

function formatCompact(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
  return `$${val.toFixed(0)}`;
}

function CellTooltip({ children, content }: { children: ReactNode; content: ReactNode | null }) {
  const [show, setShow] = useState(false);

  if (!content) return <>{children}</>;

  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="cursor-help border-b border-dotted border-gray-400 dark:border-gray-500">{children}</span>
      {show && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-80 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-xl dark:border-gray-600 dark:bg-gray-800">
          {content}
        </div>
      )}
    </div>
  );
}

type SimMode = 'deterministic' | 'montecarlo' | 'historical';

export default function Results() {
  const { state, dispatch } = useAppState();
  const isDark = useDark();
  const [simMode, setSimMode] = useState<SimMode>('deterministic');
  const [mcTrials, setMcTrials] = useState(1000);

  const simulation = useMemo(() => runSimulation(state), [state]);

  const monteCarloResult = useMemo<MonteCarloResult | null>(() => {
    if (simMode !== 'montecarlo' || state.people.length === 0 || state.accounts.length === 0) return null;
    return runMonteCarlo(state, mcTrials, 42);
  }, [state, simMode, mcTrials]);

  const historicalResult = useMemo<HistoricalResult | null>(() => {
    if (simMode !== 'historical' || state.people.length === 0 || state.accounts.length === 0) return null;
    return runHistoricalBacktest(state);
  }, [state, simMode]);

  if (state.people.length === 0 || state.accounts.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
        <p className="text-gray-500 dark:text-gray-400">
          Add at least one person and one account to see results.
        </p>
      </div>
    );
  }

  const primaryPerson = state.people[0];
  const secondPerson = state.people.length > 1 ? state.people[1] : null;
  const retirementYear = state.settings.retirementYear;
  const retirementYears = simulation.years.filter((y) => y.phase === 'retirement');
  const accumulationYears = simulation.years.filter((y) => y.phase === 'accumulation');

  const ageDiff = secondPerson
    ? secondPerson.currentAge - primaryPerson.currentAge
    : 0;

  const formatAge = (primaryAge: number) => {
    if (secondPerson) {
      return `${primaryAge}/${primaryAge + ageDiff}`;
    }
    return String(primaryAge);
  };

  // Build year lookup from age
  const yearByAge: Record<number, number> = {};
  for (const y of simulation.years) {
    const pAge = y.ages[primaryPerson.id];
    yearByAge[pAge] = y.year;
  }

  // Custom tick for X-axis showing year and age
  const CustomXTick = ({ x, y, payload }: { x: number; y: number; payload: { value: number } }) => {
    const age = payload.value;
    const yr = yearByAge[age];
    const tickColor = isDark ? '#9ca3af' : '#6b7280';
    const subColor = isDark ? '#6b7280' : '#9ca3af';
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={14} textAnchor="middle" fill={tickColor} fontSize={11}>
          {yr}
        </text>
        <text x={0} y={0} dy={27} textAnchor="middle" fill={subColor} fontSize={10}>
          {formatAge(age)}
        </text>
      </g>
    );
  };

  const formatChartTooltipLabel = (primaryAge: number) => {
    const yr = yearByAge[primaryAge] ?? '';
    if (secondPerson) {
      return `${yr} - ${primaryPerson.name}: ${primaryAge} / ${secondPerson.name}: ${primaryAge + ageDiff}`;
    }
    return `${yr} - Age ${primaryAge}`;
  };

  // Portfolio chart data
  const portfolioData = simulation.years.map((y) => ({
    age: y.ages[primaryPerson.id],
    year: y.year,
    ...Object.fromEntries(
      state.accounts.map((a) => [a.name, Math.round(y.accountBalances[a.id] || 0)])
    ),
  }));

  // Income/spending chart data for retirement years
  const incomeData = retirementYears.map((y) => {
    const ssTotal = Object.values(y.ssIncome).reduce((s, v) => s + v, 0);
    const pensionTotal = Object.values(y.pensionIncome).reduce((s, v) => s + v, 0);
    return {
      age: y.ages[primaryPerson.id],
      year: y.year,
      'Social Security': Math.round(ssTotal),
      Pension: Math.round(pensionTotal),
      Withdrawals: Math.round(y.totalIncome - ssTotal - pensionTotal),
      Taxes: Math.round(-y.totalTax),
    };
  });

  // Summary stats
  const retirementPortfolio =
    accumulationYears.length > 0
      ? accumulationYears[accumulationYears.length - 1].totalPortfolioValue
      : simulation.years[0]?.totalPortfolioValue ?? 0;

  const peakPortfolio = Math.max(...simulation.years.map((y) => y.totalPortfolioValue));
  const endPortfolio =
    simulation.years.length > 0
      ? simulation.years[simulation.years.length - 1].totalPortfolioValue
      : 0;

  const totalRetirementSpending = retirementYears.reduce((s, y) => s + y.totalSpending, 0);

  const accountColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#ec4899',
  ];

  // Recharts dark mode styles
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const tooltipStyle = isDark
    ? { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }
    : { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' };
  const axisTickFill = isDark ? '#9ca3af' : '#6b7280';

  function buildWithdrawalTooltip(year: YearResult) {
    const entries = Object.entries(year.withdrawals).filter(([, amt]) => amt > 0);
    const ssEntries = Object.entries(year.ssIncome).filter(([, amt]) => amt > 0);
    const pensionEntries = Object.entries(year.pensionIncome).filter(([, amt]) => amt > 0);
    if (entries.length === 0 && ssEntries.length === 0 && pensionEntries.length === 0) return null;

    return (
      <div className="space-y-1">
        <p className="font-medium text-gray-900 dark:text-white text-xs mb-1">
          Income Sources
          {year.acaConstrainedWithdrawals && (
            <Term t="aca subsidy"><span className="ml-1 inline-block rounded bg-green-100 px-1 py-0.5 text-[9px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
              ACA optimized
            </span></Term>
          )}
        </p>
        {ssEntries.map(([personId, amount]) => {
          const person = state.people.find((p) => p.id === personId);
          return (
            <div key={personId} className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400 truncate mr-2">
                SS: {person?.name ?? 'Unknown'}
                {year.taxableSSIncome > 0 && (
                  <span className="text-gray-400 dark:text-gray-500 ml-1">
                    ({((year.taxableSSIncome / Object.values(year.ssIncome).reduce((s, v) => s + v, 0)) * 100).toFixed(0)}% taxable)
                  </span>
                )}
              </span>
              <span className="font-mono whitespace-nowrap">{formatCurrency(amount)}</span>
            </div>
          );
        })}
        {pensionEntries.map(([pensionId, amount]) => {
          const pension = state.pensions?.find((p) => p.id === pensionId);
          return (
            <div key={pensionId} className="flex justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400 truncate mr-2">
                Pension: {pension?.name ?? 'Unknown'}
              </span>
              <span className="font-mono whitespace-nowrap">{formatCurrency(amount)}</span>
            </div>
          );
        })}
        {entries.length > 0 && (ssEntries.length > 0 || pensionEntries.length > 0) && (
          <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
        )}
        {entries.map(([accountId, amount]) => {
          const account = state.accounts.find((a) => a.id === accountId);
          const incomeDetail = year.incomeByAccount[accountId];
          const isSEPP = (year.seppWithdrawals[accountId] || 0) > 0;
          const isRMD = (year.rmds[accountId] || 0) > 0;
          const incomeDesc: string[] = [];
          if (incomeDetail) {
            if (incomeDetail.ordinary > 0) incomeDesc.push(`${formatCurrency(incomeDetail.ordinary)} ordinary`);
            if (incomeDetail.capitalGains > 0) incomeDesc.push(`${formatCurrency(incomeDetail.capitalGains)} cap gains`);
            if (incomeDetail.taxFree > 0) incomeDesc.push(`${formatCurrency(incomeDetail.taxFree)} tax-free`);
          }
          return (
            <div key={accountId} className="text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400 truncate mr-2">
                  {account?.name ?? 'Unknown'}
                  <span className="text-gray-400 dark:text-gray-500 ml-1">
                    ({account ? ACCOUNT_TYPE_LABELS[account.type] : ''})
                  </span>
                  {isSEPP && (
                    <Term t="sepp"><span className="ml-1 inline-block rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      SEPP
                    </span></Term>
                  )}
                  {isRMD && (
                    <Term t="rmd"><span className="ml-1 inline-block rounded bg-purple-100 px-1 py-0.5 text-[9px] font-medium text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                      RMD
                    </span></Term>
                  )}
                </span>
                <span className="font-mono whitespace-nowrap">{formatCurrency(amount)}</span>
              </div>
              {incomeDesc.length > 0 && (
                <div className="text-gray-400 dark:text-gray-500 ml-2 text-[10px]">
                  {incomeDesc.join(' + ')}
                </div>
              )}
            </div>
          );
        })}
        {/* Roth Conversions */}
        {Object.entries(year.rothConversions).filter(([, amt]) => amt > 0).length > 0 && (
          <>
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
            <p className="text-[10px] text-gray-400 dark:text-gray-500"><Term t="roth conversion">Roth Conversions</Term> (bracket-filling)</p>
            {Object.entries(year.rothConversions).filter(([, amt]) => amt > 0).map(([accountId, amount]) => {
              const account = state.accounts.find((a) => a.id === accountId);
              return (
                <div key={`rc-${accountId}`} className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 truncate mr-2">
                    {account?.name ?? 'Unknown'}
                    <span className="ml-1 inline-block rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                      → Roth
                    </span>
                  </span>
                  <span className="font-mono whitespace-nowrap">{formatCurrency(amount)}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  function buildTaxTooltip(year: YearResult) {
    if (year.totalTax <= 0) return null;

    // Collect accounts that generated taxable income
    const taxableAccounts = Object.entries(year.incomeByAccount)
      .filter(([, detail]) => detail.ordinary > 0 || detail.capitalGains > 0)
      .map(([accountId, detail]) => {
        const account = state.accounts.find((a) => a.id === accountId);
        return { account, detail };
      });

    return (
      <div className="space-y-1">
        <p className="font-medium text-gray-900 dark:text-white text-xs mb-1">Tax Breakdown</p>

        {/* Federal breakdown */}
        <div className="flex justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">Federal Income Tax</span>
          <span className="font-mono">{formatCurrency(year.federalIncomeTax)}</span>
        </div>
        {year.federalCapGainsTax > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400"><Term t="capital gains">Capital Gains Tax</Term></span>
            <span className="font-mono">{formatCurrency(year.federalCapGainsTax)}</span>
          </div>
        )}
        {year.niit > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400"><Term t="niit">NIIT (3.8%)</Term></span>
            <span className="font-mono">{formatCurrency(year.niit)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">State Tax ({state.settings.state})</span>
          <span className="font-mono">{formatCurrency(year.stateTax)}</span>
        </div>
        {year.irmaaSurcharge > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400"><Term t="irmaa">IRMAA Surcharge</Term></span>
            <span className="font-mono">{formatCurrency(year.irmaaSurcharge)}</span>
          </div>
        )}
        {year.earlyWithdrawalPenalty > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-red-600 dark:text-red-400 font-semibold">10% Early Withdrawal Penalty</span>
            <span className="font-mono text-red-600 dark:text-red-400 font-semibold">{formatCurrency(year.earlyWithdrawalPenalty)}</span>
          </div>
        )}
        {year.acaSubsidy > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-green-600 dark:text-green-400"><Term t="aca subsidy">ACA Subsidy</Term></span>
            <span className="font-mono text-green-600 dark:text-green-400">-{formatCurrency(year.acaSubsidy)}</span>
          </div>
        )}
        {year.acaOverCliff && (
          <div className="flex justify-between text-xs">
            <span className="text-red-600 dark:text-red-400 font-semibold"><Term t="aca cliff">ACA Subsidy LOST</Term></span>
            <span className="font-mono text-red-600 dark:text-red-400">$0</span>
          </div>
        )}

        {/* Taxable income sources */}
        {(taxableAccounts.length > 0 || year.taxableSSIncome > 0) && (
          <>
            <div className="border-t border-gray-200 dark:border-gray-600 mt-1 pt-1">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">Taxable Income Sources</p>
            </div>
            {year.taxableSSIncome > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Social Security (taxable)</span>
                <span className="font-mono">{formatCurrency(year.taxableSSIncome)}</span>
              </div>
            )}
            {taxableAccounts.map(({ account, detail }) => (
              <div key={account?.id ?? 'unknown'} className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 truncate mr-2">
                  {account?.name ?? 'Unknown'}
                </span>
                <span className="font-mono whitespace-nowrap">
                  {detail.ordinary > 0 && detail.capitalGains > 0
                    ? `${formatCurrency(detail.ordinary)} ord + ${formatCurrency(detail.capitalGains)} cg`
                    : detail.ordinary > 0
                      ? `${formatCurrency(detail.ordinary)} ord`
                      : `${formatCurrency(detail.capitalGains)} cg`
                  }
                </span>
              </div>
            ))}
          </>
        )}

        {year.totalTax > 0 && year.totalIncome > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-600 mt-1 pt-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-gray-700 dark:text-gray-300"><Term t="effective rate">Effective Rate</Term></span>
              <span className="font-mono">
                {((year.totalTax / year.totalIncome) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const retirementAgeP1 = primaryPerson.currentAge + (retirementYear - CURRENT_YEAR);

  const minRetYear = CURRENT_YEAR;
  const maxRetYear = CURRENT_YEAR + 40;

  const handleRetirementYearChange = (yr: number) => {
    dispatch({
      type: 'SET_SETTINGS',
      payload: { ...state.settings, retirementYear: yr },
    });
  };

  // Check if any SEPP is active in any year
  const hasSEPP = simulation.years.some((y) =>
    Object.values(y.seppWithdrawals).some((v) => v > 0)
  );

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold dark:text-white">Simulation Results</h2>

      {/* removed — methodology is now on its own tab */}

      {/* Retirement Year Slider */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Retirement Year
          </label>
          <input
            type="range"
            min={minRetYear}
            max={maxRetYear}
            value={retirementYear}
            onChange={(e) => handleRetirementYearChange(parseInt(e.target.value))}
            className="flex-1 accent-blue-600"
          />
          <span className="text-sm font-bold text-gray-900 dark:text-white w-12 text-center">
            {retirementYear}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {state.people.map((p) => {
            const ageAt = p.currentAge + (retirementYear - CURRENT_YEAR);
            return `${p.name}: age ${ageAt}`;
          }).join(' / ')}
          {hasSEPP && (
            <Term t="sepp"><span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              SEPP/72(t) active for early access
            </span></Term>
          )}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Portfolio at Retirement"
          value={formatCurrency(retirementPortfolio)}
          sublabel={`Year ${retirementYear} (age ${formatAge(retirementAgeP1)})`}
        />
        <SummaryCard
          label="Total Withdrawals"
          value={formatCurrency(simulation.totalRetirementWithdrawals)}
          sublabel="From portfolio during retirement"
          variant="blue"
        />
        <SummaryCard
          label="Total SS Income"
          value={formatCurrency(simulation.totalRetirementSSIncome)}
          sublabel="Lifetime Social Security"
        />
        {simulation.totalRetirementPensionIncome > 0 && (
          <SummaryCard
            label="Total Pension Income"
            value={formatCurrency(simulation.totalRetirementPensionIncome)}
            sublabel="Lifetime pension benefits"
          />
        )}
        <SummaryCard
          label="End Portfolio"
          value={formatCurrency(endPortfolio)}
          sublabel={`Age ${formatAge(primaryPerson.lifeExpectancy)}`}
          variant={endPortfolio <= 0 ? 'red' : undefined}
        />
        <SummaryCard
          label="Total Taxes Paid"
          value={formatCurrency(simulation.totalTaxesPaid)}
          sublabel={`${totalRetirementSpending > 0 ? ((simulation.totalTaxesPaid / totalRetirementSpending) * 100).toFixed(1) : 0}% of spending`}
        />
      </div>

      {/* Success/Failure indicator */}
      {simulation.successfulRetirement ? (
        <div className={`rounded-lg border p-4 ${
          simulation.firstDeficitAge !== null || simulation.firstCashFloorBreachAge !== null
            ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
            : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
        }`}>
          <p className={`font-medium ${
            simulation.firstDeficitAge !== null || simulation.firstCashFloorBreachAge !== null
              ? 'text-amber-800 dark:text-amber-300'
              : 'text-green-800 dark:text-green-300'
          }`}>
            Your portfolio survives through age {formatAge(primaryPerson.lifeExpectancy)}.
          </p>
          <p className={`text-sm ${
            simulation.firstDeficitAge !== null || simulation.firstCashFloorBreachAge !== null
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-green-700 dark:text-green-400'
          }`}>
            Ending balance: {formatCurrency(endPortfolio)} | Peak: {formatCurrency(peakPortfolio)}
          </p>
          {simulation.firstCashFloorBreachAge !== null && (
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Warning: Cash buffer dropped below the {state.settings.cashFloorYears ?? 1}-year floor
              at age {formatAge(simulation.firstCashFloorBreachAge)}.
            </p>
          )}
          {simulation.firstDeficitAge !== null && (
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Warning: {(() => {
                const deficitYears = simulation.years.filter(y => y.deficit > 0);
                const totalDeficit = deficitYears.reduce((s, y) => s + y.deficit, 0);
                return `${deficitYears.length} year${deficitYears.length !== 1 ? 's' : ''} with spending shortfalls totaling ${formatCurrency(totalDeficit)}.`;
              })()}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 dark:bg-red-900/20 dark:border-red-800">
          <p className="font-medium text-red-800 dark:text-red-300">
            Portfolio fully depleted at age {formatAge(simulation.portfolioDepletionAge!)}.
          </p>
          <p className="text-sm text-red-700 dark:text-red-400">
            Consider reducing spending, working longer, or increasing savings.
          </p>
        </div>
      )}

      {/* Portfolio Growth Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-medium dark:text-white">
          Portfolio Over Time
          {secondPerson && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
              (ages: {primaryPerson.name}/{secondPerson.name})
            </span>
          )}
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={portfolioData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="age"
              interval={4}
              tick={CustomXTick as any}
              height={40}
            />
            <YAxis tickFormatter={formatCompact} tick={{ fill: axisTickFill }} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => formatChartTooltipLabel(Number(label))}
              contentStyle={tooltipStyle}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={isDark ? { color: '#e5e7eb' } : undefined} />
            {state.accounts.map((account, i) => (
              <Area
                key={account.id}
                type="monotone"
                dataKey={account.name}
                stackId="1"
                stroke={accountColors[i % accountColors.length]}
                fill={accountColors[i % accountColors.length]}
                fillOpacity={isDark ? 0.5 : 0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Simulation Analysis Mode */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-lg font-medium dark:text-white">Risk Analysis</h3>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            {([
              ['deterministic', 'Deterministic'],
              ['montecarlo', 'Monte Carlo'],
              ['historical', 'Historical'],
            ] as [SimMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setSimMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  simMode === mode
                    ? 'bg-blue-600 text-white dark:bg-blue-500'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {simMode === 'deterministic' && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Uses your configured expected returns each year. This is a single-path projection
            assuming constant real returns. See Monte Carlo or Historical modes for risk analysis.
          </p>
        )}

        {simMode === 'montecarlo' && (
          <MonteCarloPanel
            result={monteCarloResult}
            isDark={isDark}
            trials={mcTrials}
            onTrialsChange={setMcTrials}
            formatAge={formatAge}
            primaryPerson={primaryPerson}
            secondPerson={secondPerson}
          />
        )}

        {simMode === 'historical' && (
          <HistoricalPanel
            result={historicalResult}
            isDark={isDark}
            formatAge={formatAge}
            primaryPerson={primaryPerson}
            secondPerson={secondPerson}
          />
        )}
      </div>

      {/* Income/Tax/Spending Chart */}
      {retirementYears.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-medium dark:text-white">
            Retirement Income & Taxes
            {secondPerson && (
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                (ages: {primaryPerson.name}/{secondPerson.name})
              </span>
            )}
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={incomeData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="age"
                interval={4}
                tick={CustomXTick as any}
                height={40}
              />
              <YAxis tickFormatter={formatCompact} tick={{ fill: axisTickFill }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(Math.abs(value))}
                labelFormatter={(label) => formatChartTooltipLabel(Number(label))}
                contentStyle={tooltipStyle}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={isDark ? { color: '#e5e7eb' } : undefined} />
              <Bar dataKey="Social Security" stackId="income" fill="#10b981" />
              <Bar dataKey="Pension" stackId="income" fill="#8b5cf6" />
              <Bar dataKey="Withdrawals" stackId="income" fill="#3b82f6" />
              <Bar dataKey="Taxes" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Year-by-Year Table */}
      <YearByYearTable
        years={simulation.years}
        accounts={state.accounts}
        people={state.people}
        settingsState={state.settings.state}
        buildWithdrawalTooltip={buildWithdrawalTooltip}
        buildTaxTooltip={buildTaxTooltip}
        withdrawalSoftLimit={state.settings.withdrawalSoftLimit ?? null}
        withdrawalHardLimit={state.settings.withdrawalHardLimit ?? null}
      />

      {/* Account Details at Key Ages */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-medium dark:text-white">Account Balances at Key Ages</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left dark:border-gray-700 dark:bg-gray-900/50">
                <th className="px-3 py-2 font-medium dark:text-gray-300">Year</th>
                <th className="px-3 py-2 font-medium dark:text-gray-300">Age</th>
                {state.accounts.map((a) => (
                  <th key={a.id} className="px-3 py-2 font-medium text-right dark:text-gray-300">
                    {a.name}
                    <br />
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                      {ACCOUNT_TYPE_LABELS[a.type]}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 font-medium text-right dark:text-gray-300">Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                retirementAgeP1,
                60,
                65,
                67,
                70,
                75,
                80,
                85,
                90,
                primaryPerson.lifeExpectancy,
              ]
                .filter((age, i, arr) => arr.indexOf(age) === i && age >= primaryPerson.currentAge && age <= primaryPerson.lifeExpectancy)
                .sort((a, b) => a - b)
                .map((targetAge) => {
                  const yearData = simulation.years.find(
                    (y) => y.ages[primaryPerson.id] === targetAge
                  );
                  if (!yearData) return null;

                  return (
                    <tr key={targetAge} className="border-b dark:border-gray-700">
                      <td className="px-3 py-1.5 font-mono text-xs dark:text-gray-300">{yearData.year}</td>
                      <td className="px-3 py-1.5 font-medium dark:text-gray-300">{formatAge(targetAge)}</td>
                      {state.accounts.map((a) => (
                        <td key={a.id} className="px-3 py-1.5 text-right font-mono text-xs dark:text-gray-300">
                          {formatCompact(yearData.accountBalances[a.id] || 0)}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-mono text-xs font-medium dark:text-white">
                        {formatCompact(yearData.totalPortfolioValue)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scenario Comparison */}
      <ScenarioComparison
        state={state}
        currentRetirementYear={retirementYear}
        primaryPerson={primaryPerson}
        secondPerson={secondPerson}
        isDark={isDark}
      />
    </div>
  );
}

function YearDetailPanel({
  year,
  accounts,
  people,
  settingsState,
}: {
  year: YearResult;
  accounts: Account[];
  people: { id: string; name: string }[];
  settingsState: string;
}) {
  const sectionClass = 'space-y-1';
  const headerClass = 'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide';
  const rowClass = 'flex justify-between text-xs';
  const labelClass = 'text-gray-600 dark:text-gray-400';
  const valueClass = 'font-mono text-gray-900 dark:text-gray-200';
  const dividerClass = 'border-t border-gray-200 dark:border-gray-700';

  const totalContributions = Object.values(year.contributions).reduce((s, v) => s + v, 0);
  const totalWithdrawals = Object.values(year.withdrawals).reduce((s, v) => s + v, 0);
  const totalRothConv = Object.values(year.rothConversions).reduce((s, v) => s + v, 0);
  const totalHarvested = Object.values(year.capitalGainsHarvested).reduce((s, v) => s + v, 0);
  const totalSS = Object.values(year.ssIncome).reduce((s, v) => s + v, 0);
  const totalPension = Object.values(year.pensionIncome).reduce((s, v) => s + v, 0);
  const totalGrowth = Object.values(year.growth).reduce((s, v) => s + v, 0);

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700">
      {/* Account Balances Waterfall */}
      <div className={sectionClass}>
        <p className={headerClass}>Account Balances</p>
        {accounts.map((a) => {
          const startBal = year.startingBalances[a.id] || 0;
          const endBal = year.accountBalances[a.id] || 0;
          const contrib = year.contributions[a.id] || 0;
          const withdrawal = year.withdrawals[a.id] || 0;
          const rothConv = year.rothConversions[a.id] || 0;
          const growth = year.growth[a.id] || 0;
          // Roth accounts receive conversions from traditional
          const rothReceived = a.type === 'roth'
            ? Object.values(year.rothConversions).reduce((s, v) => s + v, 0)
            : 0;

          if (startBal === 0 && endBal === 0) return null;

          const changes: { label: string; value: number; color: string }[] = [];
          if (contrib > 0) changes.push({ label: 'Contribution', value: contrib, color: 'text-green-600 dark:text-green-400' });
          if (withdrawal > 0) changes.push({ label: 'Withdrawal', value: -withdrawal, color: 'text-red-500 dark:text-red-400' });
          if (rothConv > 0) changes.push({ label: '→ Roth conv out', value: -rothConv, color: 'text-indigo-500 dark:text-indigo-400' });
          if (rothReceived > 0) changes.push({ label: '← Roth conv in', value: rothReceived, color: 'text-indigo-500 dark:text-indigo-400' });
          if (growth !== 0) changes.push({ label: 'Growth', value: growth, color: growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400' });

          return (
            <div key={a.id} className="mb-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-gray-700 dark:text-gray-300 truncate">{a.name}</span>
                <span className={valueClass}>{formatCurrency(endBal)}</span>
              </div>
              <div className="ml-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-400 dark:text-gray-500">Start</span>
                  <span className="font-mono text-gray-400 dark:text-gray-500">{formatCurrency(startBal)}</span>
                </div>
                {changes.map((c, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-gray-400 dark:text-gray-500">{c.label}</span>
                    <span className={`font-mono ${c.color}`}>
                      {c.value >= 0 ? '+' : ''}{formatCurrency(c.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className={dividerClass} />
        {(() => {
          const totalStart = Object.values(year.startingBalances).reduce((s, v) => s + v, 0);
          return (
            <div className="flex justify-between text-xs font-medium">
              <span className="text-gray-700 dark:text-gray-300">
                Total Portfolio
                <span className="font-normal text-gray-400 dark:text-gray-500 ml-1">
                  (was {formatCurrency(totalStart)})
                </span>
              </span>
              <span className="font-mono text-gray-900 dark:text-white">{formatCurrency(year.totalPortfolioValue)}</span>
            </div>
          );
        })()}
      </div>

      {/* Income & Withdrawals */}
      <div className={sectionClass}>
        <p className={headerClass}>
          {year.phase === 'accumulation' ? 'Summary' : 'Income & Withdrawals'}
        </p>

        {/* Social Security */}
        {totalSS > 0 && (
          <>
            {Object.entries(year.ssIncome).filter(([, v]) => v > 0).map(([personId, amount]) => {
              const person = people.find((p) => p.id === personId);
              return (
                <div key={personId} className={rowClass}>
                  <span className={labelClass}>SS: {person?.name ?? 'Unknown'}</span>
                  <span className="font-mono text-green-700 dark:text-green-400">+{formatCurrency(amount)}</span>
                </div>
              );
            })}
            {year.taxableSSIncome > 0 && (
              <div className="flex justify-end">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {formatCurrency(year.taxableSSIncome)} taxable ({((year.taxableSSIncome / totalSS) * 100).toFixed(0)}%)
                </span>
              </div>
            )}
          </>
        )}

        {/* Pension Income */}
        {totalPension > 0 && (
          <>
            {Object.entries(year.pensionIncome).filter(([, v]) => v > 0).map(([pensionId, amount]) => (
              <div key={pensionId} className={rowClass}>
                <span className="text-purple-600 dark:text-purple-400">Pension</span>
                <span className="font-mono text-purple-700 dark:text-purple-400">+{formatCurrency(amount)}</span>
              </div>
            ))}
          </>
        )}

        {/* Withdrawals (retirement) */}
        {totalWithdrawals > 0 && (
          <>
            {(totalSS > 0 || totalPension > 0) && <div className={dividerClass} />}
            {Object.entries(year.withdrawals).filter(([, v]) => v > 0).map(([accountId, amount]) => {
              const account = accounts.find((a) => a.id === accountId);
              const isSEPP = (year.seppWithdrawals[accountId] || 0) > 0;
              const isRMD = (year.rmds[accountId] || 0) > 0;
              const incomeDetail = year.incomeByAccount[accountId];
              return (
                <div key={accountId} className="text-xs">
                  <div className={rowClass}>
                    <span className={labelClass}>
                      {account?.name ?? 'Unknown'}
                      {isSEPP && <Term t="sepp"><span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">SEPP</span></Term>}
                      {isRMD && <Term t="rmd"><span className="ml-1 rounded bg-purple-100 px-1 text-[9px] font-medium text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">RMD</span></Term>}
                    </span>
                    <span className={valueClass}>{formatCurrency(amount)}</span>
                  </div>
                  {incomeDetail && (
                    <div className="flex justify-end gap-2">
                      {incomeDetail.ordinary > 0 && <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatCurrency(incomeDetail.ordinary)} ordinary</span>}
                      {incomeDetail.capitalGains > 0 && <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatCurrency(incomeDetail.capitalGains)} cap gains</span>}
                      {incomeDetail.taxFree > 0 && <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatCurrency(incomeDetail.taxFree)} tax-free</span>}
                    </div>
                  )}
                </div>
              );
            })}
            <div className={dividerClass} />
            <div className={rowClass}>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Total Withdrawals</span>
              <span className="font-mono text-xs font-medium text-gray-900 dark:text-white">{formatCurrency(totalWithdrawals)}</span>
            </div>
          </>
        )}
      </div>

      {/* Tax Optimization & Taxes */}
      <div className={sectionClass}>
        <p className={headerClass}>Taxes & Optimization</p>

        {/* Roth Conversions */}
        {totalRothConv > 0 && (
          <>
            {Object.entries(year.rothConversions).filter(([, v]) => v > 0).map(([accountId, amount]) => {
              const account = accounts.find((a) => a.id === accountId);
              return (
                <div key={accountId} className={rowClass}>
                  <span className="text-indigo-600 dark:text-indigo-400">{account?.name ?? 'Unknown'} → Roth</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{formatCurrency(amount)}</span>
                </div>
              );
            })}
          </>
        )}

        {/* Capital Gains Harvesting */}
        {totalHarvested > 0 && (
          <>
            {Object.entries(year.capitalGainsHarvested).filter(([, v]) => v > 0).map(([accountId, amount]) => {
              const account = accounts.find((a) => a.id === accountId);
              return (
                <div key={accountId} className={rowClass}>
                  <span className="text-teal-600 dark:text-teal-400">{account?.name ?? 'Unknown'} gains harvested</span>
                  <span className="font-mono text-teal-600 dark:text-teal-400">{formatCurrency(amount)}</span>
                </div>
              );
            })}
          </>
        )}

        {(totalRothConv > 0 || totalHarvested > 0) && <div className={dividerClass} />}

        {/* Tax Breakdown */}
        {year.totalTax > 0 ? (
          <>
            <div className={rowClass}>
              <span className={labelClass}>Federal Income Tax</span>
              <span className="font-mono text-red-600 dark:text-red-400">{formatCurrency(year.federalIncomeTax)}</span>
            </div>
            {year.federalCapGainsTax > 0 && (
              <div className={rowClass}>
                <span className={labelClass}><Term t="capital gains">Capital Gains Tax</Term></span>
                <span className="font-mono text-red-600 dark:text-red-400">{formatCurrency(year.federalCapGainsTax)}</span>
              </div>
            )}
            {year.niit > 0 && (
              <div className={rowClass}>
                <span className={labelClass}><Term t="niit">NIIT (3.8%)</Term></span>
                <span className="font-mono text-red-600 dark:text-red-400">{formatCurrency(year.niit)}</span>
              </div>
            )}
            <div className={rowClass}>
              <span className={labelClass}>State Tax ({settingsState})</span>
              <span className="font-mono text-red-600 dark:text-red-400">{formatCurrency(year.stateTax)}</span>
            </div>
            {year.irmaaSurcharge > 0 && (
              <div className={rowClass}>
                <span className={labelClass}><Term t="irmaa">IRMAA Surcharge</Term></span>
                <span className="font-mono text-red-600 dark:text-red-400">{formatCurrency(year.irmaaSurcharge)}</span>
              </div>
            )}
            {year.earlyWithdrawalPenalty > 0 && (
              <div className={rowClass}>
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">10% Early Withdrawal Penalty</span>
                <span className="font-mono text-xs font-semibold text-red-700 dark:text-red-400">{formatCurrency(year.earlyWithdrawalPenalty)}</span>
              </div>
            )}
            {year.acaSubsidy > 0 && (
              <div className={rowClass}>
                <span className="text-xs text-green-600 dark:text-green-400"><Term t="aca subsidy">ACA Premium Subsidy</Term></span>
                <span className="font-mono text-xs text-green-600 dark:text-green-400">-{formatCurrency(year.acaSubsidy)}</span>
              </div>
            )}
            {year.acaOverCliff && (
              <div className={rowClass}>
                <span className="text-xs font-semibold text-red-700 dark:text-red-400"><Term t="aca cliff">ACA Subsidy LOST (over 400% FPL)</Term></span>
                <span className="font-mono text-xs text-red-700 dark:text-red-400">$0 subsidy</span>
              </div>
            )}
            <div className={dividerClass} />
            <div className={rowClass}>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Total Tax</span>
              <span className="font-mono text-xs font-medium text-red-600 dark:text-red-400">{formatCurrency(year.totalTax)}</span>
            </div>
            {year.totalIncome > 0 && (
              <div className="flex justify-end">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {((year.totalTax / year.totalIncome) * 100).toFixed(1)}% effective rate
                </span>
              </div>
            )}
          </>
        ) : (
          <div className={rowClass}>
            <span className={labelClass}>No taxes</span>
            <span className={valueClass}>-</span>
          </div>
        )}
      </div>

      {/* Spending */}
      <div className={sectionClass}>
        <p className={headerClass}>Spending</p>
        {year.totalSpending > 0 ? (
          <>
            {year.baseSpending > 0 && (
              <div className={rowClass}>
                <span className={labelClass}>Base Spending</span>
                <span className={valueClass}>{formatCurrency(year.baseSpending)}</span>
              </div>
            )}
            {year.healthcareCost > 0 && (
              <div className={rowClass}>
                <span className={labelClass}>Healthcare</span>
                <span className={valueClass}>{formatCurrency(year.healthcareCost)}</span>
              </div>
            )}
            {Object.keys(year.hsaContributions).length > 0 && (
              <>
                {Object.entries(year.hsaContributions).filter(([, v]) => v > 0).map(([accountId, amount]) => {
                  const account = accounts.find((a) => a.id === accountId);
                  return (
                    <div key={accountId} className={rowClass}>
                      <span className="text-teal-600 dark:text-teal-400">HSA Contribution ({account?.name ?? 'HSA'})</span>
                      <span className="font-mono text-teal-600 dark:text-teal-400">{formatCurrency(amount)}</span>
                    </div>
                  );
                })}
              </>
            )}
            <div className={dividerClass} />
            <div className={rowClass}>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Total Spending</span>
              <span className="font-mono text-xs font-medium text-gray-900 dark:text-white">{formatCurrency(year.totalSpending)}</span>
            </div>
          </>
        ) : (
          <div className={rowClass}>
            <span className={labelClass}>No spending (accumulation)</span>
            <span className={valueClass}>-</span>
          </div>
        )}

        {/* Deficit */}
        {year.deficit > 0 && (
          <>
            <div className={dividerClass} />
            <div className={rowClass}>
              <span className="text-xs font-medium text-red-700 dark:text-red-400">Deficit</span>
              <span className="font-mono text-xs font-medium text-red-600 dark:text-red-400">{formatCurrency(year.deficit)}</span>
            </div>
          </>
        )}
      </div>

      {/* Annotations / Decision Reasoning */}
      {year.annotations.length > 0 && (
        <div className="sm:col-span-2 lg:col-span-4 border-t border-gray-200 dark:border-gray-700 pt-3 mt-1">
          <AnnotationsPanel annotations={year.annotations} />
        </div>
      )}
    </div>
  );
}

function AnnotationsPanel({ annotations }: { annotations: string[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
      >
        <span>{expanded ? '▾' : '▸'}</span>
        Why these actions? ({annotations.length} decision{annotations.length !== 1 ? 's' : ''})
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {annotations.map((note, i) => {
            // Split on colon to get the category label
            const colonIdx = note.indexOf(':');
            const label = colonIdx > 0 ? note.slice(0, colonIdx) : '';
            const body = colonIdx > 0 ? note.slice(colonIdx + 1).trim() : note;

            const isSkipped = body.toLowerCase().startsWith('skipped');

            return (
              <div
                key={i}
                className={`rounded border px-3 py-2 text-[11px] leading-relaxed ${
                  isSkipped
                    ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
                    : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                }`}
              >
                {label && (
                  <span className={`font-semibold ${
                    isSkipped
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-blue-700 dark:text-blue-300'
                  }`}>
                    {label}:
                  </span>
                )}{' '}
                <span className={
                  isSkipped
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-gray-700 dark:text-gray-300'
                }>
                  {body}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function MonteCarloPanel({
  result,
  isDark,
  trials,
  onTrialsChange,
  formatAge,
  primaryPerson,
  secondPerson,
}: {
  result: MonteCarloResult | null;
  isDark: boolean;
  trials: number;
  onTrialsChange: (n: number) => void;
  formatAge: (age: number) => string;
  primaryPerson: { id: string; name: string; currentAge: number };
  secondPerson: { id: string; name: string; currentAge: number } | null;
}) {
  if (!result) return null;

  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const axisTickFill = isDark ? '#9ca3af' : '#6b7280';
  const tooltipStyle = isDark
    ? { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }
    : { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' };

  const chartData = result.ages.map((age, i) => ({
    age,
    p5: Math.round(result.percentiles.p5[i]),
    p10: Math.round(result.percentiles.p10[i]),
    p25: Math.round(result.percentiles.p25[i]),
    p50: Math.round(result.percentiles.p50[i]),
    p75: Math.round(result.percentiles.p75[i]),
    p90: Math.round(result.percentiles.p90[i]),
  }));

  const successPct = (result.successRate * 100).toFixed(1);
  const successColor = result.successRate >= 0.9
    ? 'text-green-700 dark:text-green-400'
    : result.successRate >= 0.75
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-red-700 dark:text-red-400';

  const successBg = result.successRate >= 0.9
    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
    : result.successRate >= 0.75
      ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className={`rounded-lg border p-3 flex-1 ${successBg}`}>
          <span className="text-xs text-gray-600 dark:text-gray-400">Success Rate: </span>
          <span className={`text-lg font-bold ${successColor}`}>{successPct}%</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
            ({result.trials} trials)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-400">Trials:</label>
          <select
            value={trials}
            onChange={(e) => onTrialsChange(parseInt(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value={500}>500</option>
            <option value={1000}>1,000</option>
            <option value={2000}>2,000</option>
            <option value={5000}>5,000</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Randomizes annual market returns using historical S&P 500 real return statistics (mean ~7% real, ~17% std dev).
        Cash/bond accounts use their configured fixed returns. A trial "succeeds" if the portfolio
        is never fully depleted. Minor deficits (cash buffer temporarily exhausted) are survivable —
        only complete depletion of all accounts counts as failure.
      </p>
      <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-4">
        <span>Median end portfolio: <strong className="dark:text-gray-300">{formatCurrency(result.medianEndPortfolio)}</strong></span>
        <span>10th %ile: <strong className="dark:text-gray-300">{formatCurrency(result.trialEndPortfolios[Math.floor(result.trialEndPortfolios.length * 0.1)])}</strong></span>
        <span>5th %ile: <strong className="dark:text-gray-300">{formatCurrency(result.trialEndPortfolios[Math.floor(result.trialEndPortfolios.length * 0.05)])}</strong></span>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="age" interval={4} tick={{ fill: axisTickFill, fontSize: 11 }} />
          <YAxis tickFormatter={formatCompact} tick={{ fill: axisTickFill }} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0]?.payload;
              if (!data) return null;
              return (
                <div style={tooltipStyle} className="rounded-lg p-3 shadow-lg text-xs">
                  <p className="font-semibold mb-1">Age {formatAge(Number(label))}</p>
                  <div className="space-y-0.5">
                    <div className="flex justify-between gap-4"><span style={{ color: '#3b82f6' }}>90th %ile</span><span className="font-mono">{formatCurrency(data.p90)}</span></div>
                    <div className="flex justify-between gap-4"><span style={{ color: '#60a5fa' }}>75th %ile</span><span className="font-mono">{formatCurrency(data.p75)}</span></div>
                    <div className="flex justify-between gap-4"><span className="font-semibold" style={{ color: '#2563eb' }}>Median</span><span className="font-mono font-semibold">{formatCurrency(data.p50)}</span></div>
                    <div className="flex justify-between gap-4"><span style={{ color: '#f59e0b' }}>25th %ile</span><span className="font-mono">{formatCurrency(data.p25)}</span></div>
                    <div className="flex justify-between gap-4"><span style={{ color: '#ef4444' }}>10th %ile</span><span className="font-mono">{formatCurrency(data.p10)}</span></div>
                    <div className="flex justify-between gap-4"><span style={{ color: '#dc2626' }}>5th %ile</span><span className="font-mono">{formatCurrency(data.p5)}</span></div>
                  </div>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="p90" stroke="none" fill="#3b82f6" fillOpacity={0.08} name="90th %ile" />
          <Area type="monotone" dataKey="p75" stroke="none" fill="#3b82f6" fillOpacity={0.12} name="75th %ile" />
          <Area type="monotone" dataKey="p25" stroke="none" fill="#3b82f6" fillOpacity={0.0} name="25th %ile" />
          <Area type="monotone" dataKey="p10" stroke="none" fill="transparent" fillOpacity={0} name="10th %ile" />
          <Area type="monotone" dataKey="p5" stroke="none" fill="transparent" fillOpacity={0} name="5th %ile" />
          <Line type="monotone" dataKey="p50" stroke="#2563eb" strokeWidth={2} dot={false} name="Median" />
          <Line type="monotone" dataKey="p25" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" dot={false} name="25th %ile" />
          <Line type="monotone" dataKey="p10" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} name="10th %ile" />
          <Line type="monotone" dataKey="p5" stroke="#dc2626" strokeWidth={1.5} strokeDasharray="2 2" dot={false} name="5th %ile" />
          <Line type="monotone" dataKey="p75" stroke="#60a5fa" strokeWidth={1} strokeDasharray="3 3" dot={false} name="75th %ile" />
          <Line type="monotone" dataKey="p90" stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4" dot={false} name="90th %ile" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HistoricalPanel({
  result,
  isDark,
  formatAge,
  primaryPerson,
  secondPerson,
}: {
  result: HistoricalResult | null;
  isDark: boolean;
  formatAge: (age: number) => string;
  primaryPerson: { id: string; name: string; currentAge: number };
  secondPerson: { id: string; name: string; currentAge: number } | null;
}) {
  if (!result) return null;

  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const axisTickFill = isDark ? '#9ca3af' : '#6b7280';
  const tooltipStyle = isDark
    ? { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }
    : { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' };

  const chartData = result.ages.map((age, i) => ({
    age,
    p5: Math.round(result.percentiles.p5[i]),
    p10: Math.round(result.percentiles.p10[i]),
    p25: Math.round(result.percentiles.p25[i]),
    p50: Math.round(result.percentiles.p50[i]),
    p75: Math.round(result.percentiles.p75[i]),
    p90: Math.round(result.percentiles.p90[i]),
  }));

  const successPct = (result.successRate * 100).toFixed(1);
  const successCount = result.cycles.filter(c => c.successful).length;
  const successColor = result.successRate >= 0.9
    ? 'text-green-700 dark:text-green-400'
    : result.successRate >= 0.75
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-red-700 dark:text-red-400';

  const successBg = result.successRate >= 0.9
    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
    : result.successRate >= 0.75
      ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-3 ${successBg}`}>
        <span className="text-xs text-gray-600 dark:text-gray-400">Success Rate: </span>
        <span className={`text-lg font-bold ${successColor}`}>{successPct}%</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
          ({result.totalCycles} historical cycles tested, {successCount} survived)
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Tests your plan against every possible starting year from the S&P 500's history (1871–2024).
        Each cycle applies actual historical real returns for the duration of your retirement.
        Cash/bond accounts use their configured fixed returns. A cycle "survives" if the portfolio
        is never fully depleted.
      </p>
      <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-4">
        {result.worstStartYear && (
          <span>Worst start: <strong className="dark:text-gray-300">{result.worstStartYear}</strong></span>
        )}
        {result.bestStartYear && (
          <span>Best start: <strong className="dark:text-gray-300">{result.bestStartYear}</strong></span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="age" interval={4} tick={{ fill: axisTickFill, fontSize: 11 }} />
          <YAxis tickFormatter={formatCompact} tick={{ fill: axisTickFill }} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0]?.payload;
              if (!data) return null;
              return (
                <div style={tooltipStyle} className="rounded-lg p-3 shadow-lg text-xs">
                  <p className="font-semibold mb-1">Age {formatAge(Number(label))}</p>
                  <div className="space-y-0.5">
                    <div className="flex justify-between gap-4"><span style={{ color: '#10b981' }}>90th %ile</span><span className="font-mono">{formatCurrency(data.p90)}</span></div>
                    <div className="flex justify-between gap-4"><span style={{ color: '#34d399' }}>75th %ile</span><span className="font-mono">{formatCurrency(data.p75)}</span></div>
                    <div className="flex justify-between gap-4"><span className="font-semibold" style={{ color: '#059669' }}>Median</span><span className="font-mono font-semibold">{formatCurrency(data.p50)}</span></div>
                    <div className="flex justify-between gap-4"><span style={{ color: '#f59e0b' }}>25th %ile</span><span className="font-mono">{formatCurrency(data.p25)}</span></div>
                    <div className="flex justify-between gap-4"><span style={{ color: '#ef4444' }}>10th %ile</span><span className="font-mono">{formatCurrency(data.p10)}</span></div>
                    <div className="flex justify-between gap-4"><span style={{ color: '#dc2626' }}>5th %ile</span><span className="font-mono">{formatCurrency(data.p5)}</span></div>
                  </div>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="p90" stroke="none" fill="#10b981" fillOpacity={0.08} name="90th %ile" />
          <Area type="monotone" dataKey="p75" stroke="none" fill="#10b981" fillOpacity={0.12} name="75th %ile" />
          <Area type="monotone" dataKey="p25" stroke="none" fill="#10b981" fillOpacity={0.0} name="25th %ile" />
          <Area type="monotone" dataKey="p10" stroke="none" fill="transparent" fillOpacity={0} name="10th %ile" />
          <Area type="monotone" dataKey="p5" stroke="none" fill="transparent" fillOpacity={0} name="5th %ile" />
          <Line type="monotone" dataKey="p50" stroke="#059669" strokeWidth={2} dot={false} name="Median" />
          <Line type="monotone" dataKey="p25" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" dot={false} name="25th %ile" />
          <Line type="monotone" dataKey="p10" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} name="10th %ile" />
          <Line type="monotone" dataKey="p5" stroke="#dc2626" strokeWidth={1.5} strokeDasharray="2 2" dot={false} name="5th %ile" />
          <Line type="monotone" dataKey="p75" stroke="#34d399" strokeWidth={1} strokeDasharray="3 3" dot={false} name="75th %ile" />
          <Line type="monotone" dataKey="p90" stroke="#10b981" strokeWidth={1} strokeDasharray="4 4" dot={false} name="90th %ile" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function YearByYearTable({
  years,
  accounts,
  people,
  settingsState,
  buildWithdrawalTooltip,
  buildTaxTooltip,
  withdrawalSoftLimit,
  withdrawalHardLimit,
}: {
  years: YearResult[];
  accounts: Account[];
  people: { id: string; name: string }[];
  settingsState: string;
  buildWithdrawalTooltip: (year: YearResult) => ReactNode | null;
  buildTaxTooltip: (year: YearResult) => ReactNode | null;
  withdrawalSoftLimit: number | null;
  withdrawalHardLimit: number | null;
}) {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  const toggleYear = (yearIndex: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(yearIndex)) {
        next.delete(yearIndex);
      } else {
        next.add(yearIndex);
      }
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="border-b border-gray-200 p-4 text-lg font-medium dark:border-gray-700 dark:text-white">
        Year-by-Year Breakdown
        <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">Click a row to expand</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left dark:border-gray-700 dark:bg-gray-900/50">
              <th className="w-6 px-1 py-2"></th>
              <th className="px-3 py-2 font-medium dark:text-gray-300">Year</th>
              <th className="px-3 py-2 font-medium dark:text-gray-300">Age</th>
              <th className="px-3 py-2 font-medium dark:text-gray-300">Phase</th>
              <th className="px-3 py-2 font-medium text-right dark:text-gray-300">Portfolio</th>
              <th className="px-3 py-2 font-medium text-right dark:text-gray-300">SS Income</th>
              <th className="px-3 py-2 font-medium text-right dark:text-gray-300">Pension</th>
              <th className="px-3 py-2 font-medium text-right dark:text-gray-300">Withdrawals</th>
              <th className="px-3 py-2 font-medium text-right dark:text-gray-300">Roth Conv</th>
              <th className="px-3 py-2 font-medium text-right dark:text-gray-300">Taxes</th>
              <th className="px-3 py-2 font-medium text-right dark:text-gray-300">Spending <span className="font-normal text-[10px] text-gray-400 dark:text-gray-500">(draw %)</span></th>
              <th className="px-3 py-2 font-medium text-right dark:text-gray-300">Cash <span className="font-normal text-[10px] text-gray-400 dark:text-gray-500">(buffer)</span></th>
            </tr>
          </thead>
          <tbody>
            {years.map((year, i) => {
              const ssTotal = Object.values(year.ssIncome).reduce((s, v) => s + v, 0);
              const pensionTotal = Object.values(year.pensionIncome).reduce((s, v) => s + v, 0);
              const withdrawalTotal = Object.values(year.withdrawals).reduce(
                (s, v) => s + v,
                0
              );
              const ageStr = Object.entries(year.ages)
                .map(([id, age]) => {
                  const person = people.find((p) => p.id === id);
                  return person ? `${person.name}: ${age}` : `${age}`;
                })
                .join(' / ');

              const yearHasSEPP = Object.values(year.seppWithdrawals).some((v) => v > 0);
              const yearHasRMD = Object.values(year.rmds).some((v) => v > 0);
              const isExpanded = expandedYears.has(i);

              return (
                <React.Fragment key={i}>
                  <tr
                    onClick={() => toggleYear(i)}
                    className={`border-b dark:border-gray-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 ${
                      year.phase === 'retirement' ? '' : 'bg-gray-50/50 dark:bg-gray-900/30'
                    } ${year.deficit > 0 ? 'bg-red-50 dark:bg-red-900/20' : ''} ${isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    <td className="px-1 py-1.5 text-center text-xs text-gray-400 dark:text-gray-500">
                      {isExpanded ? '▼' : '▶'}
                    </td>
                    <td className="px-3 py-1.5 text-xs font-mono dark:text-gray-300">{year.year}</td>
                    <td className="px-3 py-1.5 text-xs dark:text-gray-300">{ageStr}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                          year.phase === 'retirement'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        }`}
                      >
                        {year.phase === 'retirement' ? 'Retired' : 'Working'}
                      </span>
                      {yearHasSEPP && (
                        <Term t="sepp"><span className="ml-1 inline-block rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          SEPP
                        </span></Term>
                      )}
                      {yearHasRMD && (
                        <Term t="rmd"><span className="ml-1 inline-block rounded bg-purple-100 px-1 py-0.5 text-[9px] font-medium text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                          RMD
                        </span></Term>
                      )}
                      {year.acaConstrainedWithdrawals && (
                        <Term t="aca subsidy"><span className="ml-1 inline-block rounded bg-green-100 px-1 py-0.5 text-[9px] font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                          ACA
                        </span></Term>
                      )}
                      {year.inAusterity && (
                        <span className="ml-1 inline-block rounded bg-orange-100 px-1 py-0.5 text-[9px] font-medium text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" title="Spending reduced — cash below floor">
                          LEAN
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs dark:text-gray-300">
                      {formatCompact(year.totalPortfolioValue)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs dark:text-gray-300">
                      {ssTotal > 0 ? formatCompact(ssTotal) : '-'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-purple-600 dark:text-purple-400">
                      {pensionTotal > 0 ? formatCompact(pensionTotal) : '-'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs dark:text-gray-300">
                      {withdrawalTotal > 0 ? (
                        <CellTooltip content={buildWithdrawalTooltip(year)}>
                          {formatCompact(withdrawalTotal)}
                        </CellTooltip>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-indigo-600 dark:text-indigo-400">
                      {(() => {
                        const convTotal = Object.values(year.rothConversions).reduce((s, v) => s + v, 0);
                        return convTotal > 0 ? formatCompact(convTotal) : '-';
                      })()}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-red-600 dark:text-red-400">
                      {year.totalTax > 0 ? (
                        <CellTooltip content={buildTaxTooltip(year)}>
                          {formatCompact(year.totalTax)}
                        </CellTooltip>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs dark:text-gray-300">
                      {year.totalSpending > 0 ? (
                        <>
                          <span>{formatCompact(year.totalSpending)}</span>
                          {(() => {
                            const startPortfolio = Object.values(year.startingBalances).reduce((s, v) => s + v, 0);
                            if (startPortfolio > 0 && year.phase === 'retirement') {
                              // Actual drain = what left the portfolio. Deficit was never funded, so subtract it.
                              const netDrain = year.totalSpending + year.totalTax - ssTotal - pensionTotal - year.deficit;
                              const pct = (netDrain / startPortfolio) * 100;
                              if (pct <= 0) return <span className="ml-1 text-[10px] text-green-500 dark:text-green-400">(0%)</span>;
                              const hard = withdrawalHardLimit;
                              const soft = withdrawalSoftLimit;
                              let colorClass: string;
                              if (hard !== null && pct > hard) {
                                colorClass = 'text-red-500 dark:text-red-400 font-semibold';
                              } else if (soft !== null && pct > soft) {
                                colorClass = 'text-amber-500 dark:text-amber-400';
                              } else if (hard === null && soft === null) {
                                // Default thresholds when no limits configured
                                colorClass = pct > 5
                                  ? 'text-red-500 dark:text-red-400'
                                  : pct > 4
                                    ? 'text-amber-500 dark:text-amber-400'
                                    : 'text-gray-400 dark:text-gray-500';
                              } else {
                                colorClass = 'text-gray-400 dark:text-gray-500';
                              }
                              return (
                                <span className={`ml-1 text-[10px] ${colorClass}`}>
                                  ({pct.toFixed(1)}%)
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </>
                      ) : '-'}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono text-xs ${
                      year.deficit > 0 ? 'text-red-600 dark:text-red-400' :
                      year.cashBelowFloor ? 'text-red-600 dark:text-red-400' :
                      year.bufferBorrowed > 0 ? 'text-amber-600 dark:text-amber-400' :
                      'text-gray-500 dark:text-gray-400'
                    }`}>
                      {year.phase === 'retirement' ? (
                        <>
                          {formatCompact(year.cashBalance)}
                          {year.deficit > 0 && (
                            <span className="ml-1 text-[9px] text-red-600 dark:text-red-400" title="Cash exhausted">DEFICIT</span>
                          )}
                          {year.cashBelowFloor && !year.deficit && (
                            <span className="ml-1 text-[9px] text-red-600 dark:text-red-400" title="Below cash floor">LOW</span>
                          )}
                          {year.bufferBorrowed > 0 && !year.cashBelowFloor && !year.deficit && (
                            <span className="ml-1 text-[9px] text-amber-600 dark:text-amber-400" title={`${formatCompact(year.bufferBorrowed)} below target`}>DIP</span>
                          )}
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={12} className="p-0">
                        <YearDetailPanel
                          year={year}
                          accounts={accounts}
                          people={people}
                          settingsState={settingsState}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScenarioComparison({
  state,
  currentRetirementYear,
  primaryPerson,
  secondPerson,
  isDark,
}: {
  state: import('../types').AppState;
  currentRetirementYear: number;
  primaryPerson: { id: string; name: string; currentAge: number; lifeExpectancy: number };
  secondPerson: { id: string; name: string; currentAge: number } | null;
  isDark: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [scenarios, setScenarios] = useState<number[]>([]);

  const currentYear = new Date().getFullYear();

  const addScenario = () => {
    // Suggest years: current ± 2, ± 5
    const suggestions = [
      currentRetirementYear - 3,
      currentRetirementYear + 2,
      currentRetirementYear + 5,
    ].filter(y => y >= currentYear && !scenarios.includes(y) && y !== currentRetirementYear);
    const nextYear = suggestions[0] ?? currentRetirementYear + 1;
    if (scenarios.length < 3 && !scenarios.includes(nextYear)) {
      setScenarios([...scenarios, nextYear]);
    }
  };

  const removeScenario = (year: number) => {
    setScenarios(scenarios.filter(y => y !== year));
  };

  const updateScenario = (index: number, year: number) => {
    const updated = [...scenarios];
    updated[index] = year;
    setScenarios(updated);
  };

  // Run simulations for each scenario
  const allYears = [currentRetirementYear, ...scenarios];
  const results = useMemo(() => {
    if (!expanded) return [];
    return allYears.map(retYear => {
      const modifiedState = {
        ...state,
        settings: { ...state.settings, retirementYear: retYear },
      };
      return {
        retirementYear: retYear,
        retirementAge: primaryPerson.currentAge + (retYear - currentYear),
        simulation: runSimulation(modifiedState),
      };
    });
  }, [expanded, state, allYears.join(',')]);

  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const axisTickFill = isDark ? '#9ca3af' : '#6b7280';
  const tooltipStyle = isDark
    ? { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' }
    : { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' };

  const lineColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <button
        onClick={() => { setExpanded(!expanded); if (!expanded && scenarios.length === 0) addScenario(); }}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <h3 className="text-lg font-medium dark:text-white">Scenario Comparison</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {expanded ? '▾ Hide' : '▸ Compare retirement years side by side'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-4 pb-4 dark:border-gray-700 space-y-4">
          {/* Scenario pickers */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: lineColors[0] }} />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {currentRetirementYear} (current)
              </span>
            </div>
            {scenarios.map((year, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: lineColors[i + 1] }} />
                <input
                  type="number"
                  value={year}
                  onChange={(e) => updateScenario(i, parseInt(e.target.value) || currentYear)}
                  min={currentYear}
                  max={currentYear + 40}
                  className="w-20 rounded border border-gray-300 px-2 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={() => removeScenario(year)}
                  className="text-xs text-red-500 hover:text-red-700 dark:text-red-400"
                >
                  x
                </button>
              </div>
            ))}
            {scenarios.length < 3 && (
              <button
                onClick={addScenario}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                + Add scenario
              </button>
            )}
          </div>

          {/* Comparison table */}
          {results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                    <th className="px-3 py-2 text-left font-medium dark:text-gray-300">Metric</th>
                    {results.map((r, i) => (
                      <th key={r.retirementYear} className="px-3 py-2 text-right font-medium dark:text-gray-300">
                        <span style={{ color: lineColors[i] }}>
                          {r.retirementYear} (age {r.retirementAge})
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-xs">
                  <tr className="border-b dark:border-gray-700">
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">Portfolio at Retirement</td>
                    {results.map(r => {
                      const retYears = r.simulation.years.filter(y => y.phase === 'accumulation');
                      const portfolio = retYears.length > 0 ? retYears[retYears.length - 1].totalPortfolioValue : r.simulation.years[0]?.totalPortfolioValue ?? 0;
                      return <td key={r.retirementYear} className="px-3 py-1.5 text-right font-mono dark:text-gray-300">{formatCurrency(portfolio)}</td>;
                    })}
                  </tr>
                  <tr className="border-b dark:border-gray-700">
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">End Portfolio</td>
                    {results.map(r => {
                      const end = r.simulation.years.length > 0 ? r.simulation.years[r.simulation.years.length - 1].totalPortfolioValue : 0;
                      return <td key={r.retirementYear} className={`px-3 py-1.5 text-right font-mono ${end <= 0 ? 'text-red-600 dark:text-red-400' : 'dark:text-gray-300'}`}>{formatCurrency(end)}</td>;
                    })}
                  </tr>
                  <tr className="border-b dark:border-gray-700">
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">Survives?</td>
                    {results.map(r => (
                      <td key={r.retirementYear} className={`px-3 py-1.5 text-right font-medium ${r.simulation.successfulRetirement ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {r.simulation.successfulRetirement ? 'Yes' : `No (age ${r.simulation.portfolioDepletionAge})`}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b dark:border-gray-700">
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">Total Taxes Paid</td>
                    {results.map(r => (
                      <td key={r.retirementYear} className="px-3 py-1.5 text-right font-mono dark:text-gray-300">{formatCurrency(r.simulation.totalTaxesPaid)}</td>
                    ))}
                  </tr>
                  <tr className="border-b dark:border-gray-700">
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">Total SS Income</td>
                    {results.map(r => (
                      <td key={r.retirementYear} className="px-3 py-1.5 text-right font-mono dark:text-gray-300">{formatCurrency(r.simulation.totalRetirementSSIncome)}</td>
                    ))}
                  </tr>
                  <tr className="border-b dark:border-gray-700">
                    <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">Total Withdrawals</td>
                    {results.map(r => (
                      <td key={r.retirementYear} className="px-3 py-1.5 text-right font-mono dark:text-gray-300">{formatCurrency(r.simulation.totalRetirementWithdrawals)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Portfolio comparison chart */}
          {results.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Portfolio Over Time</h4>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="age"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    interval={4}
                    tick={{ fill: axisTickFill, fontSize: 11 }}
                    allowDuplicatedCategory={false}
                  />
                  <YAxis tickFormatter={formatCompact} tick={{ fill: axisTickFill }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    contentStyle={tooltipStyle}
                    labelFormatter={(age) => `Age ${age}`}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={isDark ? { color: '#e5e7eb' } : undefined} />
                  {results.map((r, i) => {
                    const data = r.simulation.years.map(y => ({
                      age: y.ages[primaryPerson.id],
                      value: Math.round(y.totalPortfolioValue),
                    }));
                    return (
                      <Line
                        key={r.retirementYear}
                        data={data}
                        type="monotone"
                        dataKey="value"
                        stroke={lineColors[i]}
                        strokeWidth={2}
                        dot={false}
                        name={`Retire ${r.retirementYear} (age ${r.retirementAge})`}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sublabel,
  variant,
}: {
  label: string;
  value: string;
  sublabel?: string;
  variant?: 'blue' | 'red';
}) {
  const base = 'rounded-lg border p-4 shadow-sm';
  const colorClass =
    variant === 'blue'
      ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
      : variant === 'red'
        ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800';

  return (
    <div className={`${base} ${colorClass}`}>
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold dark:text-white">{value}</p>
      {sublabel && <p className="text-xs text-gray-500 dark:text-gray-400">{sublabel}</p>}
    </div>
  );
}
