import * as Haptics from 'expo-haptics';
import { useRef, useState, type ReactNode } from 'react';
import { Animated, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const GAP = 10; // same as Section

/** Vertical list: long-press an item, then drag it up or down to reorder. */
export function DragList<T>({ data, keyOf, render, onMove }: {
  data: T[];
  keyOf: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
  onMove: (from: number, to: number) => void;
}) {
  const layouts = useRef<{ y: number; h: number }[]>([]);
  const offset = useRef(new Animated.Value(0)).current;
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  layouts.current.length = data.length; // forget removed items

  // new index = how many other items have their middle above the dragged item's middle
  const targetFor = (from: number, dy: number) => {
    const L = layouts.current;
    const mid = L[from].y + L[from].h / 2 + dy;
    return L.reduce((n, l, i) => (i !== from && l && l.y + l.h / 2 < mid ? n + 1 : n), 0);
  };

  const gesture = (index: number) =>
    Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(300)
      .onStart(() => {
        if (!layouts.current[index]) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setDrag({ from: index, to: index });
      })
      .onUpdate(e => {
        const d = dragRef.current;
        if (!d) return;
        offset.setValue(e.translationY);
        const to = targetFor(d.from, e.translationY);
        if (to !== d.to) setDrag({ from: d.from, to });
      })
      .onFinalize(() => {
        const d = dragRef.current;
        if (!d) return;
        offset.setValue(0);
        setDrag(null);
        if (d.to !== d.from) onMove(d.from, d.to);
      });

  // the others slide by one slot to show where the dragged item will land
  const shift = (i: number) => {
    if (!drag || i === drag.from) return 0;
    const slot = (layouts.current[drag.from]?.h ?? 0) + GAP;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -slot;
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return slot;
    return 0;
  };

  return (
    <View style={{ gap: GAP }}>
      {data.map((item, i) => {
        const active = drag?.from === i;
        return (
          <GestureDetector key={keyOf(item)} gesture={gesture(i)}>
            <Animated.View
              onLayout={e => (layouts.current[i] = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
              style={[
                { transform: [{ translateY: active ? offset : shift(i) }] },
                active && { zIndex: 10, elevation: 8, opacity: 0.95, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
              ]}
            >
              {render(item, i)}
            </Animated.View>
          </GestureDetector>
        );
      })}
    </View>
  );
}
