import { useAppState } from '../context/AppContext';
import { Person } from '../types';
import NumberInput from './NumberInput';

const emptyPerson = (): Person => ({
  id: crypto.randomUUID(),
  name: '',
  currentAge: 30,
  lifeExpectancy: 95,
});

export default function PeopleSetup() {
  const { state, dispatch } = useAppState();

  const addPerson = () => {
    if (state.people.length >= 2) return;
    const person = emptyPerson();
    person.name = state.people.length === 0 ? 'Person 1' : 'Person 2';
    dispatch({ type: 'ADD_PERSON', payload: person });
    // Add default SS config
    dispatch({
      type: 'SET_SOCIAL_SECURITY',
      payload: [
        ...state.socialSecurity,
        {
          personId: person.id,
          enabled: true,
          monthlyBenefitAtFRA: 2000,
          claimingAge: 67,
        },
      ],
    });
    // Add default cash account on first person
    if (state.people.length === 0) {
      dispatch({
        type: 'ADD_ACCOUNT',
        payload: {
          id: crypto.randomUUID(),
          name: 'Cash / Emergency Fund',
          type: 'cash',
          owner: person.id,
          balance: 0,
          annualContribution: 0,
          contributionEndAge: state.settings.retirementAge,
          expectedReturn: 4,
          costBasis: 0,
          seppEnabled: false,
        },
      });
    }
  };

  const updatePerson = (person: Person) => {
    dispatch({ type: 'UPDATE_PERSON', payload: person });
  };

  const removePerson = (id: string) => {
    dispatch({ type: 'REMOVE_PERSON', payload: id });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">People</h2>
        {state.people.length < 2 && (
          <button
            onClick={addPerson}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Person
          </button>
        )}
      </div>

      {state.people.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">Add at least one person to get started.</p>
          <button
            onClick={addPerson}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Person
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {state.people.map((person) => (
          <div key={person.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium">Person Details</h3>
              <button
                onClick={() => removePerson(person.id)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={person.name}
                  onChange={(e) => updatePerson({ ...person, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Current Age</label>
                <NumberInput
                  value={person.currentAge}
                  onChange={(v) => updatePerson({ ...person, currentAge: v })}
                  decimals={false}
                  min={18}
                  max={65}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Life Expectancy</label>
                <NumberInput
                  value={person.lifeExpectancy}
                  onChange={(v) => updatePerson({ ...person, lifeExpectancy: v })}
                  decimals={false}
                  min={50}
                  max={120}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
