"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  shape: "pyramid" | "circle" | "square";
  opacity: number;
}

interface ConfettiProps {
  active: boolean;
  duration?: number;
  particleCount?: number;
  onComplete?: () => void;
}

// Brand colors: toxic mint, gold, white
const COLORS = [
  "hsl(160, 84%, 50%)",  // Primary mint
  "hsl(160, 84%, 60%)",  // Light mint
  "hsl(45, 100%, 50%)",  // Gold
  "hsl(45, 100%, 65%)",  // Light gold
  "hsl(210, 20%, 92%)",  // White/foreground
];

export function Confetti({
  active,
  duration = 3000,
  particleCount = 80,
  onComplete
}: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [isRunning, setIsRunning] = useState(false);

  const createParticle = useCallback((canvasWidth: number): Particle => {
    const shapes: Array<"pyramid" | "circle" | "square"> = ["pyramid", "pyramid", "pyramid", "circle", "square"];
    return {
      x: Math.random() * canvasWidth,
      y: -20,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      size: Math.random() * 8 + 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      opacity: 1,
    };
  }, []);

  const drawPyramid = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    rotation: number,
    color: string,
    opacity: number
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(-size * 0.866, size * 0.5);
    ctx.lineTo(size * 0.866, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawCircle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    opacity: number
  ) => {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawSquare = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    rotation: number,
    color: string,
    opacity: number
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  };

  useEffect(() => {
    if (!active || isRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onComplete?.();
      return;
    }

    setIsRunning(true);
    startTimeRef.current = performance.now();

    // Set canvas size
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateCanvasSize();

    // Create initial particles
    particlesRef.current = Array.from({ length: particleCount }, () =>
      createParticle(canvas.width)
    );

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((particle) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.1; // Gravity
        particle.rotation += particle.rotationSpeed;

        // Add sway
        particle.x += Math.sin(particle.y * 0.02) * 0.5;

        // Fade out towards the end
        if (progress > 0.7) {
          particle.opacity = Math.max(0, 1 - (progress - 0.7) / 0.3);
        }

        // Draw based on shape
        switch (particle.shape) {
          case "pyramid":
            drawPyramid(ctx, particle.x, particle.y, particle.size, particle.rotation, particle.color, particle.opacity);
            break;
          case "circle":
            drawCircle(ctx, particle.x, particle.y, particle.size, particle.color, particle.opacity);
            break;
          case "square":
            drawSquare(ctx, particle.x, particle.y, particle.size, particle.rotation, particle.color, particle.opacity);
            break;
        }

        // Remove if off screen
        return particle.y < canvas.height + 50 && particle.opacity > 0;
      });

      // Continue animation or end
      if (progress < 1 && particlesRef.current.length > 0) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsRunning(false);
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [active, duration, particleCount, createParticle, onComplete, isRunning]);

  // Reset when active changes to false
  useEffect(() => {
    if (!active) {
      setIsRunning(false);
    }
  }, [active]);

  if (!active && !isRunning) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[200] pointer-events-none"
      aria-hidden="true"
    />
  );
}
