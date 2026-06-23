import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { RECOMMENDATION_STREAM_MS } from '@/constants/recommendations';

type StreamingTextProps = {
  text: string;
  wordDelayMs?: number;
  style?: StyleProp<TextStyle>;
  onComplete?: () => void;
};

export default function StreamingText({
  text,
  wordDelayMs = RECOMMENDATION_STREAM_MS,
  style,
  onComplete,
}: StreamingTextProps) {
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);
  const [visibleCount, setVisibleCount] = useState(0);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    doneRef.current = false;
    setVisibleCount(0);

    if (words.length === 0) {
      onCompleteRef.current?.();
      return;
    }

    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= words.length) {
        clearInterval(timer);
        if (!doneRef.current) {
          doneRef.current = true;
          onCompleteRef.current?.();
        }
      }
    }, wordDelayMs);

    return () => clearInterval(timer);
  }, [text, wordDelayMs, words.length]);

  const displayed = words.slice(0, visibleCount).join(' ');
  const streaming = visibleCount < words.length;

  return (
    <Text style={[styles.text, style]}>
      {displayed}
      {streaming ? <Text style={styles.cursor}>|</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1e293b',
  },
  cursor: {
    color: '#3363AD',
    fontWeight: '300',
  },
});
