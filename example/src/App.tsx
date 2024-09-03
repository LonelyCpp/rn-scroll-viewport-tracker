import { useRef, useState } from 'react';
import {
  Button,
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
} from 'react-native';
import {
  ScrollViewPortTracker,
  ScrollViewPortAwareView,
} from 'rn-scroll-viewport-tracker';

export default function App() {
  const ref = useRef<{ reNotifyVisibleItems: () => void }>(null);

  const [isHorizontal, setIsHorizontal] = useState(false);
  const [showFlatList, setUseFlatList] = useState(false);

  const refFl = useRef<FlatList>(null);

  refFl.current?.getNativeScrollRef();

  return (
    <View style={styles.container}>
      <Button
        title="toggle horizontal"
        onPress={() => setIsHorizontal((p) => !p)}
      />
      <Button
        title="toggle scroll view type"
        onPress={() => setUseFlatList((p) => !p)}
      />
      <View style={styles.scrollContainer}>
        <ScrollViewPortTracker ref={ref} minOverlapRatio={0.5}>
          {showFlatList ? (
            <FlatList
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
            <ScrollView
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
            </ScrollView>
          )}
        </ScrollViewPortTracker>
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
