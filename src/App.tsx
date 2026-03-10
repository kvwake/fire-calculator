import { useState, useEffect, createContext, useContext } from 'react';
import PeopleSetup from './components/PeopleSetup';
import AccountsSetup from './components/AccountsSetup';
import SocialSecuritySetup from './components/SocialSecuritySetup';
import PensionSetup from './components/PensionSetup';
import SpendingSetup from './components/SpendingSetup';
import SettingsPanel from './components/SettingsPanel';
import Results from './components/Results';
import Methodology from './components/Methodology';
import ErrorBoundary from './components/ErrorBoundary';

const tabs = [
  { id: 'people', label: 'People' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'social-security', label: 'Income' },
  { id: 'spending', label: 'Spending' },
  { id: 'settings', label: 'Settings' },
  { id: 'results', label: 'Results' },
  { id: 'methodology', label: 'Methodology' },
] as const;

type TabId = (typeof tabs)[number]['id'];

const DarkModeContext = createContext(false);
export const useDark = () => useContext(DarkModeContext);

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('people');
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('fire-calc-dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('fire-calc-dark', String(dark));
  }, [dark]);

  return (
    <DarkModeContext.Provider value={dark}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white shadow-xs dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">FIRE Calculator</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Financial Independence, Retire Early - Comprehensive Retirement Planner
              </p>
            </div>
            <button
              onClick={() => setDark(!dark)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              aria-label="Toggle dark mode"
            >
              {dark ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex gap-0 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className="mx-auto max-w-7xl px-4 py-6">
          {activeTab === 'people' && <PeopleSetup />}
          {activeTab === 'accounts' && <AccountsSetup />}
          {activeTab === 'social-security' && (
            <div className="space-y-8">
              <SocialSecuritySetup />
              <PensionSetup />
            </div>
          )}
          {activeTab === 'spending' && <SpendingSetup />}
          {activeTab === 'settings' && <SettingsPanel />}
          {activeTab === 'results' && <ErrorBoundary><Results /></ErrorBoundary>}
          {activeTab === 'methodology' && <Methodology />}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          <p>
            FIRE Calculator - All calculations are estimates. Consult a financial advisor for
            personalized advice.
          </p>
          <p className="mt-1">All data stored locally in your browser. Nothing is sent to any server.</p>
        </footer>
      </div>
    </DarkModeContext.Provider>
  );
}
