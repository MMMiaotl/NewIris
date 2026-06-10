import { useState } from 'react';
import { Popover } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import {
  PLOT_LINE_WIDTH_OPTIONS,
  snapPlotLineWidth,
} from '../../stores/plotStore';

interface PlotLineWidthPickerProps {
  value: number;
  color: string;
  onChange: (width: number) => void;
}

interface LineWidthPreviewProps {
  width: number;
  color: string;
  compact?: boolean;
}

const PREVIEW_WIDTH = 44;
const PREVIEW_HEIGHT = 16;
const COMPACT_WIDTH = 18;

function LineWidthPreview({ width, color, compact = false }: LineWidthPreviewProps) {
  const svgWidth = compact ? COMPACT_WIDTH : PREVIEW_WIDTH;
  const inset = 1;

  return (
    <svg
      className={`plot-line-width-preview${compact ? ' plot-line-width-preview--compact' : ''}`}
      width={svgWidth}
      height={PREVIEW_HEIGHT}
      viewBox={`0 0 ${svgWidth} ${PREVIEW_HEIGHT}`}
      aria-hidden
    >
      <line
        x1={inset}
        y1={PREVIEW_HEIGHT / 2}
        x2={svgWidth - inset}
        y2={PREVIEW_HEIGHT / 2}
        stroke={color || '#333333'}
        strokeWidth={width}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function PlotLineWidthPicker({ value, color, onChange }: PlotLineWidthPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedWidth = snapPlotLineWidth(value);
  const strokeColor = color || '#333333';

  const panel = (
    <div className="plot-line-width-menu-panel" role="listbox" aria-label="Line width">
      {PLOT_LINE_WIDTH_OPTIONS.map((width) => {
        const selected = width === selectedWidth;
        return (
          <button
            key={width}
            type="button"
            role="option"
            aria-selected={selected}
            className={
              selected
                ? 'plot-line-width-option plot-line-width-option--selected'
                : 'plot-line-width-option'
            }
            onClick={() => {
              onChange(width);
              setOpen(false);
            }}
          >
            <LineWidthPreview width={width} color={strokeColor} />
          </button>
        );
      })}
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      content={panel}
      overlayClassName="plot-line-width-popover"
    >
      <button type="button" className="plot-line-width-trigger" title="Line width">
        <LineWidthPreview width={selectedWidth} color={strokeColor} compact />
        <DownOutlined className="plot-line-width-trigger__caret" />
      </button>
    </Popover>
  );
}
