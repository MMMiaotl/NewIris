import type { ThHTMLAttributes } from 'react';

export interface ResizableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  width?: number;
  onResize?: (width: number) => void;
}

export function ResizableTableHeaderCell({
  width,
  onResize,
  children,
  style,
  ...rest
}: ResizableHeaderCellProps) {
  if (!width || !onResize) {
    return (
      <th {...rest} style={style}>
        {children}
      </th>
    );
  }

  return (
    <th
      {...rest}
      style={{
        ...style,
        position: 'relative',
        width,
        minWidth: width,
        maxWidth: width,
      }}
    >
      {children}
      <span
        className="parameter-table-resize-handle"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startWidth = width;
          const onMouseMove = (ev: MouseEvent) => {
            onResize(Math.max(48, startWidth + ev.clientX - startX));
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
