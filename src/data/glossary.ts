// Plain-language definitions of financial terms for non-expert users.
// Used by the <Term> tooltip component throughout the UI.

export const GLOSSARY: Record<string, string> = {
  'traditional 401(k)':
    'A retirement account where contributions are tax-deductible now, but withdrawals in retirement are taxed as regular income. Your employer may offer matching contributions.',
  'traditional ira':
    'Similar to a 401(k) but opened independently. Contributions may be tax-deductible. Withdrawals in retirement are taxed as regular income.',
  'roth':
    'A retirement account where you pay taxes on contributions now, but all withdrawals in retirement are completely tax-free — including the growth. No required withdrawals at any age.',
  'taxable brokerage':
    'A regular investment account with no special tax benefits. You can withdraw anytime without penalty, but you pay taxes on investment gains when you sell.',
  'hsa':
    'Health Savings Account — triple tax advantage: contributions are tax-deductible, growth is tax-free, and withdrawals for medical expenses are tax-free. After age 65, can be used like a traditional IRA for non-medical expenses.',
  'cash':
    'Cash, savings accounts, CDs, money market funds, or short-term bonds. Low risk, low return. In this plan, cash acts as your spending account — other accounts feed into it.',
  'cost basis':
    'The original amount you paid for an investment. When you sell, you only pay taxes on the gain (sale price minus cost basis), not the full amount.',
  'capital gains':
    'The profit from selling an investment for more than you paid. Long-term gains (held over 1 year) are taxed at lower rates (0%, 15%, or 20%) than regular income.',
  'standard deduction':
    'An amount of income that is automatically tax-free. For 2025: $15,000 for single filers, $30,000 for married filing jointly. This means your first dollars of income are not taxed.',
  'tax bracket':
    'The tax system is progressive — different portions of your income are taxed at different rates. Only the income within each bracket is taxed at that rate, not your entire income.',
  'marginal rate':
    'The tax rate on your next dollar of income. If you\'re "in the 22% bracket," only income above the 12% bracket threshold is taxed at 22% — not all your income.',
  'effective rate':
    'Your actual overall tax rate — total taxes divided by total income. Always lower than your marginal rate because lower brackets are taxed at lower rates first.',
  'sepp':
    'Substantially Equal Periodic Payments (IRS Rule 72(t)) — a way to withdraw from retirement accounts before age 59½ without the usual 10% early withdrawal penalty. You must take fixed payments for at least 5 years or until 59½ (whichever is later). Changing the amount triggers penalties on all past withdrawals.',
  'rmd':
    'Required Minimum Distributions — starting at age 73 (75 for those born after 1960), the IRS requires you to withdraw a minimum amount from traditional retirement accounts each year, whether you need the money or not. Taxed as regular income.',
  'niit':
    'Net Investment Income Tax — an extra 3.8% tax on investment income (capital gains, dividends, etc.) that applies when your total income exceeds $200,000 (single) or $250,000 (married). Also known as the Medicare surtax.',
  'roth conversion':
    'Moving money from a traditional 401(k)/IRA to a Roth account. You pay income tax on the converted amount now, but the money then grows and can be withdrawn tax-free forever. Most beneficial when done in low-income years at lower tax rates.',
  'capital gains harvesting':
    'A tax strategy: in years when your income is low enough to qualify for the 0% capital gains rate, you sell investments at a profit and immediately rebuy them. You pay $0 in tax, but your "cost basis" resets higher — meaning less tax when you actually sell later.',
  'filing status':
    'How you file your tax return. "Married filing jointly" gives larger tax brackets and a bigger standard deduction than "single," resulting in lower taxes at the same income level.',
  'inflation rate':
    'How much prices rise each year. If inflation is 3%, something that costs $100 today will cost $103 next year. This calculator adjusts for inflation so all amounts are shown in today\'s purchasing power.',
  'real return':
    'Investment return after subtracting inflation. If your investments grow 7% and inflation is 3%, your real return is 4%. This is what actually increases your purchasing power.',
  'cash buffer':
    'A safety cushion of readily available money. Keeping 1-2 years of expenses in cash means you won\'t be forced to sell investments during a market downturn to pay bills.',
  'penalty':
    'A 10% extra tax the IRS charges when you withdraw from traditional retirement accounts before age 59½, on top of regular income tax. Can be avoided through SEPP/72(t) or certain exceptions.',
  'secure act':
    'The SECURE 2.0 Act (2022) changed the age for required minimum distributions from 72 to 73, and to 75 for those born after 1960. This gives your retirement accounts more time to grow tax-deferred.',
  'irmaa':
    'Income-Related Monthly Adjustment Amount — an extra Medicare premium charged to higher-income retirees (age 65+). Based on your income from 2 years ago. If your MAGI exceeded ~$103k (single) or ~$206k (married), you pay $900–$6,400+ extra per year per person on top of the standard Medicare premium.',
  'aca subsidy':
    'The Affordable Care Act provides premium tax credits to reduce health insurance costs for people buying coverage on the marketplace. For early retirees (pre-65), keeping income low enough can save thousands per year in premiums. Going over 400% of the Federal Poverty Level may cause you to lose all subsidies — the "ACA cliff."',
  'aca cliff':
    'The income threshold (400% of Federal Poverty Level) above which you lose ALL Affordable Care Act premium subsidies. For a single person, roughly ~$62k; for a couple, ~$85k. Going even $1 over means paying the full unsubsidized premium — potentially $10,000–$15,000+ more per year.',
  'magi':
    'Modified Adjusted Gross Income — your total income including wages, retirement withdrawals, capital gains, and Social Security. Used to determine eligibility for tax benefits like ACA subsidies and IRMAA surcharges. Roth withdrawals are NOT included in MAGI.',
  'austerity mode':
    'A dynamic spending strategy for lean times. When your cash reserve drops below the floor minimum, spending is automatically reduced by a configurable percentage (e.g., 25%). Spending returns to normal once cash recovers to the buffer target. This helps your portfolio survive bad market sequences without total depletion.',
};

