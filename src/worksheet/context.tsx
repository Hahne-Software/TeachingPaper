import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import { blockDefaults } from '../blocks/registry';
import { layout, type PageLayout } from './layout';
import {
  createWorksheetReducer,
  initialState,
  type WorksheetAction,
  type WorksheetState,
} from './reducer';

type WorksheetContextValue = {
  state: WorksheetState;
  dispatch: Dispatch<WorksheetAction>;
  /** The Page layout of the current Blocks, from their measured heights. */
  pageLayout: PageLayout;
  /** Reads the latest Page layout, for commands that run outside a render. */
  getPageLayout: () => PageLayout;
  /** Records a Block's measured height; the Worksheet view calls it on every resize. */
  reportBlockHeight: (id: string, height: number) => void;
};

/** Fallback until a Block has been measured. */
const UNMEASURED_HEIGHT = 0;

const worksheetReducer = createWorksheetReducer(blockDefaults);

const WorksheetContext = createContext<WorksheetContextValue | null>(null);

export function WorksheetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(worksheetReducer, initialState);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const reportBlockHeight = useCallback((id: string, height: number) => {
    setHeights((current) =>
      current[id] === height ? current : { ...current, [id]: height },
    );
  }, []);
  const pageLayout = useMemo(
    () =>
      layout(
        state.blocks.map((block) => heights[block.id] ?? UNMEASURED_HEIGHT),
      ),
    [state.blocks, heights],
  );
  const latest = useRef(pageLayout);
  useLayoutEffect(() => {
    latest.current = pageLayout;
  }, [pageLayout]);
  const getPageLayout = useCallback(() => latest.current, []);
  return (
    <WorksheetContext.Provider
      value={{ state, dispatch, pageLayout, getPageLayout, reportBlockHeight }}
    >
      {children}
    </WorksheetContext.Provider>
  );
}

export function useWorksheet(): WorksheetContextValue {
  const value = useContext(WorksheetContext);
  if (!value)
    throw new Error('useWorksheet must be used inside WorksheetProvider');
  return value;
}
