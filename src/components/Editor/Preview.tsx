import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import IconButton from "../UI/IconButton";
import { Slider } from "@/components/UI/slider";
import { TimelineElement } from "@/types/timeline";

interface PreviewProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: (time: number) => void;
  onRestart: () => void;
  elements: TimelineElement[];
  selectedElementId: string | null;
}

const Preview = ({
 
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onTimeUpdate,
  onRestart,
  elements,
  selectedElementId,
}: PreviewProps) => {
  const [audioSource, setAudioSource] = useState<'video' | 'uploaded'>('video');
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const activeAudioElementsRef = useRef<TimelineElement[]>([]);
  const lastTimeRef = useRef(currentTime);
  const [videoEnded, setVideoEnded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const timeUpdateBlocker = useRef(false);

  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Find the selected element
  const selectedElement = selectedElementId
    ? elements.find(el => el.id === selectedElementId)
    : null;

  // Update volume and mute state when selected element changes
  useEffect(() => {
    if (selectedElement) {
      if (selectedElement.type === 'audio' || selectedElement.type === 'video') {
        const elementVolume = selectedElement.content.volume !== undefined
          ? selectedElement.content.volume * 100
          : 100;
        setVolume(elementVolume);
        setIsMuted(selectedElement.content.muted || false);
      }
    }
  }, [selectedElement]);

  // Add a toggle function
  const toggleAudioSource = () => {
    setAudioSource(prev => (prev === 'video' ? 'uploaded' : 'video'));
  };

  // In the return statement, add a toggle button
  useEffect(() => {
    const activeAudioElements = elements.filter(
      el => el.type === "audio" &&
        currentTime >= el.start &&
        currentTime <= el.end
    );

    // Update active audio elements
    activeAudioElementsRef.current = activeAudioElements;

    // Create or update audio elements
    activeAudioElements.forEach(audio => {
      let audioElement = audioRefs.current[audio.id];

      if (!audioElement) {
        audioElement = new Audio(audio.content.src);
        audioRefs.current[audio.id] = audioElement;

        // Set up event handlers
        audioElement.onerror = (e) => {
          console.error("Error loading audio:", e);
        };

        audioElement.oncanplaythrough = () => {
          console.log("Audio ready to play:", audio.id);
        };

        // Set initial volume and mute state
        audioElement.volume = audio.content.volume !== undefined ? audio.content.volume : 1.0;
        audioElement.muted = audio.content.muted || false;
      }
      // Update volume and mute state based on selected element
      if (selectedElement && selectedElement.id === audio.id) {
        audioElement.volume = volume / 100;
        audioElement.muted = isMuted;
      } else {
        // Ensure audio elements always use their own volume/mute settings by default
        audioElement.volume = audio.content.volume !== undefined ? audio.content.volume : 1.0;
        audioElement.muted = audio.content.muted || false;
      }
      console.log("Preview Audio element state:", {
        elementId: audio.id,
        volume: audioElement.volume,
        muted: audioElement.muted,
        selectedElementId: selectedElement?.id
      });

      // Calculate time within the audio clip
      const audioLocalTime = Math.max(0, currentTime - audio.start);

      // Only update time if it's significantly different
      if (Math.abs(audioElement.currentTime - audioLocalTime) > 0.2) {
        audioElement.currentTime = audioLocalTime;
      }

      // Update playback logic to respect the selected audio source
      if (audioSource === 'uploaded') {
        // Play uploaded audio elements
        activeAudioElements.forEach(audio => {
          // Existing playback logic...
        });
      } else {
        // Play video audio
        const videoElement = videoRef.current;
        if (videoElement) {
          videoElement.volume = volume / 100;
          videoElement.muted = isMuted;
          // Existing video playback logic...
        }
      }
      if (isPlaying) {
        if (audioElement.paused) {
          const playPromise = audioElement.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.error("Error playing audio:", error);
            });
          }
        }
      } else {
        if (!audioElement.paused) {
          audioElement.pause();
        }
      }
    });

    // Cleanup removed audio elements
    Object.keys(audioRefs.current).forEach(id => {
      if (!activeAudioElements.some(a => a.id === id)) {
        const audio = audioRefs.current[id];
        audio.pause();
        delete audioRefs.current[id];
      }
    });
  }, [elements, currentTime, isPlaying, volume]);

  // Handle video element changes with optimized event handling
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      if (timeUpdateBlocker.current) return;
      onTimeUpdate(videoElement.currentTime);
    };

    const handleVideoEnd = () => {
      setVideoEnded(true);
      onPause();
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handlePlaying = () => {
      setIsBuffering(false);
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('ended', handleVideoEnd);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('playing', handlePlaying);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('ended', handleVideoEnd);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('playing', handlePlaying);
    };
  }, [onTimeUpdate, onPause]);

  // Improved play/pause handling
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isPlaying) {
      // Reset if video had ended
      if (videoEnded) {
        setVideoEnded(false);
        if (currentTime >= duration - 0.1) {
          timeUpdateBlocker.current = true;
          onTimeUpdate(0);
          videoElement.currentTime = 0;
          timeUpdateBlocker.current = false;
        }
      }

      // Update video audio state based on selected element
      if (selectedElement && selectedElement.type === 'video' && selectedElement.id === videoElement.id) {
        videoElement.volume = volume / 100;
        videoElement.muted = isMuted;
      } else {
        videoElement.volume = selectedElement?.content.volume !== undefined ? selectedElement.content.volume : 1.0;
        videoElement.muted = selectedElement?.content.muted || false;
      }
      console.log("Preview Video audio state (Play/Pause Effect):", {
        volume: videoElement.volume,
        muted: videoElement.muted,
        isPlaying: !videoElement.paused,
        selectedElementId: selectedElement?.id
      });

      // Use play() and catch any errors
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error("Error playing video:", error);
          onPause();
        });
      }
    } else {
      videoElement.pause();
    }
  }, [isPlaying, onPause, videoEnded, currentTime, duration, onTimeUpdate, volume, isMuted, selectedElement]);

  // Apply volume change to video
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Update volume and mute state
    videoElement.volume = volume / 100;
    videoElement.muted = isMuted;

    // If we're playing, ensure the video continues playing after volume change
    if (isPlaying && videoElement.paused) {
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Error playing video after volume change:", error);
        });
      }
    }

    console.log("Preview Video audio state (Volume Change Effect):", {
      volume: videoElement.volume,
      muted: videoElement.muted,
      isPlaying: !videoElement.paused,
      selectedElementId: selectedElement?.id
    });
  }, [volume, isMuted, isPlaying]);

  // Find the video element to display
  const videoElement = elements.find(
    (el) =>
      el.type === "video" &&
      currentTime >= el.start &&
      currentTime <= el.end
  );

  // Handle restart
  const handleRestart = () => {
    setVideoEnded(false);
    onRestart();
  };

  // Handle play with restart if needed
  const handlePlay = () => {
    if (videoEnded || currentTime >= duration - 0.1) {
      handleRestart();
    }
    onPlay();
  };

  // Apply crop styles if crop is defined
  const getVideoStyle = () => {
    if (videoElement && videoElement.content.crop) {
      const crop = videoElement.content.crop;
      return {
        display: isBuffering ? 'none' : 'block',
        objectFit: 'cover' as const,
        objectPosition: `${crop.x}% ${crop.y}%`,
        width: `${crop.width}%`,
        height: `${crop.height}%`,
        margin: 'auto',
        transition: 'all 0.1s ease-out'
      };
    }

    return {
      display: isBuffering ? 'none' : 'block',
      objectFit: 'contain' as const,
      transition: 'all 0.1s ease-out'
    };
  };

  // Force video element to update when crop changes
  useEffect(() => {
    if (videoRef.current && videoElement?.content.crop) {
      videoRef.current.style.objectPosition = `${videoElement.content.crop.x}% ${videoElement.content.crop.y}%`;
      videoRef.current.style.width = `${videoElement.content.crop.width}%`;
      videoRef.current.style.height = `${videoElement.content.crop.height}%`;
    }
  }, [videoElement?.content.crop]);

  // Debug helper
  const logActiveAudio = () => {
    console.log("Active audio elements:", activeAudioElementsRef.current.map(a => a.id));
    console.log("Audio elements in refs:", Object.keys(audioRefs.current));
  };

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVolumeChange = useCallback((value: number[]) => {
    setVolume(value[0]);
  }, []);

  return (
    <div className="panel w-full h-full flex flex-col">
      <div className="relative flex-1 bg-black overflow-hidden rounded">
        {videoElement ? (
          <>
            <video
              ref={videoRef}
              src={videoElement.content.src}
              className="w-full h-full"
              playsInline
              preload="auto"
              style={getVideoStyle()}
              onError={(e) => console.error("Video error:", e)}
              muted={isMuted}
            />
            {isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="loader w-10 h-10 border-4 border-t-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/70 text-sm">
            No media at current position
          </div>
        )}

        {/* Render preview elements */}
        <div className="absolute inset-0 pointer-events-none">
          {elements
            .filter(
              (el) =>
                el.type !== "video" &&
                el.type !== "audio" &&
                currentTime >= el.start &&
                currentTime <= el.end
            )
            .map((element) => (
              <div
                key={element.id}
                className="absolute"
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  transform: `rotate(${element.rotation}deg)`,
                }}
              >
                {element.type === "text" && (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      fontSize: element.content.fontSize + "px",
                      fontWeight: element.content.fontWeight,
                      fontStyle: element.content.fontStyle,
                      color: element.content.color,
                      textAlign: element.content.alignment as any,
                    }}
                  >
                    {element.content.content}
                  </div>
                )}

                {element.type === "image" && (
                  <img
                    src={element.content.src}
                    alt="Preview image"
                    className="w-full h-full"
                    loading="eager"
                    style={element.content.crop ? {
                      objectFit: 'cover',
                      objectPosition: `${element.content.crop.x}% ${element.content.crop.y}%`,
                      width: `${element.content.crop.width}%`,
                      height: `${element.content.crop.height}%`,
                      margin: 'auto'
                    } : {
                      objectFit: 'contain'
                    }}
                  />
                )}
              </div>
            ))}
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden cursor-pointer">
          <div
            className="absolute top-0 left-0 h-full bg-editor-accent"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
          <input
            type="range"
            min="0"
            max={duration}
            value={currentTime}
            step="0.01"
            onChange={(e) => onTimeUpdate(parseFloat(e.target.value))}
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <IconButton
              icon={SkipBack}
              onClick={handleRestart}
              tooltip="Restart"
            />
            <IconButton
              icon={isPlaying ? Pause : Play}
              onClick={isPlaying ? onPause : handlePlay}
              tooltip={isPlaying ? "Pause" : "Play"}
            />
            <IconButton
              icon={SkipForward}
              onClick={() => onTimeUpdate(duration)}
              tooltip="End"
            />
            <div className="relative">
              <IconButton
                icon={isMuted ? VolumeX : Volume2}
                onClick={toggleMute}
                onMouseEnter={() => setShowVolumeControl(true)}
                onMouseLeave={() => setShowVolumeControl(false)}
                tooltip="Volume"
              />
              {showVolumeControl && (
                <div
                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 p-2 bg-white rounded shadow-lg z-10 w-24"
                  onMouseEnter={() => setShowVolumeControl(true)}
                  onMouseLeave={() => setShowVolumeControl(false)}
                >
                  <Slider
                    value={[volume]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={handleVolumeChange}
                    disabled={isMuted}
                    className={isMuted ? "opacity-50" : ""}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="text-xs font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Preview;
