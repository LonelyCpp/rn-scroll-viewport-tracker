import { useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ScrollViewPortTracker,
  ScrollViewPortAwareView,
} from 'rn-scroll-viewport-tracker';

export default function App() {
  const ref = useRef<{ reNotifyVisibleItems: () => void }>(null);

  const [isHorizontal, setIsHorizontal] = useState(false);

  return (
    <View style={styles.container}>
      <Button
        title="toggle horizontal"
        onPress={() => setIsHorizontal(!isHorizontal)}
      />
      <View style={styles.scrollContainer}>
        <ScrollViewPortTracker ref={ref}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            horizontal={isHorizontal}
          >
            {new Array(3).fill(0).map((_, i) => (
              <View key={'item' + i} style={styles.box}>
                <TrackBox
                  index={i}
                  onPress={() => {
                    ref.current?.reNotifyVisibleItems();
                  }}
                />
              </View>
            ))}
          </ScrollView>
        </ScrollViewPortTracker>
      </View>
    </View>
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
    height: 100,
    margin: 16,
  },
  trackerBox: {
    flex: 1,
    borderWidth: 5,
  },
  trackerBoxActive: {
    borderColor: 'green',
  },
});
