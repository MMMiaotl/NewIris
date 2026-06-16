import { useCallback, useMemo, useState } from 'react';
import { Button, Checkbox, Input, List, Modal, Space } from 'antd';
import {
  FORMAT_STYLE_OPTIONS,
  SCALE_CONVERSION_OPTIONS,
  UNIT_OPTIONS,
  getScaleConversion,
  type FormatStyleId,
} from '../../constants/displayFormats';
import { useDisplayStore } from '../../stores/displayStore';
import { createPlaceholderVariable, useVariableStore } from '../../stores/variableStore';
import { formatDisplayValue, hasActiveDisplayOverride } from '../../utils/formatVariableValue';

interface ChangeStyleScaleModalProps {
  open: boolean;
  onClose: () => void;
  initialFocusVariable?: string | null;
}

interface ModalBodyProps {
  initialFocusVariable?: string | null;
  onClose: () => void;
}

function ChangeStyleScaleModalBody({ initialFocusVariable, onClose }: ModalBodyProps) {
  const { selectedVariables, focusedVariable, variables } = useVariableStore();
  const { getOverride, setOverride, resetOverride, applyToVariables } = useDisplayStore();
  const [filter, setFilter] = useState('');
  const preferredInitial =
    initialFocusVariable ??
    (focusedVariable && selectedVariables.includes(focusedVariable) ? focusedVariable : null) ??
    selectedVariables[0] ??
    null;
  const [activeVariable, setActiveVariable] = useState<string | null>(preferredInitial);
  const [applyToAll, setApplyToAll] = useState(false);

  const variableNames = useMemo(() => {
    const names = selectedVariables.length ? [...selectedVariables] : [];
    if (initialFocusVariable && !names.includes(initialFocusVariable)) {
      names.unshift(initialFocusVariable);
    }
    const query = filter.trim().toLowerCase();
    if (!query) return names;
    return names.filter((name) => name.toLowerCase().includes(query));
  }, [selectedVariables, initialFocusVariable, filter]);

  const activeOverride = activeVariable ? getOverride(activeVariable) : null;

  const variableMap = useMemo(
    () => new Map(variables.map((v) => [v.name, v])),
    [variables],
  );

  const activeRawValue = activeVariable
    ? (variableMap.get(activeVariable)?.value ??
      createPlaceholderVariable(activeVariable).value)
    : '';
  const activeDisplayValue = activeVariable
    ? formatDisplayValue(activeRawValue, activeOverride)
    : '';

  const patchActive = useCallback(
    (partial: Parameters<typeof setOverride>[1]) => {
      if (!activeVariable) return;
      if (applyToAll && selectedVariables.length) {
        applyToVariables(selectedVariables, partial);
        return;
      }
      setOverride(activeVariable, partial);
    },
    [activeVariable, applyToAll, selectedVariables, setOverride, applyToVariables],
  );

  const handleScaleSelect = (scaleId: string) => {
    const scale = getScaleConversion(scaleId);
    patchActive({
      scaleConversion: scaleId,
      unit: scale?.toUnit ?? activeOverride?.unit,
    });
  };

  const handleReset = () => {
    if (!activeVariable) return;
    if (applyToAll && selectedVariables.length) {
      for (const name of selectedVariables) resetOverride(name);
      return;
    }
    resetOverride(activeVariable);
  };

  return (
    <>
      <div className="style-scale-modal-body">
        <fieldset className="style-scale-fieldset style-scale-fieldset--variables">
          <legend>Variables</legend>
          <Input
            size="small"
            placeholder="Filter variables…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            allowClear
          />
          <List
            size="small"
            bordered
            className="style-scale-variable-list"
            locale={{ emptyText: 'No parameters selected — add variables to the table first' }}
            dataSource={variableNames}
            renderItem={(name) => {
              const raw =
                variableMap.get(name)?.value ?? createPlaceholderVariable(name).value;
              const display = formatDisplayValue(raw, getOverride(name));
              return (
                <List.Item
                  className={
                    name === activeVariable
                      ? 'style-scale-variable-item is-active'
                      : 'style-scale-variable-item'
                  }
                  onClick={() => setActiveVariable(name)}
                >
                  <span className="style-scale-variable-name" title={name}>
                    {name}
                  </span>
                  <span className="style-scale-variable-value" title={display || raw || undefined}>
                    {display || raw || '—'}
                  </span>
                  {hasActiveDisplayOverride(getOverride(name)) && (
                    <span className="style-scale-variable-badge">custom</span>
                  )}
                </List.Item>
              );
            }}
          />
          {selectedVariables.length > 1 && (
            <Checkbox checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)}>
              Apply style / unit / scale to all selected
            </Checkbox>
          )}
        </fieldset>

        <fieldset className="style-scale-fieldset style-scale-fieldset--custom-name">
          <legend>Custom name</legend>
          <div className="style-scale-custom-name-row">
            <Input
              size="small"
              placeholder="Custom display name"
              value={activeOverride?.customName ?? ''}
              disabled={!activeVariable}
              onChange={(e) => patchActive({ customName: e.target.value })}
            />
            <Checkbox
              checked={activeOverride?.useCustomName ?? false}
              disabled={!activeVariable}
              onChange={(e) => patchActive({ useCustomName: e.target.checked })}
            >
              Custom name
            </Checkbox>
          </div>
          <div className="style-scale-custom-name-row">
            <Input
              size="small"
              value={activeVariable ?? ''}
              readOnly
              className="style-scale-source-name"
            />
            <span className="style-scale-source-label">Source name</span>
          </div>
          <div className="style-scale-custom-name-row">
            <Input
              size="small"
              value={activeDisplayValue || activeRawValue || '—'}
              readOnly
              className="style-scale-value-field"
              title={
                activeRawValue && activeDisplayValue !== activeRawValue
                  ? `Raw: ${activeRawValue}`
                  : undefined
              }
            />
            <span className="style-scale-source-label">Value</span>
          </div>
        </fieldset>

        <div className="style-scale-columns">
          <fieldset className="style-scale-fieldset style-scale-fieldset--column">
            <legend>Style</legend>
            <List
              size="small"
              bordered
              className="style-scale-option-list"
              dataSource={[...FORMAT_STYLE_OPTIONS]}
              renderItem={(item) => (
                <List.Item
                  className={
                    activeOverride?.style === item.id
                      ? 'style-scale-option-item is-selected'
                      : 'style-scale-option-item'
                  }
                  onClick={() => patchActive({ style: item.id as FormatStyleId })}
                >
                  {item.label}
                </List.Item>
              )}
            />
          </fieldset>

          <fieldset className="style-scale-fieldset style-scale-fieldset--column">
            <legend>Unit</legend>
            <List
              size="small"
              bordered
              className="style-scale-option-list"
              dataSource={[...UNIT_OPTIONS]}
              renderItem={(item) => (
                <List.Item
                  className={
                    activeOverride?.unit === item.id
                      ? 'style-scale-option-item is-selected'
                      : 'style-scale-option-item'
                  }
                  onClick={() => patchActive({ unit: item.id })}
                >
                  {item.label}
                </List.Item>
              )}
            />
          </fieldset>

          <fieldset className="style-scale-fieldset style-scale-fieldset--column">
            <legend>Scale</legend>
            <List
              size="small"
              bordered
              className="style-scale-option-list"
              dataSource={[...SCALE_CONVERSION_OPTIONS]}
              renderItem={(item) => (
                <List.Item
                  className={
                    activeOverride?.scaleConversion === item.id
                      ? 'style-scale-option-item is-selected'
                      : 'style-scale-option-item'
                  }
                  onClick={() => handleScaleSelect(item.id)}
                >
                  {item.label}
                </List.Item>
              )}
            />
          </fieldset>
        </div>
      </div>
      <Space style={{ marginTop: 16 }}>
        <Button onClick={handleReset} disabled={!activeVariable}>
          Reset
        </Button>
        <Button type="primary" onClick={onClose}>
          Close
        </Button>
      </Space>
    </>
  );
}

export function ChangeStyleScaleModal({
  open,
  onClose,
  initialFocusVariable,
}: ChangeStyleScaleModalProps) {
  const bodyKey = `${initialFocusVariable ?? ''}|${open}`;

  return (
    <Modal
      title="Change Style / Scale"
      open={open}
      onCancel={onClose}
      width={860}
      className="style-scale-modal"
      style={{ top: 48 }}
      footer={null}
      destroyOnHidden
    >
      {open ? (
        <ChangeStyleScaleModalBody
          key={bodyKey}
          initialFocusVariable={initialFocusVariable}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  );
}
