import {
  type Ref,
  type ReactElement,
  useRef,
  useMemo,
  useEffect,
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

export type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;
type EventCb<T> = ((event: T) => void) | undefined;

export interface ViewPortTrackerProps {
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

export type SetScrollOffset = (offset: { x: number; y: number }) => void;

/**
 * Shared tracker logic: owns the offset store, the context and the child's
 * `ref` / `onLayout` wiring. Each tracker only decides how scroll offsets
 * reach `setOffset`, and passes the resulting scroll props to `renderTracker`.
 */
function useViewPortTracker(
  props: ViewPortTrackerProps,
  sRef: Ref<ScrollViewPortTrackerRef>
): {
  setOffset: SetScrollOffset;
  renderTracker: (scrollProps: { onScroll?: unknown }) => ReactElement;
} {
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

  const renderTracker = (scrollProps: { onScroll?: unknown }) => {
    const ClonedChild = cloneElement(props.children, {
      ...(scrollProps as { onScroll?: EventCb<ScrollEvent> }),
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

    return (
      <ScrollViewPortTrackerContext.Provider value={contextVal}>
        {ClonedChild}
      </ScrollViewPortTrackerContext.Provider>
    );
  };

  return { setOffset, renderTracker };
}

export default useViewPortTracker;
