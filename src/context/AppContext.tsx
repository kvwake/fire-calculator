import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, Person, Account, SocialSecurityConfig, SpendingConfig, Settings } from '../types';

const STORAGE_KEY = 'fire-calculator-state';

const defaultState: AppState = {
  people: [],
  accounts: [],
  socialSecurity: [],
  spending: {
    phases: [
      {
        id: crypto.randomUUID(),
        label: 'Retirement',
        startAge: 55,
        endAge: 95,
        annualAmount: 60000,
      },
    ],
    healthcare: {
      pre65AnnualPerPerson: 12000,
      post65AnnualPerPerson: 3000,
    },
  },
  settings: {
    inflationRate: 3,
    state: 'TX',
    filingStatus: 'married',
  },
};

type Action =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'SET_PEOPLE'; payload: Person[] }
  | { type: 'ADD_PERSON'; payload: Person }
  | { type: 'UPDATE_PERSON'; payload: Person }
  | { type: 'REMOVE_PERSON'; payload: string }
  | { type: 'SET_ACCOUNTS'; payload: Account[] }
  | { type: 'ADD_ACCOUNT'; payload: Account }
  | { type: 'UPDATE_ACCOUNT'; payload: Account }
  | { type: 'REMOVE_ACCOUNT'; payload: string }
  | { type: 'SET_SOCIAL_SECURITY'; payload: SocialSecurityConfig[] }
  | { type: 'UPDATE_SS_CONFIG'; payload: SocialSecurityConfig }
  | { type: 'SET_SPENDING'; payload: SpendingConfig }
  | { type: 'SET_SETTINGS'; payload: Settings };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE':
      return action.payload;
    case 'SET_PEOPLE':
      return { ...state, people: action.payload };
    case 'ADD_PERSON':
      return { ...state, people: [...state.people, action.payload] };
    case 'UPDATE_PERSON':
      return {
        ...state,
        people: state.people.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    case 'REMOVE_PERSON': {
      const personId = action.payload;
      return {
        ...state,
        people: state.people.filter((p) => p.id !== personId),
        accounts: state.accounts.filter((a) => a.owner !== personId),
        socialSecurity: state.socialSecurity.filter((ss) => ss.personId !== personId),
      };
    }
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.payload };
    case 'ADD_ACCOUNT':
      return { ...state, accounts: [...state.accounts, action.payload] };
    case 'UPDATE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      };
    case 'REMOVE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.payload),
      };
    case 'SET_SOCIAL_SECURITY':
      return { ...state, socialSecurity: action.payload };
    case 'UPDATE_SS_CONFIG':
      return {
        ...state,
        socialSecurity: state.socialSecurity.map((ss) =>
          ss.personId === action.payload.personId ? action.payload : ss
        ),
      };
    case 'SET_SPENDING':
      return { ...state, spending: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    default:
      return state;
  }
}

function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultState, ...parsed };
    }
  } catch {
    // ignore
  }
  return defaultState;
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  exportData: () => string;
  importData: (json: string) => boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, loadState);

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const exportData = () => JSON.stringify(state, null, 2);

  const importData = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      dispatch({ type: 'SET_STATE', payload: { ...defaultState, ...parsed } });
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AppContext.Provider value={{ state, dispatch, exportData, importData }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
