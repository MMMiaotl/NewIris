/**
 * Windows WatchIoCom ActiveX control — direct shared-memory access to local WatchIO segments.
 * Legacy reference: IrisWeb InitOnLoad.js, WatchIoGuide.md (WatchIoCom.WatchIoComCtrl.1).
 * Requires WatchIoCom.ocx registered (e.g. C:\IrisWeb\OCX\WatchIoCom.ocx) and IE/Edge IE mode.
 */

export const WATCHIO_COM_CLSID = '75E09F4F-B035-4BC5-B835-57ACC52C2B5E';
export const WATCHIO_COM_PROGID = 'WatchIoCom.WatchIoComCtrl.1';

/** Minimal surface used by IrisWeb; extra methods are invoked optionally when present. */
export interface WatchIoComControl {
  SetShMemName(name: string): void;
  AddList(name: string, mode: number, format: string): number;
  SampleList(): void;
  FormatList(): void;
  GetListString(index: number): string;
  ClearList?(): void;
  DelList?(index: number): void;
  SetListString?(index: number, value: string): void;
}

let boundControl: WatchIoComControl | null = null;

export function bindWatchIoComControl(control: WatchIoComControl | null): void {
  boundControl = control;
}

export function getWatchIoComControl(): WatchIoComControl | null {
  return boundControl;
}

declare global {
  interface Window {
    ActiveXObject?: new (progId: string) => WatchIoComControl;
  }
}

/** IE / Edge IE mode: instantiate COM without an <object> tag. */
export function tryCreateWatchIoComActiveX(): WatchIoComControl | null {
  try {
    if (typeof window.ActiveXObject !== 'function') return null;
    return new window.ActiveXObject(WATCHIO_COM_PROGID);
  } catch {
    return null;
  }
}

export function resolveWatchIoComControl(): WatchIoComControl | null {
  return getWatchIoComControl() ?? tryCreateWatchIoComActiveX();
}

/** Wait for WatchIoComHost <object> or ActiveXObject — IE mode loads COM asynchronously. */
export async function waitForWatchIoComControl(maxMs = 3000): Promise<WatchIoComControl> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const com = resolveWatchIoComControl();
    if (com) return com;
    await new Promise((r) => window.setTimeout(r, 50));
  }
  throw new Error(
    'WatchIoCom ActiveX unavailable — register WatchIoCom.ocx and open Iris Next in Edge IE mode',
  );
}

/** Bind COM from a loaded <object id="watchIoCom"> element (preferred over ActiveXObject). */
export function bindWatchIoComFromElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  const com = el as unknown as WatchIoComControl;
  if (typeof com.SetShMemName !== 'function') return false;
  bindWatchIoComControl(com);
  return true;
}

/** IrisWeb tries *Full segment names first, then short names (InitOnLoad.js). */
export function applyWatchIoShMemName(control: WatchIoComControl, watchIoName: string): string {
  const candidates = watchIoName.endsWith('Full')
    ? [watchIoName]
    : [`${watchIoName}Full`, watchIoName];
  for (const name of candidates) {
    try {
      control.SetShMemName(name);
      return name;
    } catch {
      /* try next candidate */
    }
  }
  control.SetShMemName(watchIoName);
  return watchIoName;
}

export function defaultComListFormat(dataType?: string): string {
  const type = dataType === 'int' || dataType === 'integer' ? 'int' : 'real';
  return `type=${type} scale=1.0 format=%.6g description=""`;
}
