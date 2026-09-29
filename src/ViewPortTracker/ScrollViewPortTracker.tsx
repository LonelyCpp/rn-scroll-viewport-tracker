import {
  type Ref,
  type ReactElement,
  useRef,
  useMemo,
  useEffect,
  useCallback,
  forwardRef,
  version,
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

// React 19 moved `ref` into props; reading `element.ref` there logs an error.
const IS_REACT_19_OR_NEWER = parseInt(version, 10) >= 19;

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;
type EventCb<T> = ((event: T) => void) | undefined;

// `Animated.event(..., { useNativeDriver: true })` returns an `AnimatedEvent`
// object instead of a function. It must be passed through untouched, so we
// observe scroll events through its listener list instead.
interface NativeAnimatedEvent {
  __isNative: boolean;
  __addListener: (callback: (event: ScrollEvent) => void) => void;
  __removeListener: (callback: (event: ScrollEvent) => void) => void;
}

function isNativeAnimatedEvent(
  handler: unknown
): handler is NativeAnimatedEvent {
  return (
    typeof handler === 'object' &&
    handler !== null &&
    (handler as NativeAnimatedEvent).__isNative === true &&
    typeof (handler as NativeAnimatedEvent).__addListener === 'function' &&
    typeof (handler as NativeAnimatedEvent).__removeListener === 'function'
  );
}

interface ViewPortTrackerProps {
  minOverlapRatio?: number;
  disableTracking?: boolean;
  scrollEventThrottle?: number;
  children: ReactElement<{
    ref?: Ref<any>;
    horizontal?: boolean;
    onScroll?: EventCb<ScrollEvent>;
    onLayout?: EventCb<LayoutChangeEvent>;
  }>;
}

export interface ScrollViewPortTrackerRef {
  reNotifyVisibleItems: () => void;
}

const ScrollViewPortTracker = forwardRef(function (
  props: ViewPortTrackerProps,
  sRef: Ref<ScrollViewPortTrackerRef>
): ReactElement {
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

  const handleScroll = useCallback(
    (event: ScrollEvent) => {
      setOffset(event.nativeEvent.contentOffset);
    },
    [setOffset]
  );

  const childOnScroll: unknown = props.children.props.onScroll;

  useEffect(() => {
    if (!isNativeAnimatedEvent(childOnScroll)) {
      return;
    }

    childOnScroll.__addListener(handleScroll);
    return () => {
      childOnScroll.__removeListener(handleScroll);
    };
  }, [childOnScroll, handleScroll]);

  useEffect(() => {
    if (
      __DEV__ &&
      childOnScroll != null &&
      typeof childOnScroll !== 'function' &&
      !isNativeAnimatedEvent(childOnScroll)
    ) {
      console.warn(
        'ScrollViewPortTracker: unsupported onScroll handler on the scroll component; viewport tracking will not receive scroll events.'
      );
    }
  }, [childOnScroll]);

  useImperativeHandle(sRef, () => {
    return {
      reNotifyVisibleItems: () => {
        store.current.notify({ forceNotifyEnter: true });
      },
    };
  });

  // Only replace `onScroll` when it is a plain function (or missing). Anything
  // else (a native `AnimatedEvent`, a worklet handler, ...) is left as is so
  // the scroll component keeps driving its animations.
  const scrollProps =
    childOnScroll == null || typeof childOnScroll === 'function'
      ? {
          onScroll: (event: ScrollEvent) => {
            if (typeof childOnScroll === 'function') {
              childOnScroll(event);
            }

            handleScroll(event);
          },
        }
      : {};

  const ClonedChild = cloneElement(props.children, {
    ...scrollProps,
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
      const ref = IS_REACT_19_OR_NEWER
        ? props.children.props.ref
        : // @ts-expect-error `element.ref` is not in the React 19 types
          props.children.ref;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref != null) {
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
      notifyLayoutChange: () => {
        store.current.notify();
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
