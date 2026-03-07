import { useState } from 'react';
import PeopleSetup from './components/PeopleSetup';
import AccountsSetup from './components/AccountsSetup';
import SocialSecuritySetup from './components/SocialSecuritySetup';
import SpendingSetup from './components/SpendingSetup';
import SettingsPanel from './components/SettingsPanel';
import Results from './components/Results';

const tabs = [
  { id: 'people', label: 'People' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'social-security', label: 'Social Security' },
  { id: 'spending', label: 'Spending' },
  { id: 'settings', label: 'Settings' },
  { id: 'results', label: 'Results' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('people');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">FIRE Calculator</h1>
          <p className="text-sm text-gray-500">
            Financial Independence, Retire Early - Comprehensive Retirement Planner
          </p>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
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
        {activeTab === 'social-security' && <SocialSecuritySetup />}
        {activeTab === 'spending' && <SpendingSetup />}
        {activeTab === 'settings' && <SettingsPanel />}
        {activeTab === 'results' && <Results />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500">
        <p>
          FIRE Calculator - All calculations are estimates. Consult a financial advisor for
          personalized advice.
        </p>
        <p className="mt-1">All data stored locally in your browser. Nothing is sent to any server.</p>
      </footer>
    </div>
  );
}
