import { useRef, type CSSProperties, type ThHTMLAttributes } from 'react';

export interface ResizableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  width?: number;
  minWidth?: number;
  onResize?: (width: number) => void;
}

function resolveWidth(width: number | undefined, style?: CSSProperties): number | undefined {
  if (typeof width === 'number' && Number.isFinite(width)) return width;
  const fromStyle = style?.width;
  if (typeof fromStyle === 'number' && Number.isFinite(fromStyle)) return fromStyle;
  if (typeof fromStyle === 'string') {
    const parsed = Number.parseFloat(fromStyle);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function ResizableTableHeaderCell({
  width,
  minWidth = 48,
  onResize,
  children,
  style,
  className,
  ...rest
}: ResizableHeaderCellProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const resolvedWidth = resolveWidth(width, style);
  const resizable = resolvedWidth != null && Boolean(onResize);

  if (!resizable) {
    return (
      <th {...rest} className={className} style={style}>
        {children}
      </th>
    );
  }

  return (
    <th
      {...rest}
      className={[className, 'parameter-table-resizable-th'].filter(Boolean).join(' ')}
      style={{
        ...style,
        position: 'relative',
        width: resolvedWidth,
        minWidth: resolvedWidth,
        maxWidth: resolvedWidth,
      }}
    >
      {children}
      <span
        className="parameter-table-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize column"
        onMouseDown={(event) => {
          if (!onResize || resolvedWidth == null) return;
          event.preventDefault();
          event.stopPropagation();

          startXRef.current = event.clientX;
          startWidthRef.current = resolvedWidth;

          const onMouseMove = (ev: MouseEvent) => {
            onResize(Math.max(minWidth, startWidthRef.current + ev.clientX - startXRef.current));
          };

          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
          };

          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
      />
    </th>
  );
}
