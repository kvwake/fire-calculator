import { useAppState } from '../context/AppContext';
import { Account, AccountType, ACCOUNT_TYPE_LABELS } from '../types';

const emptyAccount = (ownerId: string): Account => ({
  id: crypto.randomUUID(),
  name: '',
  type: 'traditional',
  owner: ownerId,
  balance: 0,
  annualContribution: 0,
  expectedReturn: 7,
  costBasis: 0,
  seppEnabled: false,
});

const accountTypes: AccountType[] = ['traditional', 'roth', 'taxable', 'hsa', 'generic'];

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
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-gray-500">Add people first before creating accounts.</p>
      </div>
    );
  }

  const addAccount = () => {
    const account = emptyAccount(state.people[0].id);
    account.name = `Account ${state.accounts.length + 1}`;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Accounts</h2>
          <p className="text-sm text-gray-500">
            Total: {formatCurrency(totalBalance)} | Annual Contributions: {formatCurrency(totalContributions)}
          </p>
        </div>
        <button
          onClick={addAccount}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Account
        </button>
      </div>

      {state.accounts.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">No accounts yet. Add your investment accounts to get started.</p>
        </div>
      )}

      <div className="space-y-4">
        {state.accounts.map((account) => (
          <div key={account.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium">{account.name || 'Unnamed Account'}</h3>
              <button
                onClick={() => removeAccount(account.id)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Account Name</label>
                <input
                  type="text"
                  value={account.name}
                  onChange={(e) => updateAccount({ ...account, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Account Type</label>
                <select
                  value={account.type}
                  onChange={(e) =>
                    updateAccount({ ...account, type: e.target.value as AccountType })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {accountTypes.map((type) => (
                    <option key={type} value={type}>
                      {ACCOUNT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Owner</label>
                <select
                  value={account.owner}
                  onChange={(e) => updateAccount({ ...account, owner: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {state.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Current Balance ($)</label>
                <input
                  type="number"
                  min={0}
                  value={account.balance}
                  onChange={(e) =>
                    updateAccount({ ...account, balance: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Annual Contribution ($)
                </label>
                <input
                  type="number"
                  min={0}
                  value={account.annualContribution}
                  onChange={(e) =>
                    updateAccount({
                      ...account,
                      annualContribution: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Expected Return (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.1}
                  value={account.expectedReturn}
                  onChange={(e) =>
                    updateAccount({
                      ...account,
                      expectedReturn: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {account.type === 'taxable' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Cost Basis ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={account.costBasis}
                    onChange={(e) =>
                      updateAccount({
                        ...account,
                        costBasis: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
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
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor={`sepp-${account.id}`} className="text-sm text-gray-700">
                    Enable SEPP/72(t) for early access
                  </label>
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-gray-400">
              Owner: {getPersonName(account.owner)} | Type: {ACCOUNT_TYPE_LABELS[account.type]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
