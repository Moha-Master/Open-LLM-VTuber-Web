/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-underscore-dangle */
import { useEffect, useCallback, RefObject, useRef, useState } from 'react';
import { ModelInfo, useLive2DConfig } from '@/context/live2d-config-context';
import { LAppDelegate } from '../../../WebSDK/src/lappdelegate';
import { LAppLive2DManager } from '../../../WebSDK/src/lapplive2dmanager';
import { CubismMatrix44 } from '../../../WebSDK/Framework/src/math/cubismmatrix44';

// Constants for model scaling behavior
const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;
const EASING_FACTOR = 0.1; // Controls animation smoothness
const EASING_THRESHOLD = 0.0001; // Minimum scale difference to continue animation
const WHEEL_SCALE_STEP = 0.03; // Scale change per wheel tick
const DEFAULT_SCALE = 1.0; // Default scale if not specified

interface UseLive2DResizeProps {
  containerRef: RefObject<HTMLDivElement>;
  isPet: boolean;
  modelInfo?: ModelInfo;
}

/**
 * Applies scale to both model and view matrices
 * @param scale - The scale value to apply
 */
export const applyScale = (scale: number) => {
  try {
    const manager = LAppLive2DManager.getInstance();
    if (!manager) return;

    const model = manager.getModel(0);
    if (!model) return;

    // Update model matrix
    // @ts-ignore
    model._modelMatrix.scale(scale, scale);

    // Update view matrix
    const viewMatrix = new CubismMatrix44();
    viewMatrix.scale(scale, scale);
    manager.setViewMatrix(viewMatrix);

    console.log('Applied scale:', scale);
  } catch (error) {
    console.debug('Model not ready for scaling yet');
  }
};

/**
 * Hook to handle Live2D model resizing and scaling
 * Provides smooth scaling animation and window resize handling
 */
export const useLive2DResize = ({
  containerRef,
  isPet,
  modelInfo,
}: UseLive2DResizeProps) => {
  const { updateModelScale } = useLive2DConfig();
  const scaleUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize scale references
  const initialScale = modelInfo?.kScale || DEFAULT_SCALE;
  const lastScaleRef = useRef<number>(initialScale);
  const targetScaleRef = useRef<number>(initialScale);
  const animationFrameRef = useRef<number>();
  const isAnimatingRef = useRef<boolean>(false);
  const hasAppliedInitialScale = useRef<boolean>(false);

  // Track model visibility state
  const [isModelVisible, setIsModelVisible] = useState(false);

  // Monitor modelInfo changes for initial scaling and visibility
  useEffect(() => {
    if (modelInfo) {
      // Hide model immediately when URL changes
      setIsModelVisible(false);
      console.log(
        "Model info changed, applying initial scale:",
        modelInfo.kScale || DEFAULT_SCALE,
      );
      const scale = modelInfo.kScale || DEFAULT_SCALE;
      lastScaleRef.current = scale;
      targetScaleRef.current = scale;

      // Apply initial scale and show model after delay
      const timer = setTimeout(() => {
        applyScale(scale);
        hasAppliedInitialScale.current = true;
        updateModelScale(scale);
        setTimeout(() => {
          setIsModelVisible(true);
        }, 100);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [modelInfo?.url]);

  /**
   * Smooth animation loop for scaling
   * Uses linear interpolation for smooth transitions
   */
  const animateEase = useCallback(() => {
    const currentScale = lastScaleRef.current;
    const targetScale = targetScaleRef.current;
    const diff = targetScale - currentScale;

    // Calculate new scale with easing
    const newScale = currentScale + diff * EASING_FACTOR;
    applyScale(newScale);
    lastScaleRef.current = newScale;

    // Continue animation if not close enough to target
    if (Math.abs(diff) > EASING_THRESHOLD) {
      animationFrameRef.current = requestAnimationFrame(animateEase);
    } else {
      // Finalize animation
      applyScale(targetScale);
      updateModelScale(targetScale);
      isAnimatingRef.current = false;
    }
  }, [updateModelScale]);

  /**
   * Handles mouse wheel events for scaling
   * Initiates smooth scaling animation
   */
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!modelInfo?.scrollToResize) return;

    const direction = e.deltaY > 0 ? -1 : 1;
    const increment = WHEEL_SCALE_STEP * direction;

    // Calculate new target scale
    const currentTarget = targetScaleRef.current;
    const newTargetScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, currentTarget + increment),
    );
    targetScaleRef.current = newTargetScale;

    // Start animation if not already running
    if (!isAnimatingRef.current) {
      isAnimatingRef.current = true;
      animationFrameRef.current = requestAnimationFrame(animateEase);
    }
  }, [modelInfo?.scrollToResize, animateEase]);

  /**
   * Handles window/container resize events
   * Updates canvas dimensions and model scaling
   */
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Get dimensions based on mode
      const { width, height } = isPet
        ? { width: window.innerWidth, height: window.innerHeight }
        : containerRef.current?.getBoundingClientRect() || { width: 0, height: 0 };

      // Update canvas dimensions
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;

      // Update Live2D delegate and view matrix
      const delegate = LAppDelegate.getInstance();
      if (delegate) {
        delegate.onResize();

        const viewMatrix = new CubismMatrix44();
        const scale = hasAppliedInitialScale.current ? lastScaleRef.current : initialScale;
        viewMatrix.scale(scale, scale);

        const manager = LAppLive2DManager.getInstance();
        if (manager) {
          manager.setViewMatrix(viewMatrix);
        }
      }
    } catch (error) {
      console.debug('Model not ready for resize yet');
    }
  }, [isPet, lastScaleRef.current, initialScale]);

  // Set up event listeners and cleanup
  useEffect(() => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
    return undefined;
  }, [handleWheel, containerRef]);

  // Clean up animations on unmount
  useEffect(() => () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (scaleUpdateTimeout.current) {
      clearTimeout(scaleUpdateTimeout.current);
    }
  }, []);

  // Initialize resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const initialResizeTimer = setTimeout(handleResize, 200);
    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      clearTimeout(initialResizeTimer);
      observer.disconnect();
    };
  }, [handleResize]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return { canvasRef, handleResize, isModelVisible };
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
