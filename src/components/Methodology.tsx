import Term from './Term';

export default function Methodology() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold dark:text-white">How This Simulation Works</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          A comprehensive guide to the calculations, assumptions, and strategies behind the FIRE Calculator.
        </p>
      </div>

      <Section title="All amounts are in today's dollars">
        <p>
          Investment returns are adjusted for inflation, so $100,000 shown in year 2050 has the same
          purchasing power as $100,000 today. Each account's nominal return has the inflation rate
          subtracted to produce a "real" return. For example, 10% nominal growth minus 3% inflation =
          7% real growth. This makes it easier to understand what the numbers actually mean for your lifestyle.
        </p>
      </Section>

      <Section title="How money flows">
        <p>
          Your cash account is your "spending account." Each year, the simulation withdraws money from
          your investment accounts into cash, and spending comes out of cash. The goal is to keep your
          cash balance at a comfortable buffer (your chosen years of expenses) so you're never forced
          to sell investments at a bad time.
        </p>
        <p className="mt-2">
          The <Term t="cash buffer">cash buffer</Term> acts as a shock absorber for sequence-of-returns
          risk. If the market drops, spending is funded from cash rather than selling at a loss.
          The buffer can dip below its target to absorb bad years, but if it falls below the
          floor minimum, <Term t="austerity mode">austerity mode</Term> can kick in (if enabled).
        </p>
        <p className="mt-2">
          <strong>Austerity mode:</strong> When cash drops below the floor, spending is automatically
          reduced by a configurable percentage (e.g., 25%). This simulates tightening the belt during
          bad market periods. Spending returns to normal once cash recovers to the buffer target.
          This hysteresis (enter at floor, exit at buffer) prevents rapid oscillation and models
          realistic behavioral adaptation. Austerity can dramatically improve Monte Carlo success
          rates by reducing portfolio drawdown during the worst sequences.
        </p>
      </Section>

      <Section title="Withdrawal order (designed to minimize taxes)">
        <p className="mb-2">
          The simulation follows an optimized withdrawal sequence to minimize lifetime taxes:
        </p>
        <ol className="list-decimal ml-5 space-y-2">
          <li>
            <strong>Required withdrawals first</strong> — <Term t="rmd">RMDs</Term> and{' '}
            <Term t="sepp">SEPP/72(t)</Term> payments are legally mandatory and must be taken regardless.
          </li>
          <li>
            <strong>Traditional accounts (low brackets)</strong> — Fill the lowest{' '}
            <Term t="tax bracket">tax brackets</Term> (10% and 12%) with traditional account withdrawals,
            since this money will be taxed as regular income whenever you take it.
          </li>
          <li>
            <strong>Taxable brokerage</strong> — Investment profits here are taxed at the lower{' '}
            <Term t="capital gains">capital gains rates</Term> (0-20%), and the portion that was your
            original investment (<Term t="cost basis">cost basis</Term>) comes back tax-free.
          </li>
          <li>
            <strong><Term t="hsa">HSA</Term></strong> — Tax-free for medical expenses; taxed as
            regular income after 65 for other uses.
          </li>
          <li>
            <strong><Term t="roth">Roth</Term> (last)</strong> — Completely tax-free. Preserved as long as
            possible because every dollar here grows and comes out tax-free forever.
          </li>
        </ol>
      </Section>

      <Section title="Tax optimization strategies">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">
              <Term t="roth conversion">Roth Conversions</Term>
            </p>
            <p>
              In low-income years, money is moved from traditional to Roth accounts.
              You pay a small amount of tax now (at low rates) to avoid paying more tax later (at higher rates).
              This also reduces future <Term t="rmd">required minimum distributions</Term>.
              The strategy is configurable: you can fill up through the 12%, 22%, or 24% bracket.
              Conversions are automatically constrained by <Term t="irmaa">IRMAA</Term> look-ahead —
              if anyone in the household will be on Medicare within 2 years, conversions are capped
              to avoid triggering surcharges (unless the tax savings clearly exceed the IRMAA cost).
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">
              <Term t="capital gains harvesting">Capital Gains Harvesting</Term>
            </p>
            <p>
              When your income is low enough to qualify for the 0% capital gains rate,
              investments are "sold" and immediately "rebought." This resets your cost basis higher,
              meaning less tax when you actually sell later. No tax is paid and your portfolio doesn't change.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Early retirement access">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">
              <Term t="sepp">SEPP / 72(t) Payments</Term>
            </p>
            <p>
              Substantially Equal Periodic Payments allow access to traditional retirement accounts before
              age 59½ without the 10% early withdrawal <Term t="penalty">penalty</Term>. You must take
              fixed annual payments for at least 5 years or until 59½ (whichever is later). The simulation
              calculates SEPP payments using the IRS fixed amortization method with the current mid-term
              AFR and IRS life expectancy tables.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">
              Governmental 457(b)
            </p>
            <p>
              Unlike 401(k)/IRA accounts, governmental 457(b) plans have no early withdrawal penalty
              at any age after separation from service. The simulation treats these as penalty-free
              regardless of age.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Required Minimum Distributions (RMDs)">
        <p>
          Starting at age 73 (75 for those born after 1960, per the <Term t="secure act">SECURE 2.0 Act</Term>),
          the IRS requires minimum annual withdrawals from traditional retirement accounts. The amount is
          calculated by dividing the account balance by a life expectancy factor from IRS tables.
          RMDs are taxed as ordinary income and must be taken whether you need the money or not.
          Roth conversions can reduce future RMD obligations by moving money out of traditional accounts.
        </p>
      </Section>

      <Section title="Medicare & healthcare costs">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">
              <Term t="irmaa">IRMAA Surcharges</Term>
            </p>
            <p>
              If your income exceeds certain thresholds, Medicare charges an extra
              premium (surcharge) on top of the standard rate. IRMAA uses your income from 2 years ago, so
              large Roth conversions or withdrawals can trigger higher premiums two years later. The simulation
              tracks this and shows it as a line item. Thresholds: ~$103k (single) or ~$206k (married).
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">
              <Term t="aca subsidy">ACA Subsidies</Term> (pre-65)
            </p>
            <p>
              Early retirees under 65 typically buy health insurance through the ACA marketplace.
              The government subsidizes premiums based on income. If your income
              exceeds 400% of the Federal Poverty Level, you may lose all subsidies — the{' '}
              <Term t="aca cliff">ACA cliff</Term>. The simulation can constrain withdrawals to stay
              below this threshold when possible, flagged as "ACA optimized" in the results.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">
              <Term t="hsa">HSA Strategy</Term>
            </p>
            <p>
              When enabled, the simulation continues HSA contributions during early retirement (before 65).
              HSA contributions reduce your <Term t="magi">MAGI</Term>, helping preserve ACA subsidies
              and lowering taxes. The money grows tax-free and can be withdrawn tax-free for medical
              expenses at any age, or penalty-free for any purpose after 65.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Tax calculations">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">Federal Income Tax</p>
            <p>
              Uses current federal <Term t="tax bracket">tax brackets</Term> (10%, 12%, 22%, 24%, 32%, 35%, 37%).
              The <Term t="standard deduction">standard deduction</Term> is applied first (with extra deduction
              for age 65+). Brackets are assumed to grow with inflation and stay constant in real terms.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">Capital Gains Tax</p>
            <p>
              Long-term <Term t="capital gains">capital gains</Term> are taxed at preferential rates (0%, 15%, 20%)
              that "stack" on top of ordinary income. The simulation models this stacking correctly,
              so your ordinary income determines which capital gains bracket applies.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">
              <Term t="niit">Net Investment Income Tax (NIIT)</Term>
            </p>
            <p>
              An additional 3.8% tax on investment income when total income exceeds $200k (single) or
              $250k (married). Applies to capital gains, dividends, and other investment income.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">Social Security Taxation</p>
            <p>
              Up to 85% of Social Security benefits can be taxable depending on your total income.
              The simulation models the IRS provisional income formula to determine the taxable portion.
              Most states exempt Social Security from state income tax.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm mb-1">State Taxes</p>
            <p>
              All 50 states + DC are modeled with their specific brackets and rules.
              Some states have no income tax, some partially exempt Social Security or retirement income,
              and capital gains treatment varies. The simulation applies the correct state rules
              based on your selected state of residence.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Social Security">
        <p>
          Benefits are modeled based on your stated benefit at Full Retirement Age (FRA).
          Claiming early (age 62) reduces benefits by up to ~30%. Delaying past FRA (up to age 70)
          increases benefits by ~8% per year. The simulation applies the correct SSA adjustment
          percentages and adds benefits as taxable income starting at your claiming age.
        </p>
      </Section>

      <Section title="Investment returns & inflation">
        <p>
          Each account has its own expected nominal return rate. The simulation subtracts the inflation
          rate to compute a "real" return, keeping everything in today's purchasing power.
          For example, with 10% nominal return and 3% inflation, the account grows at 7% real.
        </p>
        <p className="mt-2">
          <strong>Default rates:</strong> Investment accounts default to 10% nominal (the S&P 500
          historical average including dividends). Cash/bond accounts default to 4.5%.
          These are nominal rates — inflation is subtracted automatically.
        </p>
        <p className="mt-2">
          <strong>Monte Carlo simulation</strong> generates separate equity and bond return streams
          with realistic correlation (~−0.2). Equity returns use historical S&P 500 statistics
          (mean ~7% real, ~17% standard deviation). Bond returns use aggregate bond statistics
          (mean ~2% real, ~6% standard deviation). Each account's return is blended between
          the two streams based on its configured expected return — high-return accounts get
          more equity exposure, low-return accounts get more bond exposure. Cash accounts
          keep their fixed configured return.
        </p>
        <p className="mt-2">
          <strong>Historical backtesting</strong> uses every rolling period from actual S&P 500 and
          US government bond data (1871-present) to show how your plan would have performed in
          every historical market environment, including the Great Depression, stagflation,
          dot-com bust, and 2008 crisis. Both equity and bond returns are historically accurate.
        </p>
      </Section>

      <Section title="Dividend income tracking">
        <p>
          Taxable brokerage accounts generate dividend income that is taxable each year even without
          selling any shares. This "phantom income" counts toward your <Term t="magi">MAGI</Term> and
          can push you over the <Term t="aca cliff">ACA cliff</Term> or trigger{' '}
          <Term t="irmaa">IRMAA surcharges</Term> — even if you don't need the money. The simulation
          tracks dividends based on each taxable account's configured dividend yield, includes them
          in all MAGI calculations, and factors them into ACA-constrained withdrawal optimization.
        </p>
        <p className="mt-2">
          <strong>Mitigation:</strong> Hold dividend-heavy investments (value funds, bond funds, REITs)
          in tax-advantaged accounts (traditional, Roth, HSA). Use low-dividend growth funds or
          tax-managed funds in taxable accounts to minimize phantom MAGI.
        </p>
      </Section>

      <Section title="Asset allocation glide path">
        <p>
          When enabled, the simulation automatically adjusts the equity/bond allocation of your
          portfolio over the course of retirement. You configure "safe years" — how many years of
          expenses should be held in bonds and cash — at the start and end of retirement. The
          allocation interpolates linearly between these targets.
        </p>
        <p className="mt-2">
          <strong>Why a rising equity glide path?</strong> Research by Kitces and Pfau shows that
          starting retirement with a more conservative allocation (more bonds) and gradually
          increasing equity exposure actually improves success rates. This is because:
        </p>
        <ul className="list-disc ml-5 mt-1 space-y-1">
          <li>Early retirement is when sequence-of-returns risk is highest — a crash in years 1-5 can be devastating</li>
          <li>More bonds early on protects against this critical window</li>
          <li>Portfolios that survive the early years benefit from higher equity growth later</li>
          <li>This creates a natural "rising equity glide path" that outperforms static allocations</li>
        </ul>
        <p className="mt-2">
          The glide path only affects Monte Carlo and historical backtesting modes, where market
          returns are variable. In deterministic mode, accounts use their configured expected returns.
        </p>
      </Section>

      <Section title="Withdrawal rate guardrails">
        <p>
          Optional guardrails control how much of your portfolio is withdrawn each year:
        </p>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>
            <strong>Soft limit (warning):</strong> Flags years where your withdrawal rate exceeds
            a threshold (e.g., 4%), but doesn't restrict spending.
          </li>
          <li>
            <strong>Hard limit (cap):</strong> Actually limits withdrawals to a percentage of
            your portfolio. Any unmet spending appears as a deficit.
          </li>
        </ul>
      </Section>

      <Section title="Budget builder">
        <p>
          The optional budget builder lets you create a detailed monthly budget with per-item
          control. Items can have custom age ranges (e.g., a car payment from 55-60), one-time
          expenses (e.g., a new roof), custom inflation rates (e.g., healthcare at 5.5%), and
          pre-tax flags for HSA-eligible medical expenses. The budget total can be applied to
          spending phases to set the annual amount.
        </p>
      </Section>

      <Section title="Reading the results">
        <p>
          Click any row in the year-by-year breakdown to see a detailed view of that year's
          cash flows. Click "Why these actions?" to see a plain-language explanation of every
          decision the simulation made — why money was pulled from specific accounts, why
          conversions were or weren't done, and the tax implications of each choice.
        </p>
        <p className="mt-2">
          <strong>Badges in the results:</strong>
        </p>
        <ul className="list-disc ml-5 mt-1 space-y-1">
          <li><Badge color="amber">SEPP</Badge> — Account is making SEPP/72(t) payments for penalty-free early access</li>
          <li><Badge color="purple">RMD</Badge> — Required minimum distribution taken from this account</li>
          <li><Badge color="indigo">→ Roth</Badge> — Money converted from traditional to Roth for tax optimization</li>
          <li><Badge color="green">ACA optimized</Badge> — Withdrawals constrained to preserve ACA subsidy eligibility</li>
          <li><Badge color="red">DEFICIT</Badge> — Cash fully exhausted; spending could not be fully funded</li>
          <li><Badge color="amber">DIP</Badge> — Cash buffer dipped below target but above floor</li>
          <li><Badge color="red">LOW</Badge> — Cash dropped below the floor minimum</li>
          <li><Badge color="orange">LEAN</Badge> — Austerity mode active; spending reduced to protect the portfolio</li>
        </ul>
      </Section>

      <Section title="Assumptions & limitations">
        <ul className="list-disc ml-5 space-y-1">
          <li>Tax brackets are assumed to grow with inflation (constant in real terms).</li>
          <li>No modeling of market crashes in deterministic mode — use Monte Carlo for stress testing.</li>
          <li>No state-level capital gains exclusions beyond what's modeled in the state tax data.</li>
          <li>Social Security benefit amounts are assumed constant in real terms (COLA matches inflation).</li>
          <li>No modeling of part-time work, rental income, or other non-portfolio income sources.</li>
          <li>HSA medical expense tracking is simplified — assumes qualifying expenses are available.</li>
          <li>Estate tax and inheritance planning are not modeled.</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h3>
      <div className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {children}
      </div>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  };
  return (
    <span className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${colors[color] ?? ''}`}>
      {children}
    </span>
  );
}
