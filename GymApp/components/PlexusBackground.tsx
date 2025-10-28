import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const MAX_DISTANCE = 150; // Distanza massima per connettere le particelle

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export default function PlexusBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Crea particelle iniziali
    const newParticles: Particle[] = [];
    for (let i = 0; i < 40; i++) {
      newParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
      });
    }
    setParticles(newParticles);

    // Animazione continua
    const animate = () => {
      setParticles((prev) =>
        prev.map((p) => {
          let newX = p.x + p.vx;
          let newY = p.y + p.vy;
          let newVx = p.vx;
          let newVy = p.vy;

          // Rimbalzo sui bordi
          if (newX <= 0 || newX >= width) {
            newVx *= -1;
            newX = Math.max(0, Math.min(width, newX));
          }
          if (newY <= 0 || newY >= height) {
            newVy *= -1;
            newY = Math.max(0, Math.min(height, newY));
          }

          return { x: newX, y: newY, vx: newVx, vy: newVy };
        })
      );

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current !== undefined) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const getDistance = (p1: Particle, p2: Particle) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width={width} height={height}>
        {/* Linee tra particelle vicine */}
        {particles.map((p1, i) =>
          particles.slice(i + 1).map((p2, j) => {
            const distance = getDistance(p1, p2);
            if (distance < MAX_DISTANCE) {
              const opacity = (1 - distance / MAX_DISTANCE) * 0.3;
              return (
                <Line
                  key={`line-${i}-${j}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={`rgba(122, 160, 255, ${opacity})`}
                  strokeWidth="1"
                />
              );
            }
            return null;
          })
        )}
        
        {/* Particelle */}
        {particles.map((p, i) => (
          <Circle
            key={`particle-${i}`}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="rgba(122, 160, 255, 0.6)"
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
});
