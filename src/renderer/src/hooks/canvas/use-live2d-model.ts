/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-use-before-define */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
import { useEffect, useRef, useCallback, useState } from "react";
import { ModelInfo, useLive2DConfig } from "@/context/live2d-config-context";
import { useLive2DModel as useModelContext } from "@/context/live2d-model-context";
import { AiStateEnum, useAiState } from "@/context/ai-state-context";
import { toaster } from "@/components/ui/toaster";

interface UseLive2DModelProps {
  isPet: boolean;
  modelInfo: ModelInfo | undefined;
}

interface Position {
  x: number;
  y: number;
}

/**
 * Hook to handle Live2D model initialization and dragging
 */
export const useLive2DModel = ({
  isPet,
  modelInfo,
}: UseLive2DModelProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const elementStartPos = useRef<Position>({ x: 0, y: 0 });

  // Initialize Live2D SDK
  useEffect(() => {
    // Load Live2D initialization script
    const script = document.createElement('script');
    script.src = './live2d/main.ts';
    script.type = 'module';

    script.onload = () => {
      // Initialize Live2D after script is loaded
      if ((window as any).initializeLive2D) {
        (window as any).initializeLive2D();
      }
    };

    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const existingScripts = document.head.querySelectorAll('script[src*="live2d"]');
      existingScripts.forEach((scriptElement) => {
        document.head.removeChild(scriptElement);
      });
    };
  }, []);

  // Dragging handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    elementStartPos.current = position;
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;

    setPosition({
      x: elementStartPos.current.x + dx,
      y: elementStartPos.current.y + dy,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {
    position,
    isDragging,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseUp,
    },
  };
};
