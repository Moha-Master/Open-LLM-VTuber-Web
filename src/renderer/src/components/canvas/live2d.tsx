/* eslint-disable no-shadow */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { memo, useRef, useEffect } from "react";
import { useLive2DConfig } from "@/context/live2d-config-context";
import { useIpcHandlers } from "@/hooks/utils/use-ipc-handlers";
import { useInterrupt } from "@/hooks/utils/use-interrupt";
import { useAudioTask } from "@/hooks/utils/use-audio-task";
import { useLive2DModel } from "@/hooks/canvas/use-live2d-model";
import { useLive2DResize } from "@/hooks/canvas/use-live2d-resize";
import { useAiState, AiStateEnum } from "@/context/ai-state-context";
import { useLive2DExpression } from '@/hooks/canvas/use-live2d-expression';
import { LAppLive2DManager } from '../../../WebSDK/src/lapplive2dmanager';
import { CubismMatrix44 } from '../../../WebSDK/Framework/src/math/cubismmatrix44';

interface Live2DProps {
  isPet: boolean;
}

export const Live2D = memo(({ isPet }: Live2DProps): JSX.Element => {
  const { isLoading, modelInfo, setModelInfo } = useLive2DConfig();
  const { isDragging, handlers } = useLive2DModel({ isPet, modelInfo });
  const containerRef = useRef<HTMLDivElement>(null);
  const { aiState } = useAiState();
  const { resetExpression, setExpression } = useLive2DExpression();
  const { canvasRef } = useLive2DResize({ containerRef, isPet, modelInfo });

  // Setup hooks
  useIpcHandlers({ isPet });
  useInterrupt();
  useAudioTask();

  // Expose expression functions to console for testing
  useEffect(() => {
    const lappAdapter = (window as any).getLAppAdapter?.();
    if (lappAdapter) {
      console.log('Expression functions exposed to console for testing');
      (window as any).testExpression = {
        setExpression: (value: string | number) => setExpression(value, lappAdapter, `Test set expression to: ${value}`),
        resetExpression: () => resetExpression(lappAdapter, modelInfo),
      };
    }
  }, [setExpression, resetExpression, modelInfo]);

  // Reset expression to default when AI state becomes idle
  useEffect(() => {
    if (aiState === AiStateEnum.IDLE) {
      const lappAdapter = (window as any).getLAppAdapter?.();
      if (lappAdapter) {
        resetExpression(lappAdapter, modelInfo);
      }
    }
  }, [aiState, modelInfo, resetExpression]);

  // Add test functions
  useEffect(() => {
    const lappAdapter = (window as any).getLAppAdapter?.();
    if (lappAdapter) {
      console.log('Model control functions exposed to console for testing');
      (window as any).testModel = {
        // Adjust model size while maintaining aspect ratio
        setWidth: (width: number) => {
          const model = lappAdapter.getModel();
          if (model) {
            model._modelMatrix.setWidth(width);
          }
        },
        setHeight: (height: number) => {
          const model = lappAdapter.getModel();
          if (model) {
            model._modelMatrix.setHeight(height);
          }
        },
        // Adjust model position
        setPosition: (x: number, y: number) => {
          const model = lappAdapter.getModel();
          if (model) {
            model._modelMatrix.setPosition(x, y);
          }
        },
        setCenterPosition: (x: number, y: number) => {
          const model = lappAdapter.getModel();
          if (model) {
            model._modelMatrix.setCenterPosition(x, y);
          }
        },
        // Scale model directly
        scale: (x: number, y: number) => {
          const model = lappAdapter.getModel();
          if (model) {
            model._modelMatrix.scale(x, y);
          }
        },
        // Scale model relative to current size
        scaleRelative: (x: number, y: number) => {
          const model = lappAdapter.getModel();
          if (model) {
            model._modelMatrix.scaleRelative(x, y);
          }
        },
        // Get current model information
        getModelInfo: () => {
          const model = lappAdapter.getModel();
          if (model) {
            return {
              canvasWidth: model.getModel().getCanvasWidth(),
              canvasHeight: model.getModel().getCanvasHeight(),
              matrix: model._modelMatrix.getArray(),
            };
          }
          return null;
        },
        // Add smooth scale method with animation
        smoothScale: (delta: number) => {
          const model = lappAdapter.getModel();
          if (model) {
            const currentScale = model._modelMatrix.getArray()[0];
            const targetScale = Math.max(0.5, Math.min(5.0, currentScale + delta));

            // Create animation function
            const animate = () => {
              const currentScale = model._modelMatrix.getArray()[0];
              const smoothScale = currentScale + (targetScale - currentScale) * 0.15;

              // Apply scale if the change is significant
              if (Math.abs(targetScale - currentScale) > 0.001) {
                // Update model matrix
                model._modelMatrix.scale(smoothScale, smoothScale);

                // Update view matrix
                const manager = LAppLive2DManager.getInstance();
                if (manager) {
                  const viewMatrix = new CubismMatrix44();
                  viewMatrix.scale(smoothScale, smoothScale);
                  manager.setViewMatrix(viewMatrix);
                }

                requestAnimationFrame(animate);
              }
            };

            // Start animation
            animate();
            return targetScale;
          }
          return null;
        },
        // Get and set initial scale
        getInitialScale: () => modelInfo?.initialScale || 1.0,
        setInitialScale: (scale: number) => {
          if (modelInfo) {
            setModelInfo({
              ...modelInfo,
              initialScale: scale,
            });
          }
        },
      };
    }
  }, [modelInfo, setModelInfo]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Allow the event to propagate to the Live2D hit testing
    handlers.onMouseDown(e);
  };

  return (
    <div
      ref={containerRef}
      id="live2d"
      style={{
        width: isPet ? "100vw" : "100%",
        height: isPet ? "100vh" : "100%",
        pointerEvents: "auto",
        overflow: "hidden",
        opacity: isLoading ? 0 : 1,
        transition: "opacity 0.3s ease-in-out",
        position: "relative",
        zIndex: 10,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onPointerDown={handlePointerDown}
      {...handlers}
    >
      <canvas
        id="canvas"
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: "auto",
          display: "block",
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      />
    </div>
  );
});

Live2D.displayName = "Live2D";

export { useInterrupt, useAudioTask };
