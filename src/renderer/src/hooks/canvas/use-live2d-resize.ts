/* eslint-disable no-underscore-dangle */
import { useEffect, useCallback, RefObject } from 'react';
import { ModelInfo } from '@/context/live2d-config-context';
import { LAppDelegate } from '../../../live2d/lappdelegate';
import { LAppLive2DManager } from '../../../live2d/lapplive2dmanager';
import { CubismMatrix44 } from '../../../Framework/src/math/cubismmatrix44';

interface UseLive2DResizeProps {
  containerRef: RefObject<HTMLDivElement>;
  isPet: boolean;
  modelInfo?: ModelInfo;
}

/**
 * Hook to handle Live2D model resizing and scaling
 */
export const useLive2DResize = ({
  containerRef,
  isPet,
  modelInfo,
}: UseLive2DResizeProps) => {
  // Resize handler function
  const handleResize = useCallback(() => {
    if (!containerRef.current) return;

    // Calculate dimensions based on mode (pet or normal)
    const { width, height } = isPet
      ? { width: window.innerWidth, height: window.innerHeight }
      : containerRef.current.getBoundingClientRect();

    // Setup canvas with proper dimensions
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) return;

    // Update canvas size with device pixel ratio for retina displays
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;

    // Initialize Live2D delegate and handle basic resize
    const delegate = LAppDelegate.getInstance();
    if (delegate) {
      delegate.onResize();

      // Create and configure view matrix for model scaling
      const viewMatrix = new CubismMatrix44();
      const scale = Number(modelInfo?.kScale || 1.0);
      viewMatrix.scale(scale, scale);

      // Apply view matrix to Live2D manager
      const manager = LAppLive2DManager.getInstance();
      if (manager) {
        manager.setViewMatrix(viewMatrix);
      }
    }
  }, [isPet, modelInfo?.kScale]);

  // Setup resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    // Initial resize with delay for canvas initialization
    const initialResizeTimer = setTimeout(() => {
      handleResize();
    }, 200);

    // Create and attach resize observer
    const observer = new ResizeObserver(() => {
      handleResize();
    });

    observer.observe(containerRef.current);

    // Cleanup function
    return () => {
      clearTimeout(initialResizeTimer);
      observer.disconnect();
    };
  }, [handleResize]);

  // Handle window resize events in pet mode
  useEffect(() => {
    if (!isPet) return;

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isPet, handleResize]);

  return {
    handleResize,
  };
};

/**
 * Helper function to set model scale with device pixel ratio consideration
 */
export const setModelScale = (
  model: any,
  kScale: string | number | undefined,
) => {
  if (!model || !kScale) return;
  const scale = Number(kScale) * window.devicePixelRatio;
  model.setScale(scale);
};

/**
 * Helper function to center model in container with optional offset
 */
export const resetModelPosition = (
  model: any,
  width: number,
  height: number,
  initialXshift: number | undefined,
  initialYshift: number | undefined,
) => {
  if (!model) return;
  const initXshift = Number(initialXshift || 0);
  const initYshift = Number(initialYshift || 0);
  const centerX = width / 2 + initXshift;
  const centerY = height / 2 + initYshift;
  model.setPosition(centerX, centerY);
};
