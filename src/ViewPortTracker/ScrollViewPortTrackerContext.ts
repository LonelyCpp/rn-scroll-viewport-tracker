import { createContext } from 'react';
import type { ScrollBoxOffset, VoidFunction } from '../types';

interface ScrollViewPortTrackerContextValue {
  horizontal: boolean;
  minOverlapRatio: number;
  getScrollViewRef: () => React.RefObject<any>;
  subscribe: (callback: (offset: ScrollBoxOffset) => void) => VoidFunction;
}

const ScrollViewPortTrackerContext =
  createContext<ScrollViewPortTrackerContextValue>({
    horizontal: false,
    minOverlapRatio: 0.2,
    subscribe: () => () => {},
    getScrollViewRef: () => ({ current: null }),
  });

export default ScrollViewPortTrackerContext;
