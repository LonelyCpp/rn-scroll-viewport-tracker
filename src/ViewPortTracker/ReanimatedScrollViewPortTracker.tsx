import { type Ref, type ReactElement, forwardRef, useEffect } from 'react';
import type { NativeScrollEvent } from 'react-native';
import {
  useAnimatedScrollHandler,
  useComposedEventHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import useViewPortTracker, {
  type ScrollViewPortTrackerRef,
  type ViewPortTrackerProps,
} from './useViewPortTracker';
import useScrollHandlerProps, {
  isWorkletEventHandler,
} from './useScrollHandlerProps';

const ReanimatedScrollViewPortTracker = forwardRef(function (
  props: ViewPortTrackerProps,
  sRef: Ref<ScrollViewPortTrackerRef>
): ReactElement {
  // Updated on the UI thread on every scroll event, even while tracking is
  // disabled, so tracking can resume from the current offset without a hop.
  const latestX = useSharedValue(0);
  const latestY = useSharedValue(0);
  // Last offset sent to the JS thread, to skip redundant end-of-scroll reports.
  const lastReportedX = useSharedValue(NaN);
  const lastReportedY = useSharedValue(NaN);
  const lastReportedAt = useSharedValue(-Infinity);
  const trailingReportPending = useSharedValue(false);
  const disabled = useSharedValue(!!props.disableTracking);

  const { setOffset, setOffsetImmediate, renderTracker } = useViewPortTracker(
    props,
    sRef,
    () => {
      lastReportedX.value = NaN;
      lastReportedY.value = NaN;
      return { x: latestX.value, y: latestY.value };
    }
  );

  useEffect(() => {
    disabled.value = !!props.disableTracking;
  }, [disabled, props.disableTracking]);

  const childOnScroll: unknown = props.children.props.onScroll;
  const isWorkletHandler = isWorkletEventHandler(childOnScroll);
  const useWorkletPath = childOnScroll == null || isWorkletHandler;

  const scrollEventThrottle = props.scrollEventThrottle ?? 200;

  const report = (x: number, y: number) => {
    'worklet';
    lastReportedAt.value = performance.now();
    lastReportedX.value = x;
    lastReportedY.value = y;
    scheduleOnRN(setOffsetImmediate, { x, y });
  };

  // The scroll view has come to rest: always report the offset, since the
  // throttle in `onScroll` may have dropped the last events. On Android,
  // momentum events need a JS momentum prop; Reanimated's animated components
  // set a placeholder prop for each event a worklet handler subscribes to.
  const reportFinalOffset = (event: NativeScrollEvent) => {
    'worklet';
    const { x, y } = event.contentOffset;
    latestX.value = x;
    latestY.value = y;
    if (disabled.value) {
      return;
    }
    if (x === lastReportedX.value && y === lastReportedY.value) {
      return;
    }
    report(x, y);
  };

  // Throttle on the UI thread, so dropped events never cross to the JS thread.
  // Like lodash's throttle, it reports on the leading and trailing edge: the
  // trailing report covers a scroll view held still mid-gesture, which emits
  // neither more scroll events nor an end event.
  // A worklet handler overrides any JS handler for the same event, so the
  // tracker's own handler has to be a worklet composed with the child's.
  const trackerScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      const { x, y } = event.contentOffset;
      latestX.value = x;
      latestY.value = y;
      if (disabled.value) {
        return;
      }
      const elapsed = performance.now() - lastReportedAt.value;
      if (elapsed >= scrollEventThrottle) {
        report(x, y);
        return;
      }
      if (trailingReportPending.value) {
        return;
      }
      trailingReportPending.value = true;
      setTimeout(() => {
        trailingReportPending.value = false;
        if (disabled.value) {
          return;
        }
        const lx = latestX.value;
        const ly = latestY.value;
        if (lx === lastReportedX.value && ly === lastReportedY.value) {
          return;
        }
        report(lx, ly);
      }, scrollEventThrottle - elapsed);
    },
    onEndDrag: reportFinalOffset,
    onMomentumEnd: reportFinalOffset,
  });

  const composedScrollHandler = useComposedEventHandler([
    trackerScrollHandler,
    isWorkletHandler ? (childOnScroll as typeof trackerScrollHandler) : null,
  ]);

  // A pending trailing call from the JS path must not overwrite newer offsets
  // reported by the worklet.
  useEffect(() => {
    if (useWorkletPath) {
      setOffset.cancel();
    }
  }, [useWorkletPath, setOffset]);

  // Plain functions and RN core `Animated.event` are handled on the JS side,
  // same as `ScrollViewPortTracker`.
  const jsScrollProps = useScrollHandlerProps(
    useWorkletPath ? undefined : childOnScroll,
    setOffset
  );

  return renderTracker(
    useWorkletPath ? { onScroll: composedScrollHandler } : jsScrollProps
  );
});

export default ReanimatedScrollViewPortTracker;
