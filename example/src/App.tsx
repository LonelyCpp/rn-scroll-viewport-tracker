import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Button,
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
} from 'react-native';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  ScrollViewPortTracker,
  ScrollViewPortAwareView,
} from 'rn-scroll-viewport-tracker';
import { ReanimatedScrollViewPortTracker } from 'rn-scroll-viewport-tracker/reanimated';

const SCROLL_TYPES = [
  'ScrollView',
  'FlatList',
  'Animated.ScrollView',
  'Animated.FlatList',
  'Reanimated.ScrollView',
  'Reanimated.FlatList',
] as const;

export default function App() {
  const ref = useRef<{ reNotifyVisibleItems: () => void }>(null);

  const [isHorizontal, setIsHorizontal] = useState(false);
  const [scrollType, setScrollType] =
    useState<(typeof SCROLL_TYPES)[number]>('ScrollView');

  const isAnimated = scrollType.startsWith('Animated.');
  const isReanimated = scrollType.startsWith('Reanimated.');
  const showFlatList = scrollType.endsWith('FlatList');

  const ScrollComponent = isReanimated
    ? Reanimated.ScrollView
    : isAnimated
      ? Animated.ScrollView
      : ScrollView;
  const FlatListComponent = isReanimated
    ? Reanimated.FlatList
    : isAnimated
      ? Animated.FlatList
      : FlatList;
  const Tracker = isReanimated
    ? ReanimatedScrollViewPortTracker
    : ScrollViewPortTracker;

  // Native-driven scroll offset, used to animate the progress bar.
  const scrollOffset = useRef(new Animated.Value(0)).current;
  const onAnimatedScroll = useMemo(
    () =>
      Animated.event(
        [
          {
            nativeEvent: {
              contentOffset: isHorizontal
                ? { x: scrollOffset }
                : { y: scrollOffset },
            },
          },
        ],
        { useNativeDriver: true }
      ),
    [isHorizontal, scrollOffset]
  );

  // Reanimated worklet scroll handler, used to animate the progress bar.
  const reanimatedOffset = useSharedValue(0);
  const onReanimatedScroll = useAnimatedScrollHandler((event) => {
    reanimatedOffset.value = isHorizontal
      ? event.contentOffset.x
      : event.contentOffset.y;
  });
  const reanimatedProgressStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scaleX: interpolate(
          reanimatedOffset.value,
          [0, 2000],
          [0, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const onScroll = isReanimated
    ? onReanimatedScroll
    : isAnimated
      ? onAnimatedScroll
      : undefined;

  return (
    <View style={styles.container}>
      <Button
        title="toggle horizontal"
        onPress={() => setIsHorizontal((p) => !p)}
      />
      <Button
        title={`scroll view type: ${scrollType}`}
        onPress={() =>
          setScrollType(
            (p) =>
              SCROLL_TYPES[
                (SCROLL_TYPES.indexOf(p) + 1) % SCROLL_TYPES.length
              ] ?? 'ScrollView'
          )
        }
      />
      <View style={styles.progressTrack}>
        {isAnimated && (
          <Animated.View
            style={[
              styles.progressBar,
              {
                transform: [
                  {
                    scaleX: scrollOffset.interpolate({
                      inputRange: [0, 2000],
                      outputRange: [0, 1],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          />
        )}
        {isReanimated && (
          <Reanimated.View
            style={[styles.progressBar, reanimatedProgressStyle]}
          />
        )}
      </View>
      <View style={styles.scrollContainer}>
        <Tracker ref={ref} minOverlapRatio={0.5}>
          {showFlatList ? (
            <FlatListComponent
              key={scrollType}
              onScroll={onScroll}
              data={new Array(3).fill(0)}
              horizontal={isHorizontal}
              ListHeaderComponent={<Buffer isHorizontal={isHorizontal} />}
              ListFooterComponent={<Buffer isHorizontal={isHorizontal} />}
              renderItem={({ index }) => {
                return (
                  <View style={styles.box}>
                    <TrackBox
                      index={index + 1}
                      onPress={() => {
                        ref.current?.reNotifyVisibleItems();
                      }}
                    />
                  </View>
                );
              }}
            />
          ) : (
            <ScrollComponent
              key={scrollType}
              onScroll={onScroll}
              contentContainerStyle={styles.scrollContent}
              horizontal={isHorizontal}
            >
              <View
                style={
                  isHorizontal ? styles.bufferHorizontal : styles.bufferVertical
                }
              />

              {new Array(3).fill(0).map((_, i) => (
                <View key={'item' + (i + 1)} style={styles.box}>
                  <TrackBox
                    index={i + 1}
                    onPress={() => {
                      ref.current?.reNotifyVisibleItems();
                    }}
                  />
                </View>
              ))}

              <View
                style={
                  isHorizontal ? styles.bufferHorizontal : styles.bufferVertical
                }
              />
            </ScrollComponent>
          )}
        </Tracker>
      </View>
    </View>
  );
}

function Buffer(props: { isHorizontal: boolean }) {
  const { isHorizontal } = props;

  return (
    <View
      style={isHorizontal ? styles.bufferHorizontal : styles.bufferVertical}
    />
  );
}

function TrackBox(props: { index: number; onPress?: () => void }) {
  const { index } = props;

  const [isInView, setIsInView] = useState(false);

  return (
    <ScrollViewPortAwareView
      name={'item' + index}
      key={index}
      onEnterViewport={() => {
        console.log(`${index} enter`);
        setIsInView(true);
      }}
      onLeaveViewport={() => {
        console.log(`${index} leave`);
        setIsInView(false);
      }}
      style={[styles.trackerBox, isInView && styles.trackerBoxActive]}
    >
      <Text onPress={props.onPress}>{index}</Text>
    </ScrollViewPortAwareView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    width: 200,
    height: 6,
    marginTop: 12,
    backgroundColor: 'lightgray',
  },
  progressBar: {
    flex: 1,
    backgroundColor: 'green',
    transformOrigin: 'left',
  },
  scrollContainer: {
    height: 500,
    margin: 20,
    borderWidth: 1,
    backgroundColor: 'lightpink',
  },
  scrollContent: {
    margin: 16,
  },
  box: {
    width: 200,
    margin: 16,
    marginBottom: 50,
  },
  trackerBox: {
    flex: 1,
    borderWidth: 5,
    height: 100,
  },
  trackerBoxActive: {
    borderColor: 'green',
  },
  bufferVertical: {
    height: 1000,
  },
  bufferHorizontal: {
    width: 1000,
  },
});
