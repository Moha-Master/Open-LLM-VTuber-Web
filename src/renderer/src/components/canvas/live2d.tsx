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

interface Live2DProps {
  isPet: boolean;
}

export const Live2D = memo(({ isPet }: Live2DProps): JSX.Element => {
  const { isLoading, modelInfo } = useLive2DConfig();
  const { isDragging, handlers } = useLive2DModel({ isPet, modelInfo });
  const containerRef = useRef<HTMLDivElement>(null);
  const { aiState } = useAiState();
  const { resetExpression } = useLive2DExpression();
  const { canvasRef, isModelVisible } = useLive2DResize({ containerRef, isPet, modelInfo });

  // Setup hooks
  useIpcHandlers({ isPet });
  useInterrupt();
  useAudioTask();

  // Reset expression to default when AI state becomes idle
  useEffect(() => {
    if (aiState === AiStateEnum.IDLE) {
      const lappAdapter = (window as any).getLAppAdapter?.();
      if (lappAdapter) {
        resetExpression(lappAdapter, modelInfo);
      }
    }
  }, [aiState, modelInfo, resetExpression]);

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
        opacity: isLoading || !isModelVisible ? 0 : 1,
        // transition: "opacity 0.3s ease-in-out",
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
