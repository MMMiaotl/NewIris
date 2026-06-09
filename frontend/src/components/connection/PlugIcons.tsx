import type { SVGProps } from 'react';

type PlugIconProps = SVGProps<SVGSVGElement>;

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Bottom-left → top-right diagonal. */
const WRAP = 'rotate(45 12 12)';

const R = 4.5;
const FACE_L = 11.5;
const FACE_R = 14.5;
const ARC_L = 7;
const ARC_R = 18;

function LeftPlug({ prongTo }: { prongTo: number }) {
  return (
    <>
      <line x1="2.5" y1="12" x2="5" y2="12" />
      <path d={`M ${ARC_L} ${12 - R} A ${R} ${R} 0 0 0 ${ARC_L} ${12 + R}`} />
      <line x1={ARC_L} y1={12 - R} x2={FACE_L} y2={12 - R} />
      <line x1={ARC_L} y1={12 + R} x2={FACE_L} y2={12 + R} />
      <line x1={FACE_L} y1="9.5" x2={prongTo} y2="9.5" />
      <line x1={FACE_L} y1="14.5" x2={prongTo} y2="14.5" />
    </>
  );
}

function RightPlug({ faceFrom }: { faceFrom: number }) {
  return (
    <>
      <line x1={faceFrom} y1={12 - R} x2={ARC_R} y2={12 - R} />
      <line x1={faceFrom} y1={12 + R} x2={ARC_R} y2={12 + R} />
      <path d={`M ${ARC_R} ${12 - R} A ${R} ${R} 0 0 1 ${ARC_R} ${12 + R}`} />
      <line x1={ARC_R} y1="12" x2="20.5" y2="12" />
    </>
  );
}

/** Disconnected diagonal plug (connect action). */
export function PlugDisconnectedIcon(props: PlugIconProps) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden {...props}>
      <g transform={WRAP}>
        <g {...strokeProps}>
          <g transform="translate(-2.2 0)">
            <LeftPlug prongTo={12.2} />
          </g>
          <line x1="11.6" y1="9.8" x2="13.4" y2="14.2" />
          <line x1="13.4" y1="9.8" x2="11.6" y2="14.2" />
          <g transform="translate(2.2 0)">
            <RightPlug faceFrom={16.8} />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Connected diagonal plug (connected / disconnect action). */
export function PlugConnectedIcon(props: PlugIconProps) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden {...props}>
      <g transform={WRAP}>
        <g {...strokeProps}>
          <LeftPlug prongTo={FACE_R} />
          <RightPlug faceFrom={FACE_R} />
        </g>
      </g>
    </svg>
  );
}
