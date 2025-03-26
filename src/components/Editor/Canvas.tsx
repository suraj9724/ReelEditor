import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Maximize, Minimize, ZoomIn, ZoomOut, Trash2 } from "lucide-react";
import IconButton from "../UI/IconButton";
import { CanvasElement } from "@/types/timeline";

interface CanvasProps {
  width: number;
  height: number;
  elements: CanvasElement[];
  selectedElementId: string | null;
  onElementSelect: (id: string | null) => void;
  onElementMove: (id: string, x: number, y: number) => void;
  onElementResize: (id: string, width: number, height: number) => void;
  onElementDelete?: (id: string) => void;
  currentTime: number;
  isPlaying: boolean;
}

const Canvas = ({
  width,
  height,
  elements,
  selectedElementId,
  onElementSelect,
  onElementMove,
  onElementResize,
  onElementDelete,
  currentTime,
  isPlaying,
}: CanvasProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 });
  const [cropArea, setCropArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string | null>("freeform");

  // Aspect ratio options
  const aspectRatioOptions = {
    "freeform": null,
    "1:1": 1,
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "5:4": 5 / 4,
    "4:5": 4 / 5,
    "4:3": 4 / 3,
    "3:4": 3 / 4,
    "3:2": 3 / 2,
  };

  // Filter elements for current time
  const visibleElements = elements.filter(
    (el) => currentTime >= el.start && currentTime <= el.end
  );

  // Sync video elements with current time
  useEffect(() => {
    visibleElements.forEach((element) => {
      if (element.type === "video" && videoRefs.current[element.id]) {
        const video = videoRefs.current[element.id];
        if (video) {
          // Only update time if it differs significantly to avoid playback issues
          const targetTime = currentTime - element.start;
          if (Math.abs(video.currentTime - targetTime) > 0.5) {
            video.currentTime = targetTime;
          }

          // Handle play/pause based on isPlaying prop and time range
          if (currentTime < element.start || currentTime > element.end) {
            video.pause();
          } else {
            if (isPlaying) {
              video.play().catch(() => {
                // Ignore play errors (e.g., if video is already playing)
              });
            } else {
              video.pause();
            }
          }
        }
      }
    });
  }, [currentTime, visibleElements, isPlaying]);

  // Handle element selection
  const handleElementClick = (
    e: React.MouseEvent<HTMLDivElement>,
    elementId: string
  ) => {
    e.stopPropagation();
    onElementSelect(elementId);
  };

  // Handle element dragging
  const handleElementDragStart = (
    e: React.MouseEvent<HTMLDivElement>,
    elementId: string
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Only left mouse button

    const element = elements.find((el) => el.id === elementId);
    if (!element) return;

    setIsDragging(true);
    setDragStartPos({
      x: e.clientX - element.x,
      y: e.clientY - element.y,
    });
    onElementSelect(elementId);

    // Add mousemove and mouseup listeners to document
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Handle element resizing
  const handleResizeStart = (
    e: React.MouseEvent<HTMLDivElement>,
    elementId: string,
    direction: string
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Only left mouse button

    setIsResizing(true);
    setResizeDirection(direction);
    onElementSelect(elementId);

    // Add mousemove and mouseup listeners
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing || !selectedElementId || !canvasRef.current || !resizeDirection) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const element = elements.find(el => el.id === selectedElementId);
    if (!element) return;

    const canvasX = (e.clientX - rect.left) / zoom;
    const canvasY = (e.clientY - rect.top) / zoom;

    let newWidth = element.width;
    let newHeight = element.height;

    switch (resizeDirection) {
      case 'se':
        newWidth = Math.max(50, canvasX - element.x);
        newHeight = Math.max(50, canvasY - element.y);
        break;
      case 'sw':
        newWidth = Math.max(50, element.x + element.width - canvasX);
        newHeight = Math.max(50, canvasY - element.y);
        break;
      case 'ne':
        newWidth = Math.max(50, canvasX - element.x);
        newHeight = Math.max(50, element.y + element.height - canvasY);
        break;
      case 'nw':
        newWidth = Math.max(50, element.x + element.width - canvasX);
        newHeight = Math.max(50, element.y + element.height - canvasY);
        break;
      default:
        break;
    }

    // Keep aspect ratio if it's a video or image
    if ((element.type === 'video' || element.type === 'image') && (newWidth !== element.width)) {
      const aspectRatio = element.width / element.height;
      newHeight = newWidth / aspectRatio;
    }

    onElementResize(selectedElementId, newWidth, newHeight);
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeDirection(null);
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !selectedElementId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();

    // Calculate position relative to the canvas with zoom factor
    const newX = (e.clientX - dragStartPos.x - rect.left) / zoom;
    const newY = (e.clientY - dragStartPos.y - rect.top) / zoom;

    // Limit to canvas boundaries
    const boundedX = Math.max(0, Math.min(width - 10, newX));
    const boundedY = Math.max(0, Math.min(height - 10, newY));

    onElementMove(selectedElementId, boundedX, boundedY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  // Handle canvas click to deselect
  const handleCanvasClick = () => {
    onElementSelect(null);
  };

  // Handle zoom controls
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.5));
  };

  // Handle fullscreen toggle
  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle element deletion
  const handleDeleteElement = (e: React.MouseEvent<HTMLDivElement>, elementId: string) => {
    e.stopPropagation();
    if (onElementDelete) {
      onElementDelete(elementId);
      onElementSelect(null);
    }
  };

  // Handle crop start
  const handleCropStart = (e: React.MouseEvent<HTMLDivElement>, elementId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Only left mouse button

    const element = elements.find((el) => el.id === elementId);
    if (!element || element.type !== "video") return;

    setIsCropping(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setCropStart({ x, y });
    setCropArea({ x, y, width: 0, height: 0 });
    onElementSelect(elementId);

    // Add mousemove and mouseup listeners
    document.addEventListener("mousemove", handleCropMove);
    document.addEventListener("mouseup", handleCropEnd);
  };

  // Handle crop move
  const handleCropMove = (e: MouseEvent) => {
    if (!isCropping || !selectedElementId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (cropArea) {
      let width = Math.max(0, x - cropStart.x);
      let height = Math.max(0, y - cropStart.y);

      // Apply aspect ratio if selected
      if (selectedAspectRatio && selectedAspectRatio !== "freeform") {
        const ratio = aspectRatioOptions[selectedAspectRatio];
        if (ratio) {
          // Calculate which dimension to adjust based on mouse movement
          const widthRatio = width / height;
          if (widthRatio > ratio) {
            // Width is too large, adjust height
            height = width / ratio;
          } else {
            // Height is too large, adjust width
            width = height * ratio;
          }
        }
      }

      setCropArea({
        x: cropStart.x,
        y: cropStart.y,
        width,
        height
      });
    }
  };

  // Handle crop end
  const handleCropEnd = () => {
    if (!isCropping || !selectedElementId || !cropArea) return;

    const element = elements.find((el) => el.id === selectedElementId);
    if (!element || element.type !== "video") return;

    // Apply the crop
    const crop = {
      x: cropArea.x,
      y: cropArea.y,
      width: cropArea.width,
      height: cropArea.height
    };

    // Update the element's content with the new crop
    element.content = {
      ...element.content,
      crop
    };

    setIsCropping(false);
    setCropArea(null);
    document.removeEventListener("mousemove", handleCropMove);
    document.removeEventListener("mouseup", handleCropEnd);
  };

  // Handle aspect ratio change
  const handleAspectRatioChange = (ratio: string) => {
    setSelectedAspectRatio(ratio);
    if (cropArea) {
      const currentRatio = cropArea.width / cropArea.height;
      const targetRatio = aspectRatioOptions[ratio];

      if (targetRatio) {
        let newWidth = cropArea.width;
        let newHeight = cropArea.height;

        if (currentRatio > targetRatio) {
          newHeight = newWidth / targetRatio;
        } else {
          newWidth = newHeight * targetRatio;
        }

        setCropArea({
          ...cropArea,
          width: newWidth,
          height: newHeight
        });
      }
    }
  };

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
      document.removeEventListener("mousemove", handleCropMove);
      document.removeEventListener("mouseup", handleCropEnd);
    };
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col bg-editor-background p-4 overflow-hidden transition-all duration-300 h-full w-full",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      <div className="flex justify-between items-center mb-2 gap-1">
        <h2 className="text-sm font-medium">Canvas</h2>
        <div className="flex gap-1">
          <IconButton
            icon={ZoomOut}
            onClick={handleZoomOut}
            tooltip="Zoom Out"
            disabled={zoom <= 0.5}
          />
          <div className="px-2 py-1 rounded bg-white text-xs flex items-center">
            {Math.round(zoom * 100)}%
          </div>
          <IconButton
            icon={ZoomIn}
            onClick={handleZoomIn}
            tooltip="Zoom In"
            disabled={zoom >= 2}
          />
          <IconButton
            icon={isFullscreen ? Minimize : Maximize}
            onClick={handleFullscreenToggle}
            tooltip={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-[#1E1E1E] rounded-lg overflow-hidden">
        <div
          ref={canvasRef}
          className="relative w-full h-full flex items-center justify-center"
          onClick={handleCanvasClick}
        >
          <div
            className="relative"
            style={{
              width: width * zoom,
              height: height * zoom,
              transform: `scale(${zoom})`,
              transformOrigin: "center",
            }}
          >
            {visibleElements.map((element) => (
              <div
                key={element.id}
                className={cn(
                  "absolute canvas-element cursor-move",
                  selectedElementId === element.id &&
                  "ring-2 ring-editor-accent ring-offset-1"
                )}
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  transform: `rotate(${element.rotation}deg)`,
                  zIndex: selectedElementId === element.id ? 10 : 1,
                }}
                onClick={(e) => handleElementClick(e, element.id)}
                onMouseDown={(e) => {
                  if (element.type === "video" && selectedElementId === element.id) {
                    handleCropStart(e, element.id);
                  } else {
                    handleElementDragStart(e, element.id);
                  }
                }}
              >
                {element.type === "text" && (
                  <div
                    className="w-full h-full flex items-center justify-center pointer-events-none"
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
                  <div className="w-full h-full overflow-hidden">
                    <img
                      src={element.content.src}
                      alt="Canvas image"
                      className="w-full h-full object-cover pointer-events-none"
                      style={{
                        transform: element.content.crop ?
                          `translate(
                            ${-element.content.crop.x}%, 
                            ${-element.content.crop.y}%
                          )` : 'none'
                      }}
                    />
                  </div>
                )}

                {element.type === "video" && (
                  <div className="w-full h-full overflow-hidden flex items-center justify-center bg-transparent">
                    <video
                      ref={(el) => (videoRefs.current[element.id] = el)}
                      src={element.content.src}
                      className="w-full h-full object-contain pointer-events-none"
                      style={{
                        transform: isCropping && selectedElementId === element.id && cropArea ?
                          `translate(
                            ${-cropArea.x}%, 
                            ${-cropArea.y}%
                          ) scale(${100 / cropArea.width}, ${100 / cropArea.height})` :
                          element.content.crop ?
                            `translate(
                              ${-element.content.crop.x}%, 
                              ${-element.content.crop.y}%
                            ) scale(${100 / element.content.crop.width}, ${100 / element.content.crop.height})` : 'none'
                      }}
                      muted
                      autoPlay={false}
                      loop={false}
                      playsInline
                      preload="metadata"
                    />
                    {isCropping && selectedElementId === element.id && cropArea && (
                      <>
                        <div
                          className="absolute border-2 border-white cursor-crosshair"
                          style={{
                            left: `${cropArea.x}%`,
                            top: `${cropArea.y}%`,
                            width: `${cropArea.width}%`,
                            height: `${cropArea.height}%`,
                          }}
                        />
                        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                          <div className="absolute inset-0 bg-black/50" style={{
                            clipPath: `inset(
                              ${cropArea.y}% 
                              ${100 - cropArea.x - cropArea.width}% 
                              ${100 - cropArea.y - cropArea.height}% 
                              ${cropArea.x}%
                            )`
                          }} />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {selectedElementId === element.id && (
                  <>
                    <div
                      className="absolute top-0 left-0 w-3 h-3 bg-white border border-editor-accent rounded-full cursor-nw-resize -translate-x-1/2 -translate-y-1/2"
                      onMouseDown={(e) => handleResizeStart(e, element.id, 'nw')}
                    />
                    <div
                      className="absolute top-0 right-0 w-3 h-3 bg-white border border-editor-accent rounded-full cursor-ne-resize translate-x-1/2 -translate-y-1/2"
                      onMouseDown={(e) => handleResizeStart(e, element.id, 'ne')}
                    />
                    <div
                      className="absolute bottom-0 left-0 w-3 h-3 bg-white border border-editor-accent rounded-full cursor-sw-resize -translate-x-1/2 translate-y-1/2"
                      onMouseDown={(e) => handleResizeStart(e, element.id, 'sw')}
                    />
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 bg-white border border-editor-accent rounded-full cursor-se-resize translate-x-1/2 translate-y-1/2"
                      onMouseDown={(e) => handleResizeStart(e, element.id, 'se')}
                    />
                    {onElementDelete && (
                      <div
                        className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white p-1 rounded cursor-pointer hover:bg-red-600 transition-colors"
                        onClick={(e) => handleDeleteElement(e, element.id)}
                        title={`Delete ${element.type}`}
                      >
                        <Trash2 size={16} />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Canvas;