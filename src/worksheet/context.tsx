import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import {
  initialState,
  worksheetReducer,
  type WorksheetAction,
  type WorksheetState,
} from './reducer';

type WorksheetContextValue = {
  state: WorksheetState;
  dispatch: Dispatch<WorksheetAction>;
};

const WorksheetContext = createContext<WorksheetContextValue | null>(null);

export function WorksheetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(worksheetReducer, initialState);
  return (
    <WorksheetContext.Provider value={{ state, dispatch }}>
      {children}
    </WorksheetContext.Provider>
  );
}

export function useWorksheet(): WorksheetContextValue {
  const value = useContext(WorksheetContext);
  if (!value) throw new Error('useWorksheet must be used inside WorksheetProvider');
  return value;
}
