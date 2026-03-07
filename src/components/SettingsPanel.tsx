import { useAppState } from '../context/AppContext';
import { getAllStates } from '../data/stateTax';
import { FilingStatus } from '../types';
import { useRef } from 'react';

const states = getAllStates();

export default function SettingsPanel() {
  const { state, dispatch, exportData, importData } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateSettings = (updates: Partial<typeof state.settings>) => {
    dispatch({
      type: 'SET_SETTINGS',
      payload: { ...state.settings, ...updates },
    });
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fire-calculator-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const success = importData(text);
      if (!success) {
        alert('Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Settings</h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">State of Residence</label>
          <select
            value={state.settings.state}
            onChange={(e) => updateSettings({ state: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {states.map((s) => (
              <option key={s.abbreviation} value={s.abbreviation}>
                {s.name} ({s.abbreviation})
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">Filing Status</label>
          <select
            value={state.settings.filingStatus}
            onChange={(e) =>
              updateSettings({ filingStatus: e.target.value as FilingStatus })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="single">Single</option>
            <option value="married">Married Filing Jointly</option>
          </select>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">Inflation Rate (%)</label>
          <input
            type="number"
            min={0}
            max={15}
            step={0.1}
            value={state.settings.inflationRate}
            onChange={(e) =>
              updateSettings({ inflationRate: parseFloat(e.target.value) || 3 })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Historical average: ~3%. Used to convert nominal returns to real returns.
          </p>
        </div>
      </div>

      {/* Export/Import */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Data Management</h3>
        <p className="text-sm text-gray-500">
          Your data is stored locally in your browser. Export it to save a backup, or import
          a previously saved file to continue where you left off.
        </p>

        <div className="flex gap-4">
          <button
            onClick={handleExport}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Export Data
          </button>

          <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            Import Data
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
