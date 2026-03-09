import { useAppState } from '../context/AppContext';
import { Account, AccountType, ACCOUNT_TYPE_LABELS } from '../types';
import NumberInput from './NumberInput';

const accountTypes: AccountType[] = ['traditional', 'roth', 'taxable', 'hsa', 'cash', '457b', 'generic'];

function getDefaultReturn(type: AccountType): number {
  return type === 'cash' ? 4.5 : 10;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val);
}

export default function AccountsSetup() {
  const { state, dispatch } = useAppState();

  if (state.people.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
        <p className="text-gray-500 dark:text-gray-400">Add people first before creating accounts.</p>
      </div>
    );
  }

  const addAccount = () => {
    const account: Account = {
      id: crypto.randomUUID(),
      name: `Account ${state.accounts.length + 1}`,
      type: 'traditional',
      owner: state.people[0].id,
      balance: 0,
      annualContribution: 0,
      contributionEndAge: state.people[0].currentAge + (state.settings.retirementYear - new Date().getFullYear()),
      expectedReturn: 10,
      costBasis: 0,
      seppEnabled: false,
    };
    dispatch({ type: 'ADD_ACCOUNT', payload: account });
  };

  const updateAccount = (account: Account) => {
    dispatch({ type: 'UPDATE_ACCOUNT', payload: account });
  };

  const removeAccount = (id: string) => {
    dispatch({ type: 'REMOVE_ACCOUNT', payload: id });
  };

  const getPersonName = (id: string) =>
    state.people.find((p) => p.id === id)?.name ?? 'Unknown';

  const totalBalance = state.accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalContributions = state.accounts.reduce((sum, a) => sum + a.annualContribution, 0);

  const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold dark:text-white">Accounts</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total: {formatCurrency(totalBalance)} | Annual Contributions: {formatCurrency(totalContributions)}
          </p>
        </div>
        <button
          onClick={addAccount}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          + Add Account
        </button>
      </div>

      {state.accounts.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
          <p className="text-gray-500 dark:text-gray-400">No accounts yet. Add your investment accounts to get started.</p>
        </div>
      )}

      <div className="space-y-4">
        {state.accounts.map((account) => (
          <div key={account.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium dark:text-white">{account.name || 'Unnamed Account'}</h3>
              <button
                onClick={() => removeAccount(account.id)}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Name</label>
                <input
                  type="text"
                  value={account.name}
                  onChange={(e) => updateAccount({ ...account, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Type</label>
                <select
                  value={account.type}
                  onChange={(e) => {
                    const newType = e.target.value as AccountType;
                    const defaultReturn = newType === 'cash' ? 4.5 : 10;
                    updateAccount({
                      ...account,
                      type: newType,
                      expectedReturn: account.expectedReturn === getDefaultReturn(account.type)
                        ? defaultReturn
                        : account.expectedReturn,
                    });
                  }}
                  className={inputClass}
                >
                  {accountTypes.map((type) => (
                    <option key={type} value={type}>
                      {ACCOUNT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Owner</label>
                <select
                  value={account.owner}
                  onChange={(e) => updateAccount({ ...account, owner: e.target.value })}
                  className={inputClass}
                >
                  {state.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Balance ($)</label>
                <NumberInput
                  value={account.balance}
                  onChange={(v) => updateAccount({ ...account, balance: v })}
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Annual Contribution ($)
                </label>
                <NumberInput
                  value={account.annualContribution}
                  onChange={(v) => updateAccount({ ...account, annualContribution: v })}
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Stop Contributions (owner age)
                </label>
                <NumberInput
                  value={account.contributionEndAge}
                  onChange={(v) => updateAccount({ ...account, contributionEndAge: v })}
                  decimals={false}
                  min={18}
                  max={80}
                />
                {(() => {
                  const owner = state.people.find((p) => p.id === account.owner);
                  const retAge = owner
                    ? owner.currentAge + (state.settings.retirementYear - new Date().getFullYear())
                    : 0;
                  return (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Owner retires ~age {retAge} (year {state.settings.retirementYear})
                    </p>
                  );
                })()}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Expected Nominal Return (%)
                </label>
                <NumberInput
                  value={account.expectedReturn}
                  onChange={(v) => updateAccount({ ...account, expectedReturn: v })}
                  min={0}
                  max={20}
                  step={0.1}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {account.type === 'cash' ? (
                    <>HYSA 4–5% | Bonds 3–5% | Money market 4–5% | CDs 4–5%</>
                  ) : account.type === 'generic' ? (
                    <>Depends on asset mix. Bonds ~4%, balanced ~6%, equities ~7–10%</>
                  ) : (
                    <>S&P 500 historical avg ~10% nominal. Inflation is subtracted automatically.</>
                  )}
                </p>
                {account.type === 'cash' && account.expectedReturn > 6 && (
                  <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                    Cash-like accounts rarely exceed 5–6%. Are you sure?
                  </p>
                )}
              </div>

              {account.type === 'taxable' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cost Basis ($)
                  </label>
                  <NumberInput
                    value={account.costBasis}
                    onChange={(v) => updateAccount({ ...account, costBasis: v })}
                    min={0}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    What you originally invested (not including gains)
                  </p>
                </div>
              )}

              {account.type === 'traditional' && (
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id={`sepp-${account.id}`}
                    checked={account.seppEnabled}
                    onChange={(e) =>
                      updateAccount({ ...account, seppEnabled: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                  />
                  <label htmlFor={`sepp-${account.id}`} className="text-sm text-gray-700 dark:text-gray-300">
                    Enable SEPP/72(t) for early access
                  </label>
                </div>
              )}

              {account.type === '457b' && (
                <div className="pt-6">
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Governmental 457(b) plans have no early withdrawal penalty at any age
                    upon separation from service. Withdrawals are taxed as ordinary income.
                    RMDs apply at age 73/75.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              Owner: {getPersonName(account.owner)} | Type: {ACCOUNT_TYPE_LABELS[account.type]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
