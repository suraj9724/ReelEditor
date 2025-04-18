import { useEffect, useRef, useState } from "react";
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
import { toast } from "sonner";

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
  elementCrop: { x: number; y: number; width: number; height: number } | null;
  audioPriority?: 'video' | 'audio';
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
  audioPriority = 'video',
  selectedElementId,
  elementCrop,
}: PreviewProps) => {
  // const [audioSource, setAudioSource] = useState<'video' | 'uploaded'>('video');
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
  const previousAudioPriorityRef = useRef(audioPriority);
  const didInitialPlayRef = useRef<Record<string, boolean>>({});
  const videoMutedRef = useRef<boolean>(false);
  const timeJumpedRef = useRef<boolean>(false);
  const audioSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const forceSyncRef = useRef<boolean>(false);

  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const updateMediaStates = () => {
    const priorityChanged = previousAudioPriorityRef.current !== audioPriority;
    previousAudioPriorityRef.current = audioPriority;

    if (priorityChanged) {
      console.log(`Audio priority changed in Preview: ${audioPriority}`);
      toast.info(`Audio priority set to ${audioPriority === 'video' ? 'video audio' : 'uploaded audio'}`);
    }

    if (videoRef.current) {
      const hasActiveAudio = activeAudioElementsRef.current.length > 0;
      const shouldMuteVideo = isMuted || (audioPriority === 'audio' && hasActiveAudio);
      videoRef.current.muted = shouldMuteVideo;
      videoRef.current.volume = volume / 100;
      videoMutedRef.current = shouldMuteVideo;
      console.log(`Video audio ${shouldMuteVideo ? 'muted' : 'unmuted'} (priority: ${audioPriority})`);
    }

    activeAudioElementsRef.current.forEach(audio => {
      const audioElement = audioRefs.current[audio.id];
      if (!audioElement) return;

      const elementMuted = audio.content.muted || false;
      const hasVideo = elements.some(el =>
        el.type === "video" && currentTime >= el.start && currentTime <= el.end
      );

      const shouldMuteAudio = isMuted || (audioPriority === 'video' && hasVideo) || elementMuted;

      audioElement.muted = shouldMuteAudio;

      const elementVolume = audio.content.volume !== undefined ? audio.content.volume : 1;
      audioElement.volume = elementVolume * (volume / 100);

      console.log(`Audio file ${audio.id} ${shouldMuteAudio ? 'muted' : 'unmuted'} (priority: ${audioPriority})`);

      if (isPlaying && !shouldMuteAudio) {
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Error playing audio:", error);
            if (!didInitialPlayRef.current[audio.id]) {
              didInitialPlayRef.current[audio.id] = true;
            }
          });
        }
      } else if (!isPlaying) {
        audioElement.pause();
      }
    });
  };
  const syncAudioPositions = () => {
    activeAudioElementsRef.current.forEach(audio => {
      const audioElement = audioRefs.current[audio.id];
      if (audioElement) {
        const audioLocalTime = Math.max(0, currentTime - audio.start);
        if (Math.abs(audioElement.currentTime - audioLocalTime) > 0.1 || forceSyncRef.current) {
          console.log(`Synchronizing audio ${audio.id} time to ${audioLocalTime}`);
          audioElement.currentTime = audioLocalTime;
        }
      }
    });
    forceSyncRef.current = false;
  };
  useEffect(() => {
    const activeAudioElements = elements.filter(
      el => el.type === "audio" &&
        currentTime >= el.start &&
        currentTime <= el.end
    );

    console.log(`Active audio elements at time ${currentTime}:`, activeAudioElements.length);
    activeAudioElementsRef.current = activeAudioElements;

    activeAudioElements.forEach(audio => {
      if (!audioRefs.current[audio.id]) {
        console.log("Creating audio element for", audio.id, audio.content.src);
        const audioElement = new Audio(audio.content.src);

        const audioLocalTime = Math.max(0, currentTime - audio.start);
        audioElement.currentTime = audioLocalTime;

        const elementVolume = audio.content.volume !== undefined ? audio.content.volume : 1;
        audioElement.volume = elementVolume * (volume / 100);

        audioRefs.current[audio.id] = audioElement;
        didInitialPlayRef.current[audio.id] = false;
        if (isPlaying && !audio.content.muted && audioPriority === 'audio') {
          audioElement.play().catch(error => {
            console.error("Error playing new audio:", error);
          });
        }
      }
    });

    Object.keys(audioRefs.current).forEach(id => {
      if (!activeAudioElements.some(a => a.id === id)) {
        console.log("Removing audio element", id);
        const audio = audioRefs.current[id];
        audio.pause();
        delete audioRefs.current[id];
        delete didInitialPlayRef.current[id];
      }
    });

    updateMediaStates();
    if (Math.abs(currentTime - lastTimeRef.current) > 0.2 || forceSyncRef.current) {
      timeJumpedRef.current = true;
      syncAudioPositions();
    }

    lastTimeRef.current = currentTime;
  }, [elements, currentTime, audioPriority, volume, isPlaying]);

  useEffect(() => {
    if (timeJumpedRef.current) {
      console.log("Timeline jumped, synchronizing audio positions");
      if (audioSyncTimeoutRef.current) {
        clearTimeout(audioSyncTimeoutRef.current);
      }

      audioSyncTimeoutRef.current = setTimeout(() => {
        syncAudioPositions();
        timeJumpedRef.current = false;
      }, 50);
    }
  }, [currentTime]);

  // useEffect(() => {
  //   if (Math.abs(currentTime - lastTimeRef.current) > 0.1) {
  //     activeAudioElementsRef.current.forEach(audio => {
  //       const audioElement = audioRefs.current[audio.id];
  //       if (audioElement) {
  //         const audioLocalTime = Math.max(0, currentTime - audio.start);

  //         if (Math.abs(audioElement.currentTime - audioLocalTime) > 0.2) {
  //           console.log("Updating audio time for", audio.id, "to", audioLocalTime);
  //           audioElement.currentTime = audioLocalTime;
  //         }
  //       }
  //     });
  //   }
  //   lastTimeRef.current = currentTime;
  // }, [currentTime]);

  useEffect(() => {
    console.log("Playback state changed:", isPlaying);
    updateMediaStates();

    if (isPlaying) {
      timeJumpedRef.current = true;
      forceSyncRef.current = true;
      syncAudioPositions();
    }
  }, [isPlaying]);

  useEffect(() => {
    updateMediaStates();
  }, [volume, isMuted, audioPriority]);

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    toast.info(isMuted ? "Unmuted" : "Muted");
  };

  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause();
      });
      audioRefs.current = {};
      didInitialPlayRef.current = {};
    };
  }, []);
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
  }, [isPlaying, onPause, videoEnded, currentTime, duration, onTimeUpdate]);

  // Apply volume change to video
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // // Update volume and mute state
    // videoElement.volume = volume / 100;
    // videoElement.muted = isMuted;
    if (Math.abs(videoElement.currentTime - currentTime) > 0.2) {
      timeUpdateBlocker.current = true;
      videoElement.currentTime = currentTime;

      timeJumpedRef.current = true;
      forceSyncRef.current = true;

      if (audioSyncTimeoutRef.current) {
        clearTimeout(audioSyncTimeoutRef.current);
      }

      audioSyncTimeoutRef.current = setTimeout(() => {
        syncAudioPositions();
        timeUpdateBlocker.current = false;
        console.log("Forced audio sync after timeline position change");
      }, 50);
    }
  }, [currentTime]);

  const videoElement = elements.find(
    (el) =>
      el.type === "video" &&
      currentTime >= el.start &&
      currentTime <= el.end
  );

  const activeAudioElements = elements.filter(
    el => el.type === "audio" && currentTime >= el.start && currentTime <= el.end
  );

  // Handle restart
  const handleRestart = () => {
    setVideoEnded(false);
    onRestart();

    timeJumpedRef.current = true;
    forceSyncRef.current = true;
  };

  // Handle play with restart if needed
  const handlePlay = () => {
    if (videoEnded || currentTime >= duration - 0.1) {
      handleRestart();
    }
    onPlay();
  };

  const handleTimelineClick = (newTime: number) => {
    timeJumpedRef.current = true;
    forceSyncRef.current = true;
    onTimeUpdate(newTime);

    if (audioSyncTimeoutRef.current) {
      clearTimeout(audioSyncTimeoutRef.current);
    }

    audioSyncTimeoutRef.current = setTimeout(() => {
      syncAudioPositions();
      console.log("Forced audio sync after timeline click");
    }, 50);
  };


  // Apply crop styles if crop is defined
  const getVideoStyle = () => {
    if (videoElement && videoElement.content.crop) {
      const crop = elementCrop || (videoElement && videoElement.content.crop);
      if (crop) {
        return {
          display: isBuffering ? 'none' : 'block',
          objectFit: 'cover' as const,
          transform: `translate(${-crop.x}%, ${-crop.y}%) scale(${100 / crop.width}, ${100 / crop.height})`,
          transformOrigin: 'top left',
          width: '100%',
          height: '100%',
          transition: 'all 0.1s ease-out'
        };
      }

      return {
        display: isBuffering ? 'none' : 'block',
        objectFit: 'contain' as const,
        width: '100%',
        height: '100%',
        transition: 'all 0.1s ease-out'
      };
    }
  };

  // Force video element to update when crop changes
  useEffect(() => {
    if (videoRef.current && videoElement?.content.crop) {
      videoRef.current.style.objectPosition = `${videoElement.content.crop.x}% ${videoElement.content.crop.y}%`;
      videoRef.current.style.width = `${videoElement.content.crop.width}%`;
      videoRef.current.style.height = `${videoElement.content.crop.height}%`;
    }
  }, [videoElement?.content.crop]);


  return (
    <div className="panel w-full h-full flex flex-col">
      <div className="relative flex-1 bg-white overflow-hidden rounded">
        {videoElement ? (
          <>
            <video
              ref={videoRef}
              src={videoElement.content.src}
              className="absolute inset-0 m-auto"
              playsInline
              preload="auto"
              style={getVideoStyle()}
              onError={(e) => console.error("Video error:", e)}
              muted={videoMutedRef.current}
            />
            {isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="loader w-10 h-10 border-4 border-t-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-black/70 text-sm">
            No media at current position
          </div>
        )}
        {/* <div className="hidden"> */}
          <div className="absolute bottom-0 left-0 right-0 p-2 z-10">
            {activeAudioElements.length > 0 && (
              <div className="bg-white/60 rounded mb-2 p-2 text-white text-xs">
                <div className="flex items-center justify-between">
                  <span>Active Audio: {activeAudioElements.length} file(s)</span>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1 hover:bg-white/20 rounded"
                      onClick={() => {
                        const newPriority = audioPriority === 'video' ? 'audio' : 'video';
                        toast.info(`Audio priority set to ${newPriority === 'video' ? 'video audio' : 'uploaded audio'}`);
                      }}
                    >
                      {audioPriority === 'audio' ? 'Switch to Video Audio' : 'Switch to Uploaded Audio'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
                  onClick={handleMuteToggle}
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
                      onValueChange={(value) => setVolume(value[0])}
                      // disabled={isMuted}
                      // className={isMuted ? "opacity-50" : ""}
                    />
                  </div>
                )}
              </div>
              {audioPriority === 'audio' ? (
                <span className="text-xs bg-editor-accent text-white px-2 py-1 rounded ml-1">Audio Priority</span>
              ) : (
                <span className="text-xs bg-gray-600 text-white px-2 py-1 rounded ml-1">Video Priority</span>
              )}
            </div>
            <div className="text-xs font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>
        {/* Render audio elements - making sure they're in the DOM */}
        {activeAudioElements.map(audio => (
          <audio
            key={audio.id}
            ref={(el) => {
              if (el) audioRefs.current[audio.id] = el;
            }}
            src={audio.content.src}
            preload="auto"
            className="hidden"
            muted={isMuted || (audioPriority === 'video' && Boolean(videoRef.current)) || audio.content.muted || false}
          />
        ))}
      </div>
    // </div>
  );
};

export default Preview;
