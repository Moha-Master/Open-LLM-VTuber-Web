/* eslint-disable no-underscore-dangle */
/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppDelegate } from './lappdelegate';
import * as LAppDefine from './lappdefine';
import { LAppGlManager } from './lappglmanager';
import { LAppLive2DManager } from './lapplive2dmanager';

/**
 * Initialize the Live2D application
 */
export function initializeLive2D(): void {
  console.log('[DEBUG] Initializing Live2D manually');

  const canvasElement = document.getElementById('canvas') as HTMLCanvasElement;
  if (canvasElement) {
    console.log('[DEBUG] Canvas dimensions:', {
      clientWidth: canvasElement.clientWidth,
      clientHeight: canvasElement.clientHeight,
      offsetWidth: canvasElement.offsetWidth,
      offsetHeight: canvasElement.offsetHeight,
    });
  }

  console.log('[DEBUG] Resource path:', LAppDefine.ResourcesPath);
  console.log('[DEBUG] Model directories:', LAppDefine.ModelDir);

  // Initialize WebGL and create the application instance
  if (
    !LAppGlManager.getInstance() ||
    !LAppDelegate.getInstance().initialize()
  ) {
    console.error('[DEBUG] Failed to initialize LAppGlManager or LAppDelegate');
    return;
  }

  console.log('[DEBUG] LAppDelegate initialized successfully, running now');
  LAppDelegate.getInstance().run();

  // Only add mouse event listener in Electron environment
  if ((window as any).api?.setIgnoreMouseEvent) {
    const parent = document.getElementById('live2d');
    console.log('[DEBUG] Setting up mouse events, parent element:', parent ? 'found' : 'not found');

    parent?.addEventListener("pointermove", (e) => {
      const model = LAppLive2DManager.getInstance().getModel(0);
      const view = LAppDelegate.getInstance().getView();

      // Transform screen coordinates to Live2D canvas coordinates
      const x = view?._deviceToScreen.transformX(e.x);
      const y = view?._deviceToScreen.transformY(e.y);

      // Check if mouse is over the Live2D model
      // If not over model (false), we want to ignore mouse events (true)
      (window as any).api.setIgnoreMouseEvent(!model?.anyhitTest(x, y));
    });
  }
}

/**
 * Keep the original window.load handler for backwards compatibility
 * (for the standalone HTML file)
 */
window.addEventListener(
  'load',
  (): void => {
    console.log('[DEBUG] Window load event triggered in live2d/main.ts');
    initializeLive2D();
  },
  { passive: true },
);

/**
 * 終了時の処理
 * 结束时的处理
 */
window.addEventListener(
  'beforeunload',
  (): void => LAppDelegate.releaseInstance(),
  { passive: true },
);

/**
 * Process when changing screen size.
 */
window.addEventListener(
  'resize',
  () => {
    if (LAppDefine.CanvasSize === 'auto') {
      LAppDelegate.getInstance().onResize();
    }
  },
  { passive: true },
);

// Make the initialization function available globally
(window as any).initializeLive2D = initializeLive2D;
