import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';

export const SYNC_NOTICE_VISIBLE_MS = 10_000;
const ENTER_MS = 320;
const EXIT_MS = 280;

interface AnimatedSyncNoticeProps {
  visible: boolean;
  message: string;
  onDismiss: () => void;
}

export function AnimatedSyncNotice({ visible, message, onDismiss }: AnimatedSyncNoticeProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const [isRendered, setIsRendered] = useState(false);
  const isRenderedRef = useRef(false);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExitingRef = useRef(false);
  const onDismissRef = useRef(onDismiss);

  onDismissRef.current = onDismiss;

  const clearAutoDismissTimer = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  const animateOut = useCallback(
    (afterComplete?: () => void) => {
      if (isExitingRef.current) {
        return;
      }

      isExitingRef.current = true;

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: EXIT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -6,
          duration: EXIT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        isExitingRef.current = false;

        if (!finished) {
          return;
        }

        setIsRendered(false);
        isRenderedRef.current = false;
        afterComplete?.();
      });
    },
    [opacity, translateY],
  );

  const animateIn = useCallback(() => {
    isExitingRef.current = false;
    opacity.setValue(0);
    translateY.setValue(8);
    setIsRendered(true);
    isRenderedRef.current = true;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  useEffect(() => {
    if (!visible) {
      clearAutoDismissTimer();

      if (isRenderedRef.current) {
        animateOut();
      }

      return;
    }

    animateIn();
    autoDismissTimerRef.current = setTimeout(() => {
      animateOut(() => onDismissRef.current());
    }, SYNC_NOTICE_VISIBLE_MS);

    return clearAutoDismissTimer;
  }, [visible, message, animateIn, animateOut, clearAutoDismissTimer]);

  if (!isRendered) {
    return null;
  }

  return (
    <Animated.Text
      style={[styles.syncNoticeText, { opacity, transform: [{ translateY }] }]}
      accessibilityLiveRegion="polite"
    >
      {message}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  syncNoticeText: {
    marginTop: 4,
    color: colors.syncNoticeText,
    fontSize: 12,
    fontWeight: '500',
  },
});
