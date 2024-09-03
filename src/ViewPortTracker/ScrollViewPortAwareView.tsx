import { useContext, useEffect, useRef, useState } from 'react';
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

  const scrollParentRef = trackerData.getScrollViewRef();
  const isScrollParentHorizontal = trackerData.horizontal;

  const isInViewportRef = useRef(false);

  const ownRef = useRef<View>(null);

  const [ownLayout, setOwnLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const onEnterViewportRef = useRef(props.onEnterViewport);
  const onLeaveViewportRef = useRef(props.onLeaveViewport);

  useEffect(() => {
    if (ownRef.current) {
      ownRef.current?.measureLayout(
        scrollParentRef.current,
        (x, y, width, height) => {
          setOwnLayout({ x, y, width, height });
        }
      );
    }
  }, [scrollParentRef, isScrollParentHorizontal]);

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

        ownRef.current?.measureLayout(
          scrollParentRef.current,
          (x, y, width, height) => {
            setOwnLayout({ x, y, width, height });
          }
        );
      }}
    />
  );
}

export default ScrollViewPortAwareView;
