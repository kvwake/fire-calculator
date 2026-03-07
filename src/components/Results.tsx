import { useMemo } from 'react';
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
} from 'recharts';
import { useAppState } from '../context/AppContext';
import { runSimulation } from '../engine/simulation';
import { ACCOUNT_TYPE_LABELS } from '../types';

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

export default function Results() {
  const { state } = useAppState();

  const simulation = useMemo(() => runSimulation(state), [state]);

  if (state.people.length === 0 || state.accounts.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-gray-500">
          Add at least one person and one account to see results.
        </p>
      </div>
    );
  }

  const primaryPerson = state.people[0];
  const retirementYears = simulation.years.filter((y) => y.phase === 'retirement');
  const accumulationYears = simulation.years.filter((y) => y.phase === 'accumulation');

  // Portfolio chart data
  const portfolioData = simulation.years.map((y) => ({
    age: y.ages[primaryPerson.id],
    portfolio: Math.round(y.totalPortfolioValue),
    ...Object.fromEntries(
      state.accounts.map((a) => [a.name, Math.round(y.accountBalances[a.id] || 0)])
    ),
  }));

  // Income/spending chart data for retirement years
  const incomeData = retirementYears.map((y) => {
    const ssTotal = Object.values(y.ssIncome).reduce((s, v) => s + v, 0);
    return {
      age: y.ages[primaryPerson.id],
      'Social Security': Math.round(ssTotal),
      Withdrawals: Math.round(y.totalIncome - ssTotal),
      Taxes: Math.round(-y.totalTax),
      Spending: Math.round(y.totalSpending),
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

  const accountColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#ec4899',
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Simulation Results</h2>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Portfolio at Retirement"
          value={formatCurrency(retirementPortfolio)}
          sublabel={`Age ${primaryPerson.retirementAge}`}
        />
        <SummaryCard
          label="Peak Portfolio"
          value={formatCurrency(peakPortfolio)}
        />
        <SummaryCard
          label="End Portfolio"
          value={formatCurrency(endPortfolio)}
          sublabel={`Age ${primaryPerson.lifeExpectancy}`}
          className={endPortfolio <= 0 ? 'border-red-300 bg-red-50' : ''}
        />
        <SummaryCard
          label="Total Taxes Paid"
          value={formatCurrency(simulation.totalTaxesPaid)}
          sublabel="In retirement"
        />
      </div>

      {/* Success/Failure indicator */}
      {simulation.successfulRetirement ? (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="font-medium text-green-800">
            Your portfolio survives through age {primaryPerson.lifeExpectancy}.
          </p>
          <p className="text-sm text-green-700">
            Ending balance: {formatCurrency(endPortfolio)}
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="font-medium text-red-800">
            Portfolio depleted at age {simulation.portfolioDepletionAge}.
          </p>
          <p className="text-sm text-red-700">
            Consider reducing spending, working longer, or increasing savings.
          </p>
        </div>
      )}

      {/* Portfolio Growth Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium">Portfolio Over Time</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={portfolioData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="age" label={{ value: 'Age', position: 'bottom' }} />
            <YAxis tickFormatter={formatCompact} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Age ${label}`}
            />
            <Legend />
            {state.accounts.map((account, i) => (
              <Area
                key={account.id}
                type="monotone"
                dataKey={account.name}
                stackId="1"
                stroke={accountColors[i % accountColors.length]}
                fill={accountColors[i % accountColors.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Income/Tax/Spending Chart */}
      {retirementYears.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-medium">Retirement Income & Spending</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={incomeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="age" label={{ value: 'Age', position: 'bottom' }} />
              <YAxis tickFormatter={formatCompact} />
              <Tooltip
                formatter={(value: number) => formatCurrency(Math.abs(value))}
                labelFormatter={(label) => `Age ${label}`}
              />
              <Legend />
              <Bar dataKey="Social Security" stackId="income" fill="#10b981" />
              <Bar dataKey="Withdrawals" stackId="income" fill="#3b82f6" />
              <Bar dataKey="Taxes" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Year-by-Year Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <h3 className="border-b border-gray-200 p-4 text-lg font-medium">
          Year-by-Year Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-2 font-medium">Age</th>
                <th className="px-3 py-2 font-medium">Phase</th>
                <th className="px-3 py-2 font-medium text-right">Portfolio</th>
                <th className="px-3 py-2 font-medium text-right">SS Income</th>
                <th className="px-3 py-2 font-medium text-right">Withdrawals</th>
                <th className="px-3 py-2 font-medium text-right">Taxes</th>
                <th className="px-3 py-2 font-medium text-right">Spending</th>
                <th className="px-3 py-2 font-medium text-right">Deficit</th>
              </tr>
            </thead>
            <tbody>
              {simulation.years.map((year, i) => {
                const ssTotal = Object.values(year.ssIncome).reduce((s, v) => s + v, 0);
                const withdrawalTotal = Object.values(year.withdrawals).reduce(
                  (s, v) => s + v,
                  0
                );
                const ageStr = Object.entries(year.ages)
                  .map(([id, age]) => {
                    const person = state.people.find((p) => p.id === id);
                    return person ? `${person.name}: ${age}` : `${age}`;
                  })
                  .join(' / ');

                return (
                  <tr
                    key={i}
                    className={`border-b ${
                      year.phase === 'retirement' ? '' : 'bg-gray-50/50'
                    } ${year.deficit > 0 ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-3 py-1.5 text-xs">{ageStr}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                          year.phase === 'retirement'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {year.phase === 'retirement' ? 'Retired' : 'Working'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">
                      {formatCompact(year.totalPortfolioValue)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">
                      {ssTotal > 0 ? formatCompact(ssTotal) : '-'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">
                      {withdrawalTotal > 0 ? formatCompact(withdrawalTotal) : '-'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-red-600">
                      {year.totalTax > 0 ? formatCompact(year.totalTax) : '-'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs">
                      {year.totalSpending > 0 ? formatCompact(year.totalSpending) : '-'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-red-600">
                      {year.deficit > 0 ? formatCompact(year.deficit) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Details at Key Ages */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium">Account Balances at Key Ages</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-2 font-medium">Age</th>
                {state.accounts.map((a) => (
                  <th key={a.id} className="px-3 py-2 font-medium text-right">
                    {a.name}
                    <br />
                    <span className="text-xs font-normal text-gray-500">
                      {ACCOUNT_TYPE_LABELS[a.type]}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                primaryPerson.retirementAge,
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
                    <tr key={targetAge} className="border-b">
                      <td className="px-3 py-1.5 font-medium">{targetAge}</td>
                      {state.accounts.map((a) => (
                        <td key={a.id} className="px-3 py-1.5 text-right font-mono text-xs">
                          {formatCompact(yearData.accountBalances[a.id] || 0)}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-mono text-xs font-medium">
                        {formatCompact(yearData.totalPortfolioValue)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sublabel,
  className = '',
}: {
  label: string;
  value: string;
  sublabel?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
    </div>
  );
}
