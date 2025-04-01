import { useRef, useState, useEffect } from "react";
import { Music, Upload, Play, Pause } from "lucide-react";
import Panel from "../UI/Panel";
import { toast } from "sonner";
import { Button } from "@/components/UI/button";

interface AudioUploaderProps {
  onAudioUpload: (files: File[]) => void;
  isTimelinePlaying?: boolean;
  onTimelinePlayToggle?: () => void;
}

const AudioUploader = ({
  onAudioUpload,
  isTimelinePlaying = false,
  onTimelinePlayToggle
}: AudioUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<{ file: File; url: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const files = Array.from(e.target.files);
    processFiles(files);
  };

  const processFiles = (files: File[]) => {
    console.log("Processing files:", files);

    const audioFiles = files.filter(file =>
      file.type.startsWith('audio/')
    );

    console.log("Audio files found:", audioFiles);

    if (audioFiles.length === 0) {
      toast.error("Please upload audio files only");
      return;
    }

    // Create preview for the first file
    const file = audioFiles[0];
    const url = URL.createObjectURL(file);
    setPreviewAudio({ file, url });

    // Upload all files
    onAudioUpload(audioFiles);
    toast.success(`Added ${audioFiles.length} audio file${audioFiles.length !== 1 ? 's' : ''}`);
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !previewAudio) return;
    // If we have timeline control, use it to sync playback state
    if (onTimelinePlayToggle) {
      onTimelinePlayToggle();
      return;
    }

    // If no timeline control, manage local playback
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error("Failed to play audio:", err);
        toast.error("Failed to play audio preview");
      });
    }

    setIsPlaying(!isPlaying);
  };
  // Sync local play state with timeline play state
  useEffect(() => {
    if (audioRef.current && previewAudio) {
      if (isTimelinePlaying && !isPlaying) {
        audioRef.current.play().catch(err => {
          console.error("Failed to play audio:", err);
        });
        setIsPlaying(true);
      } else if (!isTimelinePlaying && isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isTimelinePlaying, isPlaying, previewAudio]);

  const handleEnded = () => {
    setIsPlaying(false);
    if (onTimelinePlayToggle && isTimelinePlaying) {
      onTimelinePlayToggle(); // Notify timeline that audio has ended
    }
  };
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Panel className="w-full" title="Add Audio">
      <div
        className={`
          w-full border-2 border-dashed rounded-lg p-6 
          flex flex-col items-center justify-center gap-4 
          transition-colors duration-200 cursor-pointer
          ${isDragging
            ? "border-editor-accent bg-editor-accent/5"
            : "border-editor-border hover:border-editor-muted/50 hover:bg-editor-background/30"
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <div className="w-16 h-16 rounded-full bg-editor-accent/10 flex items-center justify-center">
          <Music
            className={`transition-colors duration-200 ${isDragging ? "text-editor-accent" : "text-editor-muted"
              }`}
            size={24}
          />
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground mb-1">
            {isDragging ? "Drop your audio here" : "Drag & drop audio files"}
          </p>
          <p className="text-sm text-editor-muted">
            Or click to select from your device
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
      {previewAudio && (
        <div className="mt-4 p-3 border border-editor-border rounded-md">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm f              {isTimelinePlaying || isPlaying ? <Pause size={16} /> : <Play size={16} />}
ont-medium truncate max-w-[70%]">
              {previewAudio.file.name}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={togglePlayPause}
            >
              {isTimelinePlaying || isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </Button>
          </div>
          <audio
            ref={audioRef}
            src={previewAudio.url}
            className="w-full"
            onEnded={handleEnded}
            controls
          />
        </div>
      )}
    </Panel>
  );
};

export default AudioUploader;
