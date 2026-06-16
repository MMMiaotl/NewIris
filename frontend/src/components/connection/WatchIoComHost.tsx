import { useEffect, useRef } from 'react';
import {
  bindWatchIoComControl,
  bindWatchIoComFromElement,
  WATCHIO_COM_CLSID,
} from '../../api/watchIoComActiveX';
import { useConnectionStore } from '../../stores/connectionStore';
import { isSharedMemoryTransport } from '../../constants/transport';

const WATCHIO_COM_OBJECT_ID = 'watchIoCom';

/**
 * Hidden ActiveX object host — only rendered for Shared Memory transport on Windows.
 * IE / Edge IE mode binds the COM control; Chromium shows a setup hint via connect error.
 */
export function WatchIoComHost() {
  const transport = useConnectionStore((s) => s.config.transport);
  const objectRef = useRef<HTMLObjectElement>(null);

  useEffect(() => {
    if (!isSharedMemoryTransport(transport)) {
      bindWatchIoComControl(null);
      return;
    }

    const tryBind = () =>
      bindWatchIoComFromElement(objectRef.current) ||
      bindWatchIoComFromElement(document.getElementById(WATCHIO_COM_OBJECT_ID));

    if (tryBind()) return () => bindWatchIoComControl(null);

    const el = objectRef.current;
    const onReady = () => {
      tryBind();
    };
    el?.addEventListener('load', onReady);

    const retryId = window.setInterval(() => {
      if (tryBind()) window.clearInterval(retryId);
    }, 100);

    return () => {
      window.clearInterval(retryId);
      el?.removeEventListener('load', onReady);
      bindWatchIoComControl(null);
    };
  }, [transport]);

  if (!isSharedMemoryTransport(transport)) return null;

  return (
    <object
      ref={objectRef}
      id={WATCHIO_COM_OBJECT_ID}
      className="watchio-com-host"
      classID={`clsid:${WATCHIO_COM_CLSID}`}
      aria-hidden
      width={1}
      height={1}
    />
  );
}
