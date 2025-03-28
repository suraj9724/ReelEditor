import { useState, useEffect } from "react";
import { AudioLines, Volume2, VolumeX } from "lucide-react";
import { TimelineElement } from "@/types/timeline";
import { Slider } from "@/components/UI/slider";
import Panel from "../UI/Panel";
import IconButton from "../UI/IconButton";

interface AudioControlProps {
  elements: TimelineElement[];
  selectedElementId: string | null;
  onVolumeChange: (id: string, volume: number) => void;
  onMuteToggle: (id: string, muted: boolean) => void;
}

const AudioControl = ({
  elements,
  selectedElementId,
  onVolumeChange,
  onMuteToggle
}: AudioControlProps) => {
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  // Find the selected element
  const selectedElement = selectedElementId
    ? elements.find(el => el.id === selectedElementId)
    : null;

  // Reset state when selected element changes
  useEffect(() => {
    if (selectedElement) {
      // For audio and video elements
      if (selectedElement.type === 'audio' || selectedElement.type === 'video') {
        const elementVolume = selectedElement.content.volume !== undefined
          ? selectedElement.content.volume * 100
          : 100;
        setVolume(elementVolume);
        setIsMuted(selectedElement.content.muted || false);
      }
    }
  }, [selectedElement]);

  // Handle volume change
  const handleVolumeChange = (value: number) => {
    if (!selectedElementId) return;

    setVolume(value);
    // Convert percentage to decimal (0-1 range)
    const normalizedVolume = value / 100;
    onVolumeChange(selectedElementId, normalizedVolume);

    // Force immediate update by modifying the audio element directly
    if (selectedElement) {
      const audioElement = document.querySelector(`audio[data-element-id="${selectedElementId}"]`) as HTMLAudioElement;
      if (audioElement) {
        audioElement.volume = normalizedVolume;
      }
    }

    // Log the volume change for debugging
    console.log("AudioControl Volume changed:", {
      elementId: selectedElementId,
      volume: normalizedVolume,
      percentage: value
    });
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    if (!selectedElementId) return;

    const newMuted = !isMuted;
    setIsMuted(newMuted);
    onMuteToggle(selectedElementId, newMuted);

    // Force immediate update
    if (selectedElement) {
      const audioElement = document.querySelector(`audio[data-element-id="${selectedElementId}"]`) as HTMLAudioElement;
      if (audioElement) {
        audioElement.muted = newMuted;
      }
    }
    // Log the mute toggle for debugging
    console.log("AudioControl Mute toggled:", {
      elementId: selectedElementId,
      muted: newMuted
    });
  };

  if (!selectedElement || (selectedElement.type !== 'audio' && selectedElement.type !== 'video')) {
    return (
      <Panel title="Audio Control" className="p-4">
        <p className="text-sm text-editor-muted text-center">
          Select an audio or video element to adjust volume
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Audio Control" className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedElement.type === 'audio' ? 'Audio' : 'Video'} Volume
          </span>
          <IconButton
            icon={isMuted ? VolumeX : Volume2}
            onClick={handleMuteToggle}
            tooltip={isMuted ? "Unmute" : "Mute"}
          />
        </div>

        <Slider
          value={[volume]}
          min={0}
          max={100}
          step={1}
          onValueChange={(value) => handleVolumeChange(value[0])}
          disabled={isMuted}
          className={isMuted ? "opacity-50" : ""}
        />

        <div className="text-xs text-right text-editor-muted">
          {volume}%
        </div>
      </div>
    </Panel>
  );
};

export default AudioControl;
