import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Check, ChevronDown, Circle } from 'lucide-react-native';
import { fonts } from '@/theme';

export type DropdownItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
};

type Props = {
  label?: string;
  items: DropdownItem[];
  multiple?: boolean;
  value?: string | string[];
  onChange: (val: string | string[]) => void;
  placeholder?: string;
  // when true, show the search input inside the dropdown
  searchable?: boolean;
  icon?: React.ReactNode;
  style?: object;
  // when true, show icons next to each option (defaults to false)
  showIcons?: boolean;
  labelColor?: string;
  /** if true the field is invalid; if string provided it will be shown below the field */
  error?: boolean | string;
};

export default function Dropdown({
  label,
  items,
  multiple = false,
  value,
  onChange,
  placeholder,
  searchable,
  icon,
  style,
  showIcons = false,
  labelColor: customLabelColor,
  error,
}: Props) {
  const { isDark, themeColors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  // Only show search when explicitly requested by the caller
  const effectiveSearchable = !!searchable;

  // match TextField theme tokens and label font
  const tColors: any = themeColors || {};
  const placeholderColor = isDark ? '#6b7280' : tColors.primary70;
  const selColor = tColors.primary ?? '#3363AD';
  const bg = tColors.cardBg ?? (isDark ? '#111827' : '#ffffff');
  const border = tColors.cardSubtitle ?? tColors.neutral60 ?? (isDark ? '#374151' : '#d1d5db');
  const labelColor = customLabelColor ?? (isDark ? '#d1d5db' : '#374151');
  const txtColor = tColors.cardText ?? (isDark ? '#ffffff' : '#111827');
  const errorColor = tColors.error ?? '#ef4444';
  const effectiveBorder = error ? errorColor : border;

  const buttonRef = useRef<any>(null);
  const [anchor, setAnchor] = useState<{ top?: number; left?: number; width?: number }>({});
  const [modalListMaxHeight, setModalListMaxHeight] = useState<number | undefined>(undefined);
  const [openAbove, setOpenAbove] = useState(false);

  const initialSelection = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : [];
    }
    return typeof value === 'string' ? value : '';
  }, [value, multiple]);

  const [selection, setSelection] = useState<string[] | string>(initialSelection);

  useEffect(() => {
    setSelection(initialSelection);
  }, [initialSelection]);

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  // compute max height so dropdown scrolls internally when there are many items
  const ITEM_HEIGHT = 48; // estimated height per item
  const VISIBLE_COUNT = 8; // show at least 8 items, scroll if more
  const listMaxHeight = items.length > VISIBLE_COUNT ? ITEM_HEIGHT * VISIBLE_COUNT : ITEM_HEIGHT * items.length;

  const toggleItem = (id: string) => {
    if (multiple) {
      const set = new Set(Array.isArray(selection) ? selection : []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const out = Array.from(set);
      setSelection(out);
      onChange(out);
    } else {
      setSelection(id);
      onChange(id);
      setVisible(false);
    }
  };

  const renderItem = ({ item }: { item: DropdownItem }) => {
    const selected = multiple
      ? Array.isArray(selection) && selection.includes(item.id)
      : selection === item.id;

    return (
      <TouchableOpacity
        style={[styles.item, { borderColor: isDark ? '#374151' : '#e5e7eb' }]}
        onPress={() => toggleItem(item.id)}
      >
        <View style={styles.itemLeft}>
          {showIcons ? (
            item.icon ? item.icon : <Circle color={isDark ? '#9ca3af' : '#6b7280'} size={18} />
          ) : null}
          <Text style={[styles.itemLabel, { color: isDark ? '#e5e7eb' : '#111827', marginLeft: showIcons ? 10 : 0 }]}>{item.label}</Text>
        </View>

        {multiple ? (
          selected ? <Check color={isDark ? '#10b981' : '#059669'} size={18} /> : null
        ) : (
          selected ? <Check color={isDark ? '#10b981' : '#059669'} size={18} /> : null
        )}
      </TouchableOpacity>
    );
  };

  const summaryText = () => {
    if (multiple) {
      const arr = Array.isArray(selection) ? selection : [];
      if (arr.length === 0) return placeholder || 'Select...';
      const labels = items.filter((it) => arr.includes(it.id)).map((it) => it.label);
      return labels.join(', ');
    }
    if (!selection) return placeholder || 'Select...';
    const it = items.find((i) => i.id === selection);
    return it ? it.label : placeholder || 'Select...';
  };

  // whether the summary shown is a placeholder (no selection)
  const isSummaryPlaceholder = (() => {
    if (multiple) {
      const arr = Array.isArray(selection) ? selection : [];
      return arr.length === 0;
    }
    return !selection;
  })();

  const measureAndOpen = () => {
    // measure button position and center the modal on screen
    const { height: windowHeight } = Dimensions.get('window');

    // Estimate fixed parts heights: search input + footer + padding
    const ESTIMATED_MODAL_PADDING = 24; // padding + extra spacing
    const SEARCH_HEIGHT = effectiveSearchable ? (Platform.OS === 'ios' ? 50 : 48) : 0;
    const FOOTER_HEIGHT = 48;
    const totalModalHeight = SEARCH_HEIGHT + listMaxHeight + FOOTER_HEIGHT + ESTIMATED_MODAL_PADDING;

    try {
      if (buttonRef.current && buttonRef.current.measureInWindow) {
        buttonRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
          const spaceBelow = windowHeight - (y + h) - 6;
          const spaceAbove = y - 6;

          // Always use full listMaxHeight (for 8 items), don't constrain it
          let openUp = false;
          let top: number;

          // Try to open below first
          if (spaceBelow >= totalModalHeight) {
            openUp = false;
            top = y + h + 6;
          } else if (spaceAbove >= totalModalHeight) {
            // Open above if not enough space below
            openUp = true;
            top = Math.max(8, y - totalModalHeight - 6);
          } else {
            // Not enough space on either side - center vertically on screen
            // This ensures we always get the full height for 8 items
            top = Math.max(8, Math.min(windowHeight - totalModalHeight - 8, (windowHeight - totalModalHeight) / 2));
            openUp = top < y - 100; // rough estimate if opening above
          }

          setOpenAbove(openUp);
          setModalListMaxHeight(listMaxHeight); // Always use full height for 8 items
          setAnchor({ top, left: x, width: w });
          setVisible(true);
        });
        return;
      }
    } catch {
      // ignore and fallback to center
    }
    setVisible(true);
  };

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={[styles.label, { color: labelColor, fontFamily: fonts.medium }]}>{label}</Text> : null}

      <TouchableOpacity
        ref={buttonRef}
        style={[
          styles.button,
          { backgroundColor: bg, borderColor: effectiveBorder, borderWidth: 1 },
        ]}
        onPress={measureAndOpen}
      >
        <View style={styles.buttonLeft}>
          {icon ? icon : null}
          <Text style={[styles.buttonText, { color: isSummaryPlaceholder ? placeholderColor : txtColor }]} numberOfLines={1}>
            {summaryText()}
          </Text>
        </View>

        <ChevronDown color={isDark ? '#cbd5e1' : '#374151'} size={18} />
      </TouchableOpacity>

      {typeof error === 'string' && error.length ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <Modal animationType="fade" transparent visible={visible} onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)} />
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: anchor.left ?? 16, top: anchor.top ?? '20%', width: anchor.width ?? undefined, right: anchor.left ? undefined : 16 }}
        >
          <View style={[styles.modalCard, { backgroundColor: bg, borderColor: border, borderWidth: 1 }]}> 
            {effectiveSearchable ? (
              <TextInput
                placeholder="Search..."
                placeholderTextColor={placeholderColor}
                value={query}
                onChangeText={setQuery}
                style={[styles.searchInput, { color: txtColor, borderColor: border }]}
              />
            ) : null}

            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              renderItem={renderItem}
              style={{ maxHeight: modalListMaxHeight ?? listMaxHeight }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            />

            {/* <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setVisible(false)} style={styles.footerButton}>
                <Text style={{ color: isDark ? '#9ca3af' : tColors.primary ?? '#3363AD' }}>Close</Text>
              </TouchableOpacity>
            </View> */}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  buttonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  buttonText: {
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    marginTop: 6,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalContentWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '20%',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  modalCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  searchInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e7eb',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemLabel: {
    fontSize: 15,
  },
  modalFooter: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  footerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
