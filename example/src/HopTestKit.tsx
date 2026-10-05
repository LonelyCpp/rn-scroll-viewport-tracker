/**
 * Hop test kit: measures how many scroll offsets `ReanimatedScrollViewPortTracker`
 * sends from the UI thread to the JS thread, and whether JS ends up with the
 * offset the scroll view came to rest at. Run it on a real device; see
 * "Hop test kit" in CONTRIBUTING.md.
 */
import { useContext, useEffect, useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { ReanimatedScrollViewPortTracker } from 'rn-scroll-viewport-tracker/reanimated';
// Internal: lets the kit count the offset notifications that reach JS.
import ScrollViewPortTrackerContext from '../../src/ViewPortTracker/ScrollViewPortTrackerContext';

const log = (message: string) => console.log('[HOP-KIT]', message);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Android rounds offsets to whole physical pixels, e.g. 1500 -> 1500.19.
const near = (a: number, b: number) => Math.abs(a - b) < 1;

interface JsStats {
  reports: number;
  lastY: number;
}

function OffsetRecorder({ stats }: { stats: JsStats }) {
  const { subscribe } = useContext(ScrollViewPortTrackerContext);
  useEffect(
    () =>
      subscribe((offset) => {
        stats.reports += 1;
        stats.lastY = offset.y;
      }),
    [subscribe, stats]
  );
  return null;
}

// `worklet-child`: the scroll view has its own `useAnimatedScrollHandler`.
// `no-handler`: the scroll view has no `onScroll`.
type Variant = 'worklet-child' | 'no-handler';

export default function HopTestKit({ onClose }: { onClose: () => void }) {
  const scrollRef = useRef<any>(null);
  const stats = useRef<JsStats>({ reports: 0, lastY: NaN }).current;
  const running = useRef(false);
  const [variant, setVariant] = useState<Variant>('worklet-child');
  const [disabled, setDisabled] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [live, setLive] = useState('');

  // Counted by the child's own worklet handler, which also shows that it
  // still runs alongside the tracker's.
  const uiEvents = useSharedValue(0);
  const childEndDrag = useSharedValue(0);
  const childMomentumEnd = useSharedValue(0);
  const actualY = useSharedValue(0);

  const childHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      uiEvents.value += 1;
      actualY.value = e.contentOffset.y;
    },
    onEndDrag: (e) => {
      childEndDrag.value += 1;
      actualY.value = e.contentOffset.y;
    },
    onMomentumEnd: (e) => {
      childMomentumEnd.value += 1;
      actualY.value = e.contentOffset.y;
    },
  });

  const snapshot = () => ({
    ui: uiEvents.value,
    js: stats.reports,
    endDrag: childEndDrag.value,
    momentumEnd: childMomentumEnd.value,
  });
  type Snapshot = ReturnType<typeof snapshot>;

  const describe = (before: Snapshot) => {
    const now = snapshot();
    return (
      `ui=${now.ui - before.ui} js=${now.js - before.js} ` +
      `childEndDrag=${now.endDrag - before.endDrag} ` +
      `childMomentumEnd=${now.momentumEnd - before.momentumEnd} ` +
      `jsY=${stats.lastY} actualY=${actualY.value.toFixed(1)}`
    );
  };

  const report = (name: string, pass: boolean, details: string) => {
    const line = `${pass ? 'PASS' : 'FAIL'} ${name}: ${details}`;
    log(line);
    setResults((prev) => [...prev, line]);
  };

  const scrollTo = (y: number, animated: boolean) =>
    scrollRef.current?.scrollTo({ y, animated });

  const run = async () => {
    setResults([]);
    running.current = true;
    log('run start');
    setVariant('worklet-child');
    setDisabled(false);
    await sleep(1000);
    scrollTo(0, false);
    await sleep(800);

    let before = snapshot();
    scrollTo(1500, true);
    await sleep(1500);
    report(
      'animated scrollTo is throttled and reports the final offset',
      near(stats.lastY, 1500) &&
        snapshot().js - before.js < snapshot().ui - before.ui,
      describe(before)
    );

    before = snapshot();
    scrollTo(700, false);
    await sleep(800);
    report(
      'non-animated scrollTo reports the final offset',
      near(stats.lastY, 700),
      describe(before)
    );

    // iOS emits a momentum end after every non-animated scrollTo, so expect
    // about one report per call here.
    before = snapshot();
    let y = 700;
    for (let i = 0; i < 60; i++) {
      y += 20;
      scrollTo(y, false);
      await sleep(16);
    }
    await sleep(800);
    report(
      '60 non-animated scrollTo calls report the final offset',
      near(stats.lastY, y),
      describe(before)
    );

    setDisabled(true);
    await sleep(500);
    before = snapshot();
    scrollTo(300, true);
    await sleep(1500);
    report(
      'disableTracking sends nothing to JS',
      snapshot().js === before.js,
      describe(before)
    );

    before = snapshot();
    setDisabled(false);
    await sleep(500);
    report(
      're-enabling notifies with the current offset',
      snapshot().js - before.js === 1 && near(stats.lastY, 300),
      describe(before)
    );

    setVariant('no-handler');
    await sleep(1500);
    before = snapshot();
    scrollTo(1200, true);
    await sleep(1500);
    report(
      'scroll view without onScroll reports the final offset',
      near(stats.lastY, 1200),
      describe(before)
    );

    setVariant('worklet-child');
    await sleep(1000);
    running.current = false;
    log('run end; drag and fling to log gestures');
  };

  // Lets a debugger attached through Metro start a run without touching the
  // device: evaluate `__hopTestKit.run()`.
  (globalThis as any).__hopTestKit = { run };

  // Logs one line per manual gesture, once scrolling has been idle for 800ms.
  // While a finger holds the scroll view still, the line shows whether the
  // trailing report has caught JS up.
  useEffect(() => {
    let base = snapshot();
    let lastUi = base.ui;
    let idleSince = Date.now();
    const id = setInterval(() => {
      const now = snapshot();
      if (running.current) {
        base = now;
        lastUi = now.ui;
        return;
      }
      if (now.ui !== lastUi) {
        lastUi = now.ui;
        idleSince = Date.now();
        return;
      }
      // Only the scroll view's own events count as a gesture, not
      // notifications from mounting or re-enabling the tracker.
      const scrolled =
        now.ui !== base.ui ||
        now.endDrag !== base.endDrag ||
        now.momentumEnd !== base.momentumEnd;
      if (scrolled && Date.now() - idleSince > 800) {
        const match = near(stats.lastY, actualY.value);
        log(`gesture ${describe(base)} ${match ? 'PASS' : 'FAIL'}`);
        base = snapshot();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setLive(
        `ui events ${uiEvents.value}   js reports ${stats.reports}\n` +
          `js y ${stats.lastY}   actual y ${actualY.value.toFixed(1)}`
      );
    }, 250);
    return () => clearInterval(id);
  }, [uiEvents, actualY, stats]);

  return (
    <View style={styles.container}>
      <Button title="back to example" onPress={onClose} />
      <Button title="run scripted scenarios" onPress={run} />
      <Text style={styles.live}>{live}</Text>
      <View style={styles.scrollBox}>
        <ReanimatedScrollViewPortTracker
          key={variant}
          disableTracking={disabled}
        >
          <Reanimated.ScrollView
            ref={scrollRef}
            onScroll={variant === 'worklet-child' ? childHandler : undefined}
          >
            <OffsetRecorder stats={stats} />
            <View style={styles.content} />
          </Reanimated.ScrollView>
        </ReanimatedScrollViewPortTracker>
      </View>
      <ScrollView style={styles.results}>
        {results.map((line, i) => (
          <Text key={i} style={styles.result}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 12 },
  live: { fontFamily: 'Menlo', fontSize: 12, marginVertical: 8 },
  scrollBox: { height: 300, borderWidth: 1, backgroundColor: 'lightpink' },
  content: {
    height: 4000,
    margin: 16,
    borderWidth: 4,
    borderStyle: 'dashed',
    backgroundColor: 'lightblue',
  },
  results: { marginTop: 8 },
  result: { fontFamily: 'Menlo', fontSize: 10, marginBottom: 4 },
});
