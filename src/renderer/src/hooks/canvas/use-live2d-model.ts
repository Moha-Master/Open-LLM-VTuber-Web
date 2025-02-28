/* eslint-disable no-underscore-dangle */
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
import { updateModelConfig } from '../../../WebSDK/src/lappdefine';
import { LAppDelegate } from '../../../WebSDK/src/lappdelegate';

interface UseLive2DModelProps {
  isPet: boolean;
  modelInfo: ModelInfo | undefined;
}

interface Position {
  x: number;
  y: number;
}

// Helper function to parse model URL and reload model
function parseModelUrl(url: string): { baseUrl: string; modelDir: string; modelFileName: string } {
  try {
    console.log('Parsing URL:', url);
    const urlObj = new URL(url);
    const { pathname } = urlObj;

    // Find the last slash
    const lastSlashIndex = pathname.lastIndexOf('/');
    if (lastSlashIndex === -1) {
      throw new Error('Invalid model URL format');
    }

    // Get full file name with extension (e.g., "name2.model3.json")
    const fullFileName = pathname.substring(lastSlashIndex + 1);

    // Extract model file name without extension (e.g., "name2")
    const modelFileName = fullFileName.replace('.model3.json', '');

    // Find the second to last slash
    const secondLastSlashIndex = pathname.lastIndexOf('/', lastSlashIndex - 1);
    if (secondLastSlashIndex === -1) {
      throw new Error('Invalid model URL format');
    }

    // Extract model directory - it's between the last two slashes
    const modelDir = pathname.substring(secondLastSlashIndex + 1, lastSlashIndex);

    // Base URL is everything up to the model directory
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${pathname.substring(0, secondLastSlashIndex + 1)}`;

    console.log('Parsed URL successfully:', { baseUrl, modelDir, modelFileName });
    return { baseUrl, modelDir, modelFileName };
  } catch (error) {
    console.error('Error parsing model URL:', error);
    return { baseUrl: '', modelDir: '', modelFileName: '' };
  }
}

/**
 * Helper function to play audio and sync lip movement
 * @param audioPath Path to audio file relative to Resources directory
 * @param modelIndex Index of the model to animate (usually 0)
 * @returns Promise that resolves when audio ends or rejects on error
 */
export const playAudioWithLipSync = (audioPath: string, modelIndex = 0): Promise<void> => new Promise((resolve, reject) => {
  // Check if Live2D manager is available
  // @ts-ignore
  const live2dManager = window.LAppLive2DManager?.getInstance();
  if (!live2dManager) {
    reject(new Error('Live2D manager not initialized'));
    return;
  }

  // Build full path
  const fullPath = `/Resources/${audioPath}`;

  // Create audio element
  const audio = new Audio(fullPath);

  // Set up event handlers
  audio.addEventListener('canplaythrough', () => {
    console.log(`Playing audio: ${fullPath}`);

    // Get model and start lip sync
    const model = live2dManager.getModel(modelIndex);
    if (model) {
      // @ts-ignore - Start lip sync with the audio file
      if (model._wavFileHandler) {
        // @ts-ignore
        model._wavFileHandler.start(fullPath);

        // Start playing audio
        audio.play();
      } else {
        reject(new Error('Wav file handler not available on model'));
      }
    } else {
      reject(new Error(`Model index ${modelIndex} not found`));
    }
  });

  audio.addEventListener('ended', () => {
    console.log('Audio playback completed');
    resolve();
  });

  audio.addEventListener('error', () => {
    reject(new Error(`Failed to load audio: ${fullPath}`));
  });

  // Start loading the audio
  audio.load();
});

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
  const modelStartPos = useRef<Position>({ x: 0, y: 0 });

  // Store reference to model's initial position
  const modelPositionRef = useRef<Position>({ x: 0, y: 0 });

  // Keep track of the previous model URL
  const prevModelUrlRef = useRef<string | null>(null);

  // Initialize Live2D SDK
  useEffect(() => {
    // Load Live2D initialization script
    const script = document.createElement('script');
    script.src = './WebSDK/src/main.ts';
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

  useEffect(() => {
    if (modelInfo?.url && modelInfo.url !== prevModelUrlRef.current) {
      console.log('Model URL changed. New URL:', modelInfo.url);
      prevModelUrlRef.current = modelInfo.url;

      try {
        // Parse URL
        const { baseUrl, modelDir, modelFileName } = parseModelUrl(modelInfo.url);

        if (baseUrl && modelDir) {
          console.log('Updating model config and reloading model:', { baseUrl, modelDir, modelFileName });

          // Update model configuration
          updateModelConfig(baseUrl, modelDir, modelFileName);

          // Force model reload by reinitializing Live2D
          setTimeout(() => {
            if ((window as any).initializeLive2D) {
              console.log('Reinitializing Live2D...');

              // First release existing resources
              if ((window as any).LAppLive2DManager &&
                  (window as any).LAppLive2DManager.releaseInstance) {
                (window as any).LAppLive2DManager.releaseInstance();
              }

              // Then reinitialize
              (window as any).initializeLive2D();
            } else {
              console.error('initializeLive2D function not found');
            }
          }, 100); // Short delay to ensure config is updated
        }
      } catch (error) {
        console.error('Error processing model URL:', error);
      }
    }
  }, [modelInfo?.url]);

  // Get and save current model position
  const getModelPosition = useCallback(() => {
    const adapter = (window as any).getLAppAdapter?.();
    if (adapter) {
      const model = adapter.getModel();
      if (model && model._modelMatrix) {
        // Access matrix values directly
        // The translation is typically in elements [12] and [13] of the 4x4 matrix
        const matrix = model._modelMatrix.getArray();
        return {
          x: matrix[12],
          y: matrix[13],
        };
      }
    }
    return { x: 0, y: 0 };
  }, []);

  // Set model position function
  const setModelPosition = useCallback((x: number, y: number) => {
    const adapter = (window as any).getLAppAdapter?.();
    if (adapter) {
      const model = adapter.getModel();
      if (model && model._modelMatrix) {
        // Store current values
        const matrix = model._modelMatrix.getArray();

        // Create a new matrix with updated positions
        const newMatrix = [...matrix];
        newMatrix[12] = x;
        newMatrix[13] = y;

        // Set the matrix
        model._modelMatrix.setMatrix(newMatrix);

        // Save current position to reference
        modelPositionRef.current = { x, y };
      }
    }
  }, []);

  // Initialize to get current model position
  useEffect(() => {
    // Short delay to ensure model is loaded
    const timer = setTimeout(() => {
      const currentPos = getModelPosition();
      modelPositionRef.current = currentPos;
      setPosition(currentPos);
    }, 500);

    return () => clearTimeout(timer);
  }, [modelInfo?.url, getModelPosition]);

  // Get canvas dimensions and scale ratio
  const getCanvasScale = useCallback(() => {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) return { width: 1, height: 1, scale: 1 };

    const { width } = canvas;
    const { height } = canvas;
    const scale = width / canvas.clientWidth; // Get actual device pixel ratio

    return { width, height, scale };
  }, []);

  // Convert screen coordinates to model coordinates
  const screenToModelPosition = useCallback((screenX: number, screenY: number) => {
    const { width, height, scale } = getCanvasScale();

    // Convert screen coordinates to range -1 to 1
    const x = ((screenX * scale) / width) * 2 - 1;
    const y = -((screenY * scale) / height) * 2 + 1;

    return { x, y };
  }, [getCanvasScale]);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const adapter = (window as any).getLAppAdapter?.();
    if (adapter) {
      const model = adapter.getModel();
      const view = LAppDelegate.getInstance().getView();

      if (!view || !model) return;

      const canvas = document.getElementById('canvas') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const scale = canvas.width / canvas.clientWidth;
      const scaledX = x * scale;
      const scaledY = y * scale;
      const modelX = view._deviceToScreen.transformX(scaledX);
      const modelY = view._deviceToScreen.transformY(scaledY);

      // Check both hit areas and model bounds
      const isHitArea = model.anyhitTest(modelX, modelY);
      const isHitModel = model.isHitOnModel(modelX, modelY);

      // Allow dragging if either test passes
      if (isHitArea || isHitModel) {
        setIsDragging(true);
        dragStartPos.current = { x, y };

        if (model._modelMatrix) {
          const matrix = model._modelMatrix.getArray();
          const currentPos = {
            x: matrix[12],
            y: matrix[13],
          };
          modelStartPos.current = currentPos;
          modelPositionRef.current = currentPos;
        }
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;

    const adapter = (window as any).getLAppAdapter?.();
    if (!adapter) return;

    const model = adapter.getModel();
    const view = LAppDelegate.getInstance().getView();
    if (!view || !model) return;

    // Get current mouse position in canvas
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // Convert both start and current positions to model coordinates
    const scale = canvas.width / canvas.clientWidth;

    // Convert start position
    const startScaledX = dragStartPos.current.x * scale;
    const startScaledY = dragStartPos.current.y * scale;
    const startModelX = view._deviceToScreen.transformX(startScaledX);
    const startModelY = view._deviceToScreen.transformY(startScaledY);

    // Convert current position
    const currentScaledX = currentX * scale;
    const currentScaledY = currentY * scale;
    const currentModelX = view._deviceToScreen.transformX(currentScaledX);
    const currentModelY = view._deviceToScreen.transformY(currentScaledY);

    // Calculate the difference in model coordinates
    const dx = currentModelX - startModelX;
    const dy = currentModelY - startModelY;

    // Calculate new position by adding the difference to the start position
    const newX = modelStartPos.current.x + dx;
    const newY = modelStartPos.current.y + dy;

    // Update model position
    adapter.setModelPosition(newX, newY);
    modelPositionRef.current = { x: newX, y: newY };
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // Save final position when releasing mouse
    const adapter = (window as any).getLAppAdapter?.();
    if (adapter) {
      const model = adapter.getModel();
      if (model && model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();
        const finalPos = {
          x: matrix[12],
          y: matrix[13],
        };
        modelPositionRef.current = finalPos;
        modelStartPos.current = finalPos;
        setPosition(finalPos);
      }
    }
  }, []);

  return {
    position,
    isDragging,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseUp, // Ensure position is saved when mouse leaves
    },
  };
};
