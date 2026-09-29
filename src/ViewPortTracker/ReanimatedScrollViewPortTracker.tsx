import { type Ref, type ReactElement, forwardRef } from 'react';
import {
  useAnimatedScrollHandler,
  useComposedEventHandler,
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
  const { setOffset, renderTracker } = useViewPortTracker(props, sRef);

  const childOnScroll: unknown = props.children.props.onScroll;
  const isWorkletHandler = isWorkletEventHandler(childOnScroll);

  // A worklet handler overrides any JS handler for the same event, so the
  // tracker's own handler has to be a worklet composed with the child's.
  const trackerScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scheduleOnRN(setOffset, {
        x: event.contentOffset.x,
        y: event.contentOffset.y,
      });
    },
  });

  const composedScrollHandler = useComposedEventHandler([
    trackerScrollHandler,
    isWorkletHandler ? (childOnScroll as typeof trackerScrollHandler) : null,
  ]);

  // Plain functions and RN core `Animated.event` are handled on the JS side,
  // same as `ScrollViewPortTracker`.
  const jsScrollProps = useScrollHandlerProps(
    isWorkletHandler ? undefined : childOnScroll,
    setOffset
  );

  return renderTracker(
    isWorkletHandler ? { onScroll: composedScrollHandler } : jsScrollProps
  );
});

export default ReanimatedScrollViewPortTracker;
