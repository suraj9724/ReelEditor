
import React, { useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/UI/button";

interface PersistentAudioPlayerProps {
    audioFile: {
        name: string;
        url: string;
    };
    isPlaying: boolean;
    onPlayPause: () => void;
}

const PersistentAudioPlayer = ({
    audioFile,
    isPlaying,
    onPlayPause
}: PersistentAudioPlayerProps) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    // Sync playback state with timeline
    useEffect(() => {
        if (!audioRef.current) return;

        if (isPlaying) {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Error playing audio:", error);
                });
            }
        } else {
            audioRef.current.pause();
        }
    }, [isPlaying]);
    
    if (!audioFile) return null;

    return (
        <div className="p-3 border border-editor-border rounded-md bg-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium truncate max-w-[70%]">
                    {audioFile.name}
                </h3>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onPlayPause}
                >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </Button>
            </div>
            <audio
                ref={audioRef}
                src={audioFile.url}
                className="w-full"
                controls
            />
        </div>
    );
};

export default PersistentAudioPlayer;