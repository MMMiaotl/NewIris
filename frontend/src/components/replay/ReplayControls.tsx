import { Button, Slider, Space } from 'antd';
import { PauseCircleOutlined, PlayCircleOutlined, StepBackwardOutlined } from '@ant-design/icons';
import { useSessionStore } from '../../stores/sessionStore';
import { seekReplayFrame } from '../../hooks/useReplay';

export function ReplayControls() {
  const { replayData, replayIndex, replayPlaying, replaySpeed, setReplayPlaying, setReplaySpeed } =
    useSessionStore();
  const frameCount = replayData?.frames.length ?? 0;

  if (!replayData) return null;

  const current = replayData.frames[replayIndex];
  const duration = replayData.frames[replayData.frames.length - 1]?.t ?? 0;

  return (
    <div className="replay-bar">
      <Space>
        <Button
          icon={replayPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={() => setReplayPlaying(!replayPlaying)}
        />
        <Button icon={<StepBackwardOutlined />} onClick={() => seekReplayFrame(0)} />
        <Slider
          style={{ width: 240 }}
          min={0}
          max={Math.max(0, frameCount - 1)}
          value={replayIndex}
          onChange={seekReplayFrame}
          tooltip={{ formatter: () => `${((current?.t ?? 0) / 1000).toFixed(2)}s / ${(duration / 1000).toFixed(2)}s` }}
        />
        <span>Speed</span>
        <Slider
          style={{ width: 80 }}
          min={0.25}
          max={4}
          step={0.25}
          value={replaySpeed}
          onChange={setReplaySpeed}
        />
      </Space>
    </div>
  );
}
