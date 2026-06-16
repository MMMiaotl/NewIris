import { useEffect, useRef } from 'react';
import {
  bindWatchIoComControl,
  WATCHIO_COM_CLSID,
  type WatchIoComControl,
} from '../../api/watchIoComActiveX';
import { useConnectionStore } from '../../stores/connectionStore';
import { isSharedMemoryTransport } from '../../constants/transport';

/**
 * Hidden ActiveX object host — only rendered for Shared Memory transport on Windows.
 * IE / Edge IE mode binds the COM control; Chromium shows a setup hint via connect error.
 */
export function WatchIoComHost() {
  const transport = useConnectionStore((s) => s.config.transport);
  const ref = useRef<HTMLObjectElement>(null);

  useEffect(() => {
    if (!isSharedMemoryTransport(transport)) {
      bindWatchIoComControl(null);
      return;
    }
    const el = ref.current as unknown as WatchIoComControl | null;
    if (el?.SetShMemName) bindWatchIoComControl(el);
    return () => bindWatchIoComControl(null);
  }, [transport]);

  if (!isSharedMemoryTransport(transport)) return null;

  return (
    <object
      ref={ref}
      id="watchIoCom"
      className="watchio-com-host"
      classID={`clsid:${WATCHIO_COM_CLSID}`}
      aria-hidden
      width={0}
      height={0}
    />
  );
}
