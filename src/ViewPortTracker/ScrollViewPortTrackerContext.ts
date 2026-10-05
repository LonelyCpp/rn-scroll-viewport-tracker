import { createContext, type Context } from 'react';
import type { ScrollNotifyCallbackArgs, VoidFunction } from '../types';

interface ScrollViewPortTrackerContextValue {
  horizontal: boolean;
  minOverlapRatio: number;
  getScrollViewRef: () => React.RefObject<any>;
  subscribe: (
    callback: (offset: ScrollNotifyCallbackArgs) => void
  ) => VoidFunction;
  notifyLayoutChange: () => void;
}

// The package ships both lib/commonjs and lib/module, and a consumer can end up
// loading both (e.g. the main entry via one and `/reanimated` via the other).
// Keep a single context on globalThis so providers and consumers always match,
// regardless of which build is loaded first.
const CONTEXT_KEY = Symbol.for('rn-scroll-viewport-tracker.context');

type ContextRegistry = {
  [CONTEXT_KEY]?: Context<ScrollViewPortTrackerContextValue>;
};

const registry = globalThis as ContextRegistry;

if (!registry[CONTEXT_KEY]) {
  registry[CONTEXT_KEY] = createContext<ScrollViewPortTrackerContextValue>({
    horizontal: false,
    minOverlapRatio: 0.2,
    subscribe: () => () => {},
    getScrollViewRef: () => ({ current: null }),
    notifyLayoutChange: () => {},
  });
}

const ScrollViewPortTrackerContext = registry[CONTEXT_KEY];

export default ScrollViewPortTrackerContext;
