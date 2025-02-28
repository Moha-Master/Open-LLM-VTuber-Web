/* eslint-disable func-names */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useRef, useEffect } from 'react';
import { useAiState } from '@/context/ai-state-context';
import { useSubtitle } from '@/context/subtitle-context';
import { useChatHistory } from '@/context/chat-history-context';
import { audioTaskQueue } from '@/utils/task-queue';
import { toaster } from '@/components/ui/toaster';
import { useWebSocket } from '@/context/websocket-context';
import { DisplayText } from '@/services/websocket-service';
import { useLive2DExpression } from '@/hooks/canvas/use-live2d-expression';

interface AudioTaskOptions {
  audioBase64: string
  volumes: number[]
  sliceLength: number
  displayText?: DisplayText | null
  expressions?: string[] | number[] | null
  speaker_uid?: string
  forwarded?: boolean
}

/**
 * Custom hook for handling audio playback tasks with Live2D lip sync
 */
export const useAudioTask = () => {
  const { aiState, backendSynthComplete, setBackendSynthComplete } = useAiState();
  const { setSubtitleText } = useSubtitle();
  const { appendResponse, appendAIMessage } = useChatHistory();
  const { sendMessage } = useWebSocket();
  const { setExpression } = useLive2DExpression();

  // Keep track of state in a ref to avoid stale closures
  const stateRef = useRef({
    aiState,
    setSubtitleText,
    appendResponse,
    appendAIMessage,
  });

  stateRef.current = {
    aiState,
    setSubtitleText,
    appendResponse,
    appendAIMessage,
  };

  /**
   * Handle audio playback with Live2D lip sync
   * @param options Audio task options including base64 audio data
   */
  const handleAudioPlayback = (options: AudioTaskOptions): Promise<void> => new Promise((resolve) => {
    const {
      aiState: currentAiState,
      setSubtitleText: updateSubtitle,
      appendResponse: appendText,
      appendAIMessage: appendAI,
    } = stateRef.current;

    // Check if playback is blocked
    if (currentAiState === 'interrupted') {
      console.error('Audio playback blocked. State:', currentAiState);
      resolve();
      return;
    }

    const { audioBase64, displayText, expressions, forwarded } = options;

    // Handle display text updates
    if (displayText) {
      appendText(displayText.text);
      appendAI(displayText.text, displayText.name, displayText.avatar);
      if (audioBase64) {
        updateSubtitle(displayText.text);
      }
      if (!forwarded) {
        sendMessage({
          type: "audio-play-start",
          display_text: displayText,
          forwarded: true,
        });
      }
    }

    try {
      // Create audio element and set up base64 data
      if (audioBase64) {
        const audioDataUrl = `data:audio/wav;base64,${audioBase64}`;

        // Get Live2D manager instance
        const live2dManager = (window as any).getLive2DManager?.();
        if (!live2dManager) {
          console.error('Live2D manager not found');
          resolve();
          return;
        }

        const model = live2dManager.getModel(0);
        if (!model) {
          console.error('Live2D model not found');
          resolve();
          return;
        }

        // Get LAppAdapter instance for expression handling
        const lappAdapter = (window as any).getLAppAdapter?.();
        if (!lappAdapter) {
          console.error('LAppAdapter not found');
        }

        // Set expression if provided using LAppAdapter
        if (expressions?.[0] !== undefined && lappAdapter) {
          setExpression(
            expressions[0],
            lappAdapter,
            `Set expression to: ${expressions[0]}`,
          );
        }

        // Create and set up audio element
        const audio = new Audio(audioDataUrl);
        let isFinished = false;

        // Apply enhanced lip sync to all models
        const lipSyncScale = 2.0; // Increase sensitivity for all models

        audio.addEventListener('canplaythrough', () => {
          console.log('Starting audio playback with lip sync');
          audio.play();

          // Start lip sync
          if (model._wavFileHandler) {
            // Initialize enhanced handling for all models
            if (!model._wavFileHandler._initialized) {
              console.log('Applying enhanced lip sync handling for model');
              model._wavFileHandler._initialized = true;

              const originalUpdate = model._wavFileHandler.update.bind(model._wavFileHandler);
              model._wavFileHandler.update = function (deltaTimeSeconds: number) {
                const result = originalUpdate(deltaTimeSeconds);
                // Amplify RMS value to make mouth movements more pronounced
                this._lastRms = Math.min(2.0, this._lastRms * lipSyncScale);
                return result;
              };
            }

            model._wavFileHandler.start(audioDataUrl);
          } else {
            console.warn('Wave file handler not available for lip sync');
          }
        });

        audio.addEventListener('ended', () => {
          console.log("Audio playback completed");
          isFinished = true;
          resolve();
        });

        audio.addEventListener('error', (error) => {
          console.error("Audio playback error:", error);
          isFinished = true;
          resolve();
        });

        // Load the audio
        audio.load();

        // Check playback status
        const checkFinished = () => {
          if (!isFinished) {
            setTimeout(checkFinished, 100);
          }
        };
        checkFinished();
      } else {
        resolve();
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      toaster.create({
        title: `Audio playback error: ${error}`,
        type: "error",
        duration: 2000,
      });
      resolve();
    }
  });

  // Handle backend synthesis completion
  useEffect(() => {
    let isMounted = true;

    const handleComplete = async () => {
      await audioTaskQueue.waitForCompletion();
      if (isMounted && backendSynthComplete) {
        sendMessage({ type: "frontend-playback-complete" });
        setBackendSynthComplete(false);
      }
    };

    handleComplete();

    return () => {
      isMounted = false;
    };
  }, [backendSynthComplete, sendMessage, setBackendSynthComplete]);

  /**
   * Add a new audio task to the queue
   * @param options Audio task options
   */
  const addAudioTask = async (options: AudioTaskOptions) => {
    const { aiState: currentState } = stateRef.current;

    if (currentState === 'interrupted') {
      console.log('Skipping audio task due to interrupted state');
      return;
    }

    console.log(`Adding audio task ${options.displayText?.text} to queue`);
    audioTaskQueue.addTask(() => handleAudioPlayback(options));
  };

  return {
    addAudioTask,
    appendResponse,
  };
};
