import { type Ref, type ReactElement, forwardRef } from 'react';
import useViewPortTracker, {
  type ScrollViewPortTrackerRef,
  type ViewPortTrackerProps,
} from './useViewPortTracker';
import useScrollHandlerProps from './useScrollHandlerProps';

export type { ScrollViewPortTrackerRef };

const ScrollViewPortTracker = forwardRef(function (
  props: ViewPortTrackerProps,
  sRef: Ref<ScrollViewPortTrackerRef>
): ReactElement {
  const { setOffset, renderTracker } = useViewPortTracker(props, sRef);

  const scrollProps = useScrollHandlerProps(
    props.children.props.onScroll,
    setOffset
  );

  return renderTracker(scrollProps);
});

export default ScrollViewPortTracker;
