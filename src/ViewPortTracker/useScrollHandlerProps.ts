import { useCallback, useEffect } from 'react';
import type { ScrollEvent, SetScrollOffset } from './useViewPortTracker';

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

// Reanimated's `useAnimatedScrollHandler` / `useEvent` return an object
// holding a `workletEventHandler`.
export function isWorkletEventHandler(handler: unknown): boolean {
  return (
    typeof handler === 'object' &&
    handler !== null &&
    'workletEventHandler' in handler
  );
}

/**
 * Scroll props for JS-side `onScroll` handlers: plain functions and RN core
 * `Animated.event`. Other handler types are left untouched on the child.
 */
function useScrollHandlerProps(
  childOnScroll: unknown,
  setOffset: SetScrollOffset
): { onScroll?: (event: ScrollEvent) => void } {
  const handleScroll = useCallback(
    (event: ScrollEvent) => {
      setOffset(event.nativeEvent.contentOffset);
    },
    [setOffset]
  );

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
        isWorkletEventHandler(childOnScroll)
          ? "ScrollViewPortTracker: Reanimated scroll handlers are not supported here; use ReanimatedScrollViewPortTracker from 'rn-scroll-viewport-tracker/reanimated'."
          : 'ScrollViewPortTracker: unsupported onScroll handler on the scroll component; viewport tracking will not receive scroll events.'
      );
    }
  }, [childOnScroll]);

  // Only replace `onScroll` when it is a plain function (or missing). Anything
  // else (a native `AnimatedEvent`, a worklet handler, ...) is left as is so
  // the scroll component keeps driving its animations.
  if (childOnScroll == null || typeof childOnScroll === 'function') {
    return {
      onScroll: (event: ScrollEvent) => {
        if (typeof childOnScroll === 'function') {
          childOnScroll(event);
        }

        handleScroll(event);
      },
    };
  }

  return {};
}

export default useScrollHandlerProps;
