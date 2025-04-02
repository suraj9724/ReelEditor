import { useState, useEffect } from "react";
import { Volume2, VolumeX, Video, FileAudio2 } from "lucide-react";
import { TimelineElement } from "@/types/timeline";
import { Slider } from "@/components/UI/slider";
import Panel from "../UI/Panel";
import IconButton from "../UI/IconButton";
import { Button } from "@/components/UI/button";
import { toast } from "sonner";

interface AudioControlProps {
  elements: TimelineElement[];
  selectedElementId: string | null;
  onVolumeChange: (id: string, volume: number) => void;
  onMuteToggle: (id: string, muted: boolean) => void;
  onAudioPriorityChange?: (priority: 'video' | 'audio') => void;
  audioPriority?: 'video' | 'audio';
}

const AudioControl = ({
  elements,
  selectedElementId,
  onVolumeChange,
  onMuteToggle,
  onAudioPriorityChange,
  audioPriority = 'video'
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
    if (value > 0 && isMuted) {
      handleMuteToggle(); // Unmute when volume is increased from zero
    }
    // Force immediate update by modifying the audio element directly
    // if (selectedElement) {
    //   const audioElement = document.querySelector(`audio[data-element-id="${selectedElementId}"]`) as HTMLAudioElement;
    //   if (audioElement) {
    //     audioElement.volume = normalizedVolume;
    //   }
    // }

    // // Log the volume change for debugging
    // console.log("AudioControl Volume changed:", {
    //   elementId: selectedElementId,
    //   volume: normalizedVolume,
    //   percentage: value
    // });
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    if (!selectedElementId) return;

    const newMuted = !isMuted;
    setIsMuted(newMuted);
    console.log(`AudioControl: Mute toggled to ${newMuted} for element ${selectedElementId}`);
    onMuteToggle(selectedElementId, newMuted);

    // Force immediate update
    // if (selectedElement) {
    //   const audioElement = document.querySelector(`audio[data-element-id="${selectedElementId}"]`) as HTMLAudioElement;
    //   if (audioElement) {
    //     audioElement.muted = newMuted;
    //   }
    // }
    // Log the mute toggle for debugging
    // console.log("AudioControl Mute toggled:", {
    //   elementId: selectedElementId,
    //   muted: newMuted
    // });
    if (newMuted) {
      toast.info(`${selectedElement?.type === 'video' ? 'Video' : 'Audio'} muted`);
    } else {
      toast.info(`${selectedElement?.type === 'video' ? 'Video' : 'Audio'} unmuted`);
    }
  };
  // Handle audio priority change
  const handleAudioPriorityChange = (priority: 'video' | 'audio') => {
    if (!onAudioPriorityChange || audioPriority === priority) return;

    onAudioPriorityChange(priority);

    toast.success(priority === 'video' ? "Video audio prioritized" : "External audio prioritized");
  };
  // Common UI for audio priority controls
  const renderAudioPriorityControls = () => (
    <div className="mt-4 bg-gray-100 p-4 rounded-md">
      <h3 className="text-sm font-medium mb-2">Audio Priority</h3>
      <p className="text-xs text-editor-muted mb-3">Choose which audio source to prioritize</p>
      <div className="flex-col gap-2 ">
        <Button
          variant={audioPriority === 'video' ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => handleAudioPriorityChange('video')}
        >
          <Video size={16} className="mr-2" />
          Video Audio
        </Button>
        <Button
          variant={audioPriority === 'audio' ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() => handleAudioPriorityChange('audio')}
        >
          <FileAudio2 size={16} className="mr-2" />
          Audio Files
        </Button>
      </div>
    </div>
  );
  // if (!selectedElement || (selectedElement.type !== 'audio' && selectedElement.type !== 'video')) {
  //   return (
  //     <Panel title="Audio Control" className="p-4">
  //       <div className="space-y-4">
  //         <p className="text-sm text-editor-muted text-center mb-4">
  //           Select an audio or video element to adjust volume
  //         </p>

  //         {renderAudioPriorityControls()}

  //       </div>
  //     </Panel>
  //   );
  // }

  return (
    <Panel title="Audio Control" className="p-4">
      <div className="space-y-4">
        {selectedElement && (selectedElement.type === 'audio' || selectedElement.type === 'video') ? (
          <>
            <div className="flex items-center justify-between mb-2">
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
          </>
        ) : (
          <p className="text-sm text-editor-muted text-center mb-4">
            Select an audio or video element to adjust volume
          </p>
        )}

        {renderAudioPriorityControls()}

        <div className="text-xs text-editor-muted mt-2 pt-2 border-t border-editor-border/50">
          <p>
            {audioPriority === 'video' ?
              "Video audio is prioritized. Audio files are muted." :
              "Audio files are prioritized. Video audio is muted."}
          </p>
        </div>
      </div>
    </Panel>
  );
};

export default AudioControl;