// Lookup that handles case-insensitive matching and common variations
export function lookupTerm(term: string): string | undefined {
  const key = term.toLowerCase().trim();
  if (GLOSSARY[key]) return GLOSSARY[key];

  // Try common variations
  const variations: Record<string, string> = {
    '401k': 'traditional 401(k)',
    '401(k)': 'traditional 401(k)',
    'traditional': 'traditional 401(k)',
    'ira': 'traditional ira',
    'roth ira': 'roth',
    'roth 401k': 'roth',
    'roth 401(k)': 'roth',
    'brokerage': 'taxable brokerage',
    'taxable': 'taxable brokerage',
    'ltcg': 'capital gains',
    'long-term capital gains': 'capital gains',
    'cap gains': 'capital gains',
    'deduction': 'standard deduction',
    'bracket': 'tax bracket',
    'brackets': 'tax bracket',
    'marginal tax rate': 'marginal rate',
    '72(t)': 'sepp',
    '72t': 'sepp',
    'sepp/72(t)': 'sepp',
    'required minimum distribution': 'rmd',
    'required minimum distributions': 'rmd',
    'medicare surtax': 'niit',
    'net investment income tax': 'niit',
    'conversion': 'roth conversion',
    'harvesting': 'capital gains harvesting',
    'gains harvesting': 'capital gains harvesting',
    'inflation': 'inflation rate',
    'cash reserve': 'cash buffer',
    'austerity': 'austerity mode',
    'lean': 'austerity mode',
    'lean mode': 'austerity mode',
    'buffer': 'cash buffer',
    'early withdrawal penalty': 'penalty',
    'secure 2.0': 'secure act',
    'medicare surcharge': 'irmaa',
    'medicare premium': 'irmaa',
    'income-related monthly adjustment': 'irmaa',
    'aca': 'aca subsidy',
    'affordable care act': 'aca subsidy',
    'marketplace subsidy': 'aca subsidy',
    'premium tax credit': 'aca subsidy',
    'subsidy cliff': 'aca cliff',
    '400% fpl': 'aca cliff',
    'federal poverty level': 'aca cliff',
    'modified adjusted gross income': 'magi',
  };

  const mapped = variations[key];
  if (mapped && GLOSSARY[mapped]) return GLOSSARY[mapped];

  return undefined;
}
