import { createContext } from 'react';
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

const ScrollViewPortTrackerContext =
  createContext<ScrollViewPortTrackerContextValue>({
    horizontal: false,
    minOverlapRatio: 0.2,
    subscribe: () => () => {},
    getScrollViewRef: () => ({ current: null }),
    notifyLayoutChange: () => {},
  });

export default ScrollViewPortTrackerContext;
