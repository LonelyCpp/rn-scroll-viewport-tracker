import {
  type Ref,
  useRef,
  useMemo,
  useEffect,
  forwardRef,
  cloneElement,
  useImperativeHandle,
} from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import throttle from 'lodash.throttle';
import ScrollOffsetStore from './ScrollOffsetStore';
import type { ScrollBoxOffset, VoidFunction } from '../types';
import ScrollViewPortTrackerContext from './ScrollViewPortTrackerContext';

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;
type EventCb<T> = ((event: T) => void) | undefined;

interface ViewPortTrackerProps {
  scrollEventThrottle?: number;
  minOverlapRatio?: number;
  disableTracking?: boolean;
  children: React.ReactElement<{
    ref?: Ref<any>;
    horizontal?: boolean;
    onScroll?: EventCb<ScrollEvent>;
    onLayout?: EventCb<LayoutChangeEvent>;
  }>;
}

interface ScrollViewPortTrackerRef {
  reNotifyVisibleItems: () => void;
}

const ScrollViewPortTracker = forwardRef(function (
  props: ViewPortTrackerProps,
  sRef: Ref<ScrollViewPortTrackerRef>
): JSX.Element {
  const scrollRef = useRef<Ref<any>>(null);

  const store = useRef(
    new ScrollOffsetStore({
      isNotifying: !props.disableTracking,
    })
  );

  useEffect(() => {
    store.current.setIsNotifying(!props.disableTracking);
  }, [props.disableTracking]);

  const setOffset = useMemo(() => {
    return throttle((offset: { x: number; y: number }) => {
      store.current.setOffset(offset);
    }, props.scrollEventThrottle ?? 200);
  }, [props.scrollEventThrottle]);

  useImperativeHandle(sRef, () => {
    return {
      reNotifyVisibleItems: () => {
        store.current.notify({ forceNotifyEnter: true });
      },
    };
  });

  const ClonedChild = cloneElement(props.children, {
    onScroll: (event: ScrollEvent) => {
      if (typeof props.children.props.onScroll === 'function') {
        props.children.props.onScroll(event);
      }

      setOffset(event.nativeEvent.contentOffset);
    },
    onLayout: (event: LayoutChangeEvent) => {
      if (typeof props.children.props.onLayout === 'function') {
        props.children.props.onLayout(event);
      }

      const { width, height } = event.nativeEvent.layout;
      store.current.setDimensions({ width, height });
    },
    ref: (node: Ref<any>) => {
      // Keep your own reference
      scrollRef.current = node;

      // Call the original ref, if any
      // @ts-expect-error
      const { ref } = props.children;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref !== null) {
        ref.current = node;
      }
    },
  });

  const contextVal = useMemo(() => {
    return {
      horizontal: !!props.children.props.horizontal,
      minOverlapRatio: props.minOverlapRatio ?? 0.2,
      getScrollViewRef: () => scrollRef,
      subscribe: (
        callback: (offset: ScrollBoxOffset) => void
      ): VoidFunction => {
        return store.current.subscribe(callback);
      },
    };
  }, [props.children.props.horizontal, props.minOverlapRatio]);

  return (
    <ScrollViewPortTrackerContext.Provider value={contextVal}>
      {ClonedChild}
    </ScrollViewPortTrackerContext.Provider>
  );
});

export default ScrollViewPortTracker;
