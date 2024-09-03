import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, View, type ViewProps } from 'react-native';
import ScrollViewPortTrackerContext from './ScrollViewPortTrackerContext';
import { doBoxesOverlap } from '../utils';

interface Props extends ViewProps {
  name: string;
  onEnterViewport?: () => void;
  onLeaveViewport?: () => void;
}

function ScrollViewPortAwareView(props: Props): JSX.Element {
  const trackerData = useContext(ScrollViewPortTrackerContext);

  const onEnterViewportRef = useRef(props.onEnterViewport);
  const onLeaveViewportRef = useRef(props.onLeaveViewport);

  const scrollParentRef = trackerData.getScrollViewRef();

  const ownRef = useRef<View>(null);
  const isInViewportRef = useRef(false);

  const [ownLayout, setOwnLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const updateLayout = useCallback(() => {
    const notifyTracker = trackerData.notifyLayoutChange;

    if (ownRef.current && notifyTracker) {
      ownRef.current?.measureLayout(
        scrollParentRef.current,
        (x, y, width, height) => {
          setOwnLayout({ x, y, width, height });
          notifyTracker();
        }
      );
    }
  }, [scrollParentRef, trackerData.notifyLayoutChange]);

  const prevHorizontalRef = useRef(trackerData.horizontal);
  useEffect(() => {
    const hasScrollDirectionChanged =
      prevHorizontalRef.current !== trackerData.horizontal;

    if (hasScrollDirectionChanged) {
      prevHorizontalRef.current = trackerData.horizontal;
      updateLayout();
    }
  }, [trackerData.horizontal, updateLayout]);

  useEffect(() => {
    const unsub = trackerData.subscribe((scrollNotifyMeta) => {
      const isInViewport = doBoxesOverlap(
        {
          x: ownLayout.x,
          y: ownLayout.y,
          width: ownLayout.width,
          height: ownLayout.height,
        },
        {
          x: trackerData.horizontal ? scrollNotifyMeta.x : 0,
          y: trackerData.horizontal ? 0 : scrollNotifyMeta.y,
          width: scrollNotifyMeta.width,
          height: scrollNotifyMeta.height,
        },
        trackerData.minOverlapRatio
      );

      if (isInViewport !== isInViewportRef.current) {
        isInViewportRef.current = isInViewport;
        if (isInViewport) {
          onEnterViewportRef.current?.();
        } else {
          onLeaveViewportRef.current?.();
        }
      } else if (scrollNotifyMeta.forceNotifyEnter && isInViewport) {
        onEnterViewportRef.current?.();
      }
    });

    return () => {
      unsub();
    };
  }, [trackerData, ownLayout]);

  return (
    <View
      {...props}
      ref={ownRef}
      onLayout={(event: LayoutChangeEvent): void => {
        if (typeof props.onLayout === 'function') {
          props.onLayout(event);
        }

        if (!scrollParentRef) {
          throw new Error('could not acquire scroll-component ref');
        }

        updateLayout();
      }}
    />
  );
}

export default ScrollViewPortAwareView;
