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

/** IrisWeb tries *Full segment names first, then short names (InitOnLoad.js). */
export function applyWatchIoShMemName(control: WatchIoComControl, watchIoName: string): string {
  const candidates = watchIoName.endsWith('Full')
    ? [watchIoName]
    : [`${watchIoName}Full`, watchIoName];
  for (const name of candidates) {
    control.SetShMemName(name);
    return name;
  }
  return watchIoName;
}

export function defaultComListFormat(dataType = 'real'): string {
  const type = dataType === 'int' ? 'int' : 'real';
  return `type=${type} scale=1.0 format=%.6g description=""`;
}
