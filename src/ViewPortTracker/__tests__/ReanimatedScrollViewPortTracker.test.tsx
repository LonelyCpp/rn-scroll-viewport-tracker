import { useContext, useEffect, type ReactNode } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { scheduleOnRN } from 'react-native-worklets';
import ReanimatedScrollViewPortTracker from '../ReanimatedScrollViewPortTracker';
import ScrollViewPortTrackerContext from '../ScrollViewPortTrackerContext';
import type { ScrollNotifyCallbackArgs } from '../../types';

// Reanimated's own Jest mock turns `useAnimatedScrollHandler` into a no-op, so
// capture the handlers instead and call them as the UI thread would.
jest.mock('react-native-reanimated', () => {
  const { useRef } = require('react');
  return {
    useSharedValue: (init: unknown) => useRef({ value: init }).current,
    useAnimatedScrollHandler: (handlers: object) => ({
      workletEventHandler: {},
      handlers,
    }),
    useComposedEventHandler: (composed: unknown[]) => ({
      workletEventHandler: {},
      composed,
    }),
  };
});

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: jest.fn(
    (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args)
  ),
}));

type Handlers = Record<
  'onScroll' | 'onEndDrag' | 'onMomentumEnd',
  (event: { contentOffset: { x: number; y: number } }) => void
>;

let scrollProps: Record<string, any> = {};

function FakeScrollView(props: Record<string, any>) {
  scrollProps = props;
  return props.children as ReactNode;
}

let notified: ScrollNotifyCallbackArgs[] = [];

function OffsetRecorder() {
  const { subscribe } = useContext(ScrollViewPortTrackerContext);
  useEffect(() => subscribe((offset) => notified.push(offset)), [subscribe]);
  return null;
}

const event = (y: number) => ({ contentOffset: { x: 0, y } });

function trackerHandlers(): Handlers {
  return scrollProps.onScroll.composed[0].handlers;
}

function render(
  trackerProps: { disableTracking?: boolean; scrollEventThrottle?: number },
  childProps: Record<string, unknown> = {}
) {
  const element = (props: typeof trackerProps) => (
    <ReanimatedScrollViewPortTracker {...props}>
      <FakeScrollView {...childProps}>
        <OffsetRecorder />
      </FakeScrollView>
    </ReanimatedScrollViewPortTracker>
  );

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element(trackerProps));
  });
  return {
    update: (props: typeof trackerProps) =>
      act(() => renderer.update(element(props))),
  };
}

const lastNotifiedY = () => notified[notified.length - 1]?.y;

beforeEach(() => {
  jest.useFakeTimers();
  (scheduleOnRN as jest.Mock).mockClear();
  notified = [];
  scrollProps = {};
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ReanimatedScrollViewPortTracker', () => {
  it('does not hop for scroll events inside the throttle window', () => {
    render({});
    const { onScroll } = trackerHandlers();

    onScroll(event(10));
    jest.advanceTimersByTime(50);
    onScroll(event(20));
    jest.advanceTimersByTime(100);
    onScroll(event(30));
    expect(scheduleOnRN).toHaveBeenCalledTimes(1);
    expect(lastNotifiedY()).toBe(10);
  });

  it('reports the last dropped offset at the end of the window', () => {
    render({});
    const { onScroll } = trackerHandlers();

    onScroll(event(10));
    jest.advanceTimersByTime(50);
    onScroll(event(20));
    onScroll(event(30)); // only one trailing report is scheduled
    jest.advanceTimersByTime(149);
    expect(scheduleOnRN).toHaveBeenCalledTimes(1);

    // The scroll view is held still: no more events, but the offset arrives.
    jest.advanceTimersByTime(1);
    expect(scheduleOnRN).toHaveBeenCalledTimes(2);
    expect(lastNotifiedY()).toBe(30);

    jest.advanceTimersByTime(1000);
    expect(scheduleOnRN).toHaveBeenCalledTimes(2);
  });

  it('uses scrollEventThrottle as the throttle window', () => {
    render({ scrollEventThrottle: 500 });
    const { onScroll } = trackerHandlers();

    onScroll(event(10));
    jest.advanceTimersByTime(100);
    onScroll(event(20));
    jest.advanceTimersByTime(399);
    expect(scheduleOnRN).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    expect(scheduleOnRN).toHaveBeenCalledTimes(2);
    expect(lastNotifiedY()).toBe(20);
  });

  it.each(['onEndDrag', 'onMomentumEnd'] as const)(
    '%s reports the final offset immediately, bypassing the throttle',
    (handler) => {
      render({});
      const handlers = trackerHandlers();

      handlers.onScroll(event(10));
      jest.advanceTimersByTime(20);
      handlers.onScroll(event(20)); // dropped by the throttle
      handlers[handler](event(25));

      expect(scheduleOnRN).toHaveBeenCalledTimes(2);
      // Reaches the store without waiting for a JS-side throttle.
      expect(lastNotifiedY()).toBe(25);

      // The flush restarted the throttle window, and the pending trailing
      // report has nothing newer to send.
      jest.advanceTimersByTime(190);
      handlers.onScroll(event(30));
      expect(scheduleOnRN).toHaveBeenCalledTimes(2);
    }
  );

  it('skips an end-of-scroll report when the offset is unchanged', () => {
    render({});
    const { onEndDrag, onMomentumEnd } = trackerHandlers();

    onEndDrag(event(50));
    onMomentumEnd(event(50));
    expect(scheduleOnRN).toHaveBeenCalledTimes(1);

    onMomentumEnd(event(80));
    expect(scheduleOnRN).toHaveBeenCalledTimes(2);
  });

  it('does not hop while disableTracking is set', () => {
    const { update } = render({ disableTracking: true });
    const { onScroll, onEndDrag, onMomentumEnd } = trackerHandlers();

    onScroll(event(10));
    jest.advanceTimersByTime(500);
    onScroll(event(20));
    onEndDrag(event(30));
    onMomentumEnd(event(40));
    jest.advanceTimersByTime(1000);
    expect(scheduleOnRN).not.toHaveBeenCalled();
    expect(notified).toHaveLength(0);

    // Resuming notifies with the offset reached while disabled.
    update({ disableTracking: false });
    expect(lastNotifiedY()).toBe(40);
    expect(scheduleOnRN).not.toHaveBeenCalled();
  });

  it('composes with the child worklet handler without changing it', () => {
    const childHandler = {
      workletEventHandler: {},
      handlers: { onScroll: jest.fn(), onEndDrag: jest.fn() },
    };
    render({}, { onScroll: childHandler });

    const composed = scrollProps.onScroll.composed;
    expect(composed).toHaveLength(2);
    expect(composed[1]).toBe(childHandler);
    expect(childHandler.handlers.onScroll).not.toHaveBeenCalled();
  });

  it('keeps plain function handlers on the JS side', () => {
    const childOnScroll = jest.fn();
    render({}, { onScroll: childOnScroll });

    const nativeEvent = event(10);
    act(() => scrollProps.onScroll({ nativeEvent }));

    expect(childOnScroll).toHaveBeenCalledWith({ nativeEvent });
    expect(scheduleOnRN).not.toHaveBeenCalled();
    expect(lastNotifiedY()).toBe(10);
  });
});
