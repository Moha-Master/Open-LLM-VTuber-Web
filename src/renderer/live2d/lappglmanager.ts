/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

export let canvas: HTMLCanvasElement | null = null;
export let gl: WebGLRenderingContext | null = null;
export let s_instance: LAppGlManager | null = null;

let mygl: WebGLRenderingContext | null = null;

/**
 * Cubism SDKのサンプルで使用するWebGLを管理するクラス
 */
export class LAppGlManager {
  /**
   * クラスのインスタンス（シングルトン）を返す。
   * インスタンスが生成されていない場合は内部でインスタンスを生成する。
   *
   * @return クラスのインスタンス
   */
  public static getInstance(): LAppGlManager {
    if (s_instance == null) {
      s_instance = new LAppGlManager();
    }

    return s_instance;
  }

  /**
   * クラスのインスタンス（シングルトン）を解放する。
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      s_instance.release();
    }

    s_instance = null;
  }

  constructor() {
    // Use existing canvas instead of creating a new one
    canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
      console.error('[DEBUG] Canvas element not found, creating a new one');
      canvas = document.createElement('canvas');
      canvas.style.backgroundColor = 'transparent';
    } else {
      console.log('[DEBUG] Found existing canvas element, using it');
    }

    // Initialize WebGL context
    gl = canvas.getContext('webgl2', { alpha: true });
    if (!gl) {
      console.error('[DEBUG] Failed to get WebGL2 context');
      // Try fallback to WebGL 1
      gl = canvas.getContext('webgl', { alpha: true }) as WebGLRenderingContext;
      if (!gl) {
        console.error('[DEBUG] WebGL not supported');
      }
    }
  }

  /**
   * 解放する。
   */
  public release(): void {}
}
