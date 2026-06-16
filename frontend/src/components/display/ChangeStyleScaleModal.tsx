import { useCallback, useMemo, useState } from 'react';
import { Button, Checkbox, Input, InputNumber, List, Modal, Select, Space, Typography } from 'antd';
import {
  FORMAT_STYLE_OPTIONS,
  SCALE_LIST_OPTIONS,
  UNIT_LIST_OPTIONS,
  getScaleConversion,
  type FormatStyleId,
} from '../../constants/displayFormats';
import { useDisplayStore } from '../../stores/displayStore';
import { createPlaceholderVariable, useVariableStore } from '../../stores/variableStore';
import { formatDisplayValue } from '../../utils/formatVariableValue';

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
  const preferredInitial =
    initialFocusVariable ??
    (focusedVariable && selectedVariables.includes(focusedVariable) ? focusedVariable : null) ??
    selectedVariables[0] ??
    null;
  const [activeVariable, setActiveVariable] = useState<string | null>(preferredInitial);
  const [applyToAll, setApplyToAll] = useState(false);

  const parameterOptions = useMemo(() => {
    const names = selectedVariables.length ? [...selectedVariables] : [];
    if (initialFocusVariable && !names.includes(initialFocusVariable)) {
      names.unshift(initialFocusVariable);
    }
    return names.map((name) => ({ value: name, label: name }));
  }, [selectedVariables, initialFocusVariable]);

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
    if (!scaleId) {
      patchActive({ scaleConversion: undefined });
      return;
    }
    const scale = getScaleConversion(scaleId);
    patchActive({
      scaleConversion: scaleId,
      unit: scale?.toUnit ?? activeOverride?.unit,
    });
  };

  const isUnitSelected = (unitId: string) =>
    unitId ? activeOverride?.unit === unitId : !activeOverride?.unit;

  const isScaleSelected = (scaleId: string) =>
    scaleId ? activeOverride?.scaleConversion === scaleId : !activeOverride?.scaleConversion;

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
          <div className="style-scale-variables-row">
            <Select
              size="small"
              showSearch
              placeholder={
                parameterOptions.length
                  ? 'Select a parameter…'
                  : 'No parameters selected'
              }
              value={activeVariable ?? undefined}
              onChange={setActiveVariable}
              options={parameterOptions}
              optionFilterProp="label"
              disabled={!parameterOptions.length}
              className="style-scale-variable-select"
              popupMatchSelectWidth={false}
            />
            <Input
              size="small"
              value={activeDisplayValue || activeRawValue || '—'}
              readOnly
              disabled={!activeVariable}
              className="style-scale-value-field"
              title={
                activeRawValue && activeDisplayValue !== activeRawValue
                  ? `Raw: ${activeRawValue}`
                  : undefined
              }
            />
            {selectedVariables.length > 1 && (
              <Checkbox
                className="style-scale-apply-all"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
              >
                Apply to all
              </Checkbox>
            )}
          </div>
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
        </fieldset>

        <div className="style-scale-columns">
          <fieldset className="style-scale-fieldset style-scale-fieldset--column">
            <legend>Format</legend>
            <List
              size="small"
              bordered
              className="style-scale-option-list"
              dataSource={[...FORMAT_STYLE_OPTIONS]}
              renderItem={(item) => (
                <List.Item
                  className={
                    activeOverride?.format === item.id
                      ? 'style-scale-option-item is-selected'
                      : 'style-scale-option-item'
                  }
                  onClick={() => patchActive({ format: item.id as FormatStyleId })}
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
              dataSource={[...UNIT_LIST_OPTIONS]}
              renderItem={(item) => (
                <List.Item
                  className={
                    isUnitSelected(item.id)
                      ? 'style-scale-option-item is-selected'
                      : 'style-scale-option-item'
                  }
                  onClick={() => patchActive({ unit: item.id || undefined })}
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
              dataSource={[...SCALE_LIST_OPTIONS]}
              renderItem={(item) => (
                <List.Item
                  className={
                    isScaleSelected(item.id)
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
      {activeOverride?.format === 'lookup' && (
        <fieldset className="style-scale-fieldset style-scale-fieldset--lookup">
          <legend>Lookup table</legend>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            One entry per line: <code>raw = label</code>
          </Typography.Text>
          <Input.TextArea
            rows={6}
            disabled={!activeVariable}
            placeholder={'0 = Off\n1 = On\n2 = Standby'}
            value={
              activeOverride?.lookupTable
                ? Object.entries(activeOverride.lookupTable)
                    .map(([k, v]) => `${k} = ${v}`)
                    .join('\n')
                : ''
            }
            onChange={(e) => {
              const table: Record<string, string> = {};
              for (const line of e.target.value.split('\n')) {
                const eq = line.indexOf('=');
                if (eq < 0) continue;
                const k = line.slice(0, eq).trim();
                const v = line.slice(eq + 1).trim();
                if (k) table[k] = v;
              }
              patchActive({ lookupTable: Object.keys(table).length ? table : undefined });
            }}
          />
        </fieldset>
      )}

      {activeVariable && (
        <fieldset className="style-scale-fieldset style-scale-fieldset--wrap">
          <legend>Wrap / clamp</legend>
          <Space>
            <span>Min</span>
            <InputNumber
              size="small"
              disabled={!activeVariable}
              value={activeOverride?.wrapMin}
              onChange={(v) => patchActive({ wrapMin: v ?? undefined })}
              placeholder="—"
              style={{ width: 90 }}
            />
            <span>Max</span>
            <InputNumber
              size="small"
              disabled={!activeVariable}
              value={activeOverride?.wrapMax}
              onChange={(v) => patchActive({ wrapMax: v ?? undefined })}
              placeholder="—"
              style={{ width: 90 }}
            />
          </Space>
        </fieldset>
      )}

      </div>
      <Space className="style-scale-modal-actions">
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
      title="Format setting"
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
