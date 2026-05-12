import React, { useEffect } from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Track is 72% of screen width, capped for tablets
const TRACK_WIDTH = Math.min(SCREEN_WIDTH * 0.72, 300);
// Moving fill is 50% of the track so it visibly sweeps across
const FILL_WIDTH = TRACK_WIDTH * 0.5;

export default function LoadingScreen({ navigation }) {
  const screenOpacity = useSharedValue(0);
  const barX = useSharedValue(-FILL_WIDTH);

  useEffect(() => {
    // Fade the whole screen in on mount
    screenOpacity.value = withTiming(1, {
      duration: 750,
      easing: Easing.out(Easing.cubic),
    });

    // Sweep the bar from left to right, then instantly reset and repeat
    barX.value = withRepeat(
      withSequence(
        withTiming(TRACK_WIDTH, {
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
        }),
        // Instant reset — bar is off-screen at both endpoints so the jump is invisible
        withTiming(-FILL_WIDTH, { duration: 1 }),
      ),
      -1,   // infinite
      false,
    );

    // Navigate to Login after 3 seconds
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: barX.value }],
  }));

  return (
    <Animated.View style={[s.root, screenStyle]}>
      <ImageBackground
        source={require('../../assets/splash2.png')}
        style={s.background}
        resizeMode="cover"
      >
        {/* Gradient veil at the bottom — lifts bar/text off any background */}
        <View style={s.overlay} pointerEvents="none">
          <LinearGradient
            colors={['transparent', 'rgba(0,10,35,0.62)']}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <SafeAreaView style={s.safe} edges={['bottom']}>
          <View style={s.bottom}>

            {/* ── Loading bar ── */}
            <View style={s.trackGlow}>
              <View style={s.track}>
                <Animated.View style={[s.fillWrap, fillStyle]}>
                  <LinearGradient
                    colors={[
                      'transparent',
                      'rgba(0,150,255,0.45)',
                      '#0099FF',
                      '#00D48A',
                      '#0099FF',
                      'rgba(0,150,255,0.45)',
                      'transparent',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.fill}
                  />
                </Animated.View>
              </View>
            </View>

            <Text style={s.label}>Preparing LottoMeter...</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    // Shown briefly while the image loads; matches a dark splash tone
    backgroundColor: '#00143A',
  },

  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.38,
  },

  safe: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  bottom: {
    alignItems: 'center',
    paddingBottom: 54,
    gap: 14,
  },

  // Wrapper for the iOS glow shadow (must sit outside overflow:hidden track)
  trackGlow: {
    shadowColor: '#0099FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 14,
    elevation: 10, // Android elevation tint approximates the glow
  },

  track: {
    width: TRACK_WIDTH,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 3,
    overflow: 'hidden', // clips the moving fill
  },

  fillWrap: {
    width: FILL_WIDTH,
    height: '100%',
  },

  fill: {
    flex: 1,
    borderRadius: 3,
  },

  label: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 0.4,
  },
});
