import React, { useRef, useEffect } from "react";
import { Animated, Easing, Dimensions, View, StyleSheet } from "react-native";
import Svg, { Path, Circle, G } from "react-native-svg";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { ServerLocation } from "@privacy-shield/core/src/shared";

const worldData = require("../assets/countries-110m.json");
const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ThemeName = "dark" | "light" | "vaporwave" | "frutiger-aero";

const THEME_MAP_COLORS: Record<ThemeName, { fill: string; stroke: string; accent: string }> = {
  dark: { fill: "#1e293b", stroke: "#334155", accent: "#00e5ff" },
  light: { fill: "#cbd5e1", stroke: "#94a3b8", accent: "#2563eb" },
  vaporwave: { fill: "#3c096c", stroke: "#7b2d8e", accent: "#ff00ff" },
  "frutiger-aero": { fill: "#bae6fd", stroke: "#38bdf8", accent: "#22c55e" },
};

interface WorldMapProps {
  servers: ServerLocation[];
  selectedServer: ServerLocation | null;
  isConnected: boolean;
  theme: ThemeName;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const WorldMap: React.FC<WorldMapProps> = ({
  servers,
  selectedServer,
  isConnected,
  theme,
}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const colors = THEME_MAP_COLORS[theme] || THEME_MAP_COLORS.dark;
  const mapWidth = SCREEN_WIDTH;
  const mapHeight = mapWidth * 0.55;

  const projection = geoNaturalEarth1()
    .fitSize([mapWidth, mapHeight], { type: "Sphere" } as any)
    .translate([mapWidth / 2, mapHeight / 2]);

  const pathGenerator = geoPath().projection(projection);

  const countries = feature(worldData, worldData.objects.countries) as any;
  const paths: string[] = countries.features.map((f: any) => pathGenerator(f) || "");

  const glowRadius = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 14],
  });
  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.2, 0.6],
  });

  return (
    <View style={styles.container}>
      <Svg width={mapWidth} height={mapHeight} viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
        <G>
          {paths.map((d, i) =>
            d ? (
              <Path
                key={i}
                d={d}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={0.5}
              />
            ) : null
          )}
        </G>

        {servers.map((server) => {
          const coords = projection([server.coordinates.lng, server.coordinates.lat]);
          if (!coords) return null;
          const [x, y] = coords;
          const isSelected = selectedServer?.id === server.id;

          return (
            <G key={server.id}>
              {isSelected && isConnected && (
                <AnimatedCircle
                  cx={x}
                  cy={y}
                  r={glowRadius as any}
                  fill={colors.accent}
                  opacity={glowOpacity as any}
                />
              )}
              <Circle
                cx={x}
                cy={y}
                r={isSelected ? 4 : 2.5}
                fill={isSelected ? colors.accent : "#64748b"}
                opacity={isSelected ? 1 : 0.5}
              />
            </G>
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
});
