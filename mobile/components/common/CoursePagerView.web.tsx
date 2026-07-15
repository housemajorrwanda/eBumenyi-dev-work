import React, { Children, forwardRef, useImperativeHandle, useState } from 'react';
import { View, ViewStyle } from 'react-native';

export interface CoursePagerViewRef {
  setPage: (page: number) => void;
}

interface CoursePagerViewProps {
  style?: ViewStyle;
  initialPage?: number;
  onPageSelected?: (e: { nativeEvent: { position: number } }) => void;
  orientation?: 'horizontal' | 'vertical';
  overdrag?: boolean;
  offscreenPageLimit?: number;
  scrollEnabled?: boolean;
  children?: React.ReactNode;
}

const CoursePagerView = forwardRef<CoursePagerViewRef, CoursePagerViewProps>(function CoursePagerView(
  { style, initialPage = 0, onPageSelected, children },
  ref,
) {
  const [page, setPage] = useState(initialPage);
  const childArray = Children.toArray(children);

  useImperativeHandle(ref, () => ({
    setPage: (newPage: number) => {
      if (newPage < 0 || newPage >= childArray.length) return;
      setPage(newPage);
      onPageSelected?.({ nativeEvent: { position: newPage } });
    },
  }));

  return <View style={style}>{childArray[page] ?? null}</View>;
});

export default CoursePagerView;
