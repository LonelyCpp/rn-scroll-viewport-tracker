import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ScrollViewPortTracker,
  ScrollViewPortAwareView,
} from 'rn-scroll-viewport-tracker';

export default function App() {
  const ref = useRef<{ reNotifyVisibleItems: () => void }>(null);
  return (
    <ScrollViewPortTracker ref={ref}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {new Array(10).fill(0).map((_, i) => (
          <View key={'item' + i} style={styles.box}>
            <ScrollViewPortAwareView
              name={'item' + i}
              key={i}
              onEnterViewport={() => {
                console.log(`${i} enter`);
              }}
              onLeaveViewport={() => {
                console.log(`${i} leave`);
              }}
              style={styles.trackerBox}
            >
              <Text
                onPress={() => {
                  ref.current?.reNotifyVisibleItems();
                }}
              >
                {i}
              </Text>
            </ScrollViewPortAwareView>
          </View>
        ))}
      </ScrollView>
    </ScrollViewPortTracker>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    margin: 16,
  },
  box: {
    width: 100,
    height: 100,
    backgroundColor: 'red',
    margin: 100,
  },
  trackerBox: {
    padding: 20,
    borderWidth: 1,
  },
});
