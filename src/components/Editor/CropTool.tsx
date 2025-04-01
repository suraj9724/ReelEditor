import { useState, useEffect, useRef } from "react";
import { Crop, RotateCcw, MoveHorizontal, MoveVertical, Check, X } from "lucide-react";
import { TimelineElement } from "@/types/timeline";
import Panel from "../UI/Panel";
import { Button } from "@/components/UI/button";
import { Slider } from "@/components/UI/slider";
import { toast } from "sonner";
import { AspectRatio } from "@/components/UI/aspect-ratio";

interface CropToolProps {
  elements: TimelineElement[];
  selectedElementId: string | null;
  onCropApply: (id: string, crop: { x: number; y: number; width: number; height: number }) => void;
}

interface AspectRatioOption {
  id: string;
  name: string;
  value: number | null; // null for freeform
  icon: string;
}

const CropTool = ({ elements, selectedElementId, onCropApply }: CropToolProps) => {
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropWidth, setCropWidth] = useState(100);
  const [cropHeight, setCropHeight] = useState(100);
  const [previewCrop, setPreviewCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string | null>("freeform");
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const previewRef = useRef<HTMLDivElement>(null);

  // Aspect ratio options
  const aspectRatioOptions: AspectRatioOption[] = [
    { id: "freeform", name: "Freeform", value: null, icon: "⊞" },
    { id: "1:1", name: "1:1", value: 1, icon: "□" },
    { id: "16:9", name: "16:9", value: 16 / 9, icon: "▭" },
    { id: "9:16", name: "9:16", value: 9 / 16, icon: "▯" },
    { id: "5:4", name: "5:4", value: 5 / 4, icon: "▭" },
    { id: "4:5", name: "4:5", value: 4 / 5, icon: "▯" },
    { id: "4:3", name: "4:3", value: 4 / 3, icon: "▭" },
    { id: "3:4", name: "3:4", value: 3 / 4, icon: "▯" },
    { id: "3:2", name: "3:2", value: 3 / 2, icon: "▭" },
  ];

  // Find the selected element
  const selectedElement = selectedElementId
    ? elements.find(el => el.id === selectedElementId)
    : null;

  // Reset crop values when selected element changes
  useEffect(() => {
    if (selectedElement) {
      if (selectedElement.type === 'video' || selectedElement.type === 'image') {
        // Initialize with existing crop values or defaults
        const crop = selectedElement.content.crop || { x: 0, y: 0, width: 100, height: 100 };
        setCropX(crop.x);
        setCropY(crop.y);
        setCropWidth(crop.width);
        setCropHeight(crop.height);
        setPreviewCrop(crop);
        // setSelectedAspectRatio("freeform"); // Reset aspect ratio selection
      }
    } else {
      setSelectedAspectRatio("freeform"); // Reset aspect ratio when no element is selected
    }
  }, [selectedElement]);

  // Update preview crop as user adjusts sliders
  const updatePreviewCrop = (x = cropX, y = cropY, width = cropWidth, height = cropHeight) => {
    const newCrop = {
      x,
      y,
      width,
      height
    };

    setPreviewCrop(newCrop);
  };

  // Debounced crop application
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedElementId && previewCrop) {
        onCropApply(selectedElementId, previewCrop);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [previewCrop, selectedElementId, onCropApply]);

  // Update preview on slider change
  useEffect(() => {
    updatePreviewCrop();
  }, [cropX, cropY, cropWidth, cropHeight]);

  // Handle mouse down on preview for freeform selection
  const handlePreviewMouseDown = (e: React.MouseEvent) => {
    if (selectedAspectRatio !== "freeform" || showFullPreview) return;

    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsSelecting(true);
    setSelectionStart({ x, y });
    setCropX(x);
    setCropY(y);
    setCropWidth(0);
    setCropHeight(0);
  };

  // Handle mouse move for freeform selection
  const handlePreviewMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !previewRef.current || selectedAspectRatio !== "freeform" || showFullPreview) return;

    const rect = previewRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Calculate width and height based on selection direction
    let newX = Math.min(selectionStart.x, x);
    let newY = Math.min(selectionStart.y, y);
    let newWidth = Math.abs(x - selectionStart.x);
    let newHeight = Math.abs(y - selectionStart.y);

    // Constrain to bounds
    newX = Math.max(0, newX);
    newY = Math.max(0, newY);
    newWidth = Math.min(100 - newX, newWidth);
    newHeight = Math.min(100 - newY, newHeight);

    setCropX(newX);
    setCropY(newY);
    setCropWidth(newWidth);
    setCropHeight(newHeight);
  };

  // Handle mouse up for freeform selection
  const handlePreviewMouseUp = () => {
    setIsSelecting(false);
    // Ensure minimum dimensions
    if (cropWidth < 5) setCropWidth(5);
    if (cropHeight < 5) setCropHeight(5);
  };

  // Handle mouse down on crop boundary
  const handleCropMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move for dragging crop boundary
  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !previewRef.current || !previewCrop) return;

    const rect = previewRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;

    // Calculate new position
    let newX = cropX + deltaX;
    let newY = cropY + deltaY;

    // Constrain to bounds
    newX = Math.max(0, Math.min(newX, 100 - cropWidth));
    newY = Math.max(0, Math.min(newY, 100 - cropHeight));

    if (newX !== cropX || newY !== cropY) {
      setCropX(newX);
      setCropY(newY);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Handle mouse up for dragging crop boundary
  const handleCropMouseUp = () => {
    setIsDragging(false);
  };

  // Apply the crop
  const handleApplyCrop = () => {
    if (!selectedElementId || !selectedElement) return;

    if (selectedElement.type !== 'video' && selectedElement.type !== 'image') {
      toast.error("Cropping is only available for video and image elements");
      return;
    }

    const crop = {
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight
    };

    onCropApply(selectedElementId, crop);
    toast.success("Crop applied successfully");
  };

  // Reset crop to default
  const handleResetCrop = () => {
    const defaultCrop = { x: 0, y: 0, width: 100, height: 100 };
    setCropX(0);
    setCropY(0);
    setCropWidth(100);
    setCropHeight(100);
    setSelectedAspectRatio("freeform");

    if (selectedElementId) {
      onCropApply(selectedElementId, defaultCrop);
      setPreviewCrop(defaultCrop);
    }
  };

  // Change aspect ratio
  const handleAspectRatioChange = (ratioId: string) => {
    setSelectedAspectRatio(ratioId);

    const ratioOption = aspectRatioOptions.find(option => option.id === ratioId);
    if (!ratioOption) return;

    // For freeform, don't change the current crop dimensions
    if (ratioOption.id === "freeform") {
      setShowFullPreview(true);
      onCropApply(selectedElementId!, null); // Apply null crop for freeform
      return;
    } else {
      setShowFullPreview(false);
    }

    // Calculate new dimensions based on the aspect ratio
    let newWidth = cropWidth;
    let newHeight = cropHeight;

    // Keep width and adjust height
    newHeight = newWidth / ratioOption.value;

    // Ensure height is not greater than 100
    if (newHeight > 100) {
      newHeight = 100;
      newWidth = newHeight * ratioOption.value;
    }

    setCropWidth(newWidth);
    setCropHeight(newHeight);

    updatePreviewCrop(cropX, cropY, newWidth, newHeight);
  };

  if (!selectedElement || (selectedElement.type !== 'video' && selectedElement.type !== 'image')) {
    return (
      <Panel title="Crop Tool" className="p-4">
        <p className="text-sm text-editor-muted text-center">
          Select a video or image to crop
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Crop Tool" className="p-4">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Crop</h3>
          <button className="text-gray-500 hover:text-gray-700" onClick={handleResetCrop}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium">Preview</h4>
              <button
                className="text-xs text-editor-accent hover:underline"
                onClick={() => setShowFullPreview(!showFullPreview)}
                disabled={selectedAspectRatio === 'freeform'}
              >
                {showFullPreview ? 'Show Cropped' : 'Show Full'}
              </button>
            </div>
            <div
              className="relative border border-gray-200 rounded-md overflow-hidden"
              ref={previewRef}
              onMouseDown={handlePreviewMouseDown}
              onMouseMove={handlePreviewMouseMove}
              onMouseUp={handlePreviewMouseUp}
              onMouseLeave={handlePreviewMouseUp}
            >
              <div className="relative" style={{ paddingBottom: '56.25%' }}>
                <div className="absolute inset-0 overflow-hidden">
                  {selectedElement.type === 'video' && (
                    <div className="w-full h-full relative overflow-hidden">
                      <div
                        className="absolute inset-0 bg-black"
                        style={{
                          clipPath: !showFullPreview && previewCrop ?
                            `inset(
                              ${previewCrop.y}% 
                              ${100 - previewCrop.x - previewCrop.width}% 
                              ${100 - previewCrop.y - previewCrop.height}% 
                              ${previewCrop.x}%
                            )` : 'none'
                        }}
                      >
                        <video
                          src={selectedElement.content.src}
                          className="w-full h-full"
                          style={{
                            transform: previewCrop ?
                              `translate(
                                ${-previewCrop.x}%, 
                                ${-previewCrop.y}%
                              ) scale(${100 / previewCrop.width}, ${100 / previewCrop.height})` : 'none'
                          }}
                          muted
                          autoPlay
                          loop
                        />
                      </div>
                      {!showFullPreview && previewCrop && (
                        <div
                          className="absolute border-2 border-white border-dashed cursor-move"
                          style={{
                            display: selectedAspectRatio === 'freeform' && !showFullPreview ? 'block' : 'none',
                            left: `${previewCrop?.x}%`,
                            top: `${previewCrop?.y}%`,
                            width: `${previewCrop?.width}%`,
                            height: `${previewCrop?.height}%`,
                          }}
                          onMouseDown={handleCropMouseDown}
                        >
                          <div className="absolute -top-1 -left-1 w-2 h-2 bg-white rounded-full cursor-nwse-resize" />
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full cursor-nesw-resize" />
                          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white rounded-full cursor-nesw-resize" />
                          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white rounded-full cursor-nwse-resize" />
                        </div>
                      )}
                      {isSelecting && selectedAspectRatio === "freeform" && (
                        <div
                          className="absolute border-2 border-blue-400 bg-blue-400 bg-opacity-20"
                          style={{
                            left: `${cropX}%`,
                            top: `${cropY}%`,
                            width: `${cropWidth}%`,
                            height: `${cropHeight}%`,
                          }}
                        />
                      )}
                    </div>
                  )}
                  {selectedElement.type === 'image' && (
                    <div
                      className="w-full h-full bg-black"
                      style={{
                        clipPath: !showFullPreview && previewCrop ?
                          `inset(
                            ${previewCrop.y}% 
                            ${100 - previewCrop.x - previewCrop.width}% 
                            ${100 - previewCrop.y - previewCrop.height}% 
                            ${previewCrop.x}%
                          )` : 'none'
                      }}
                    >
                      <img
                        src={selectedElement.content.src}
                        className="w-full h-full object-cover"
                        style={{
                          transform: previewCrop ?
                            `translate(
                              ${-previewCrop.x}%, 
                              ${-previewCrop.y}%
                            )` : 'none'
                        }}
                        alt="Preview"
                      />
                      {!showFullPreview && previewCrop && (
                        <div
                          className="absolute border-2 border-white border-dashed cursor-move"
                          style={{
                            display: selectedAspectRatio === 'freeform' && !showFullPreview ? 'block' : 'none',
                            left: `${previewCrop?.x}%`,
                            top: `${previewCrop?.y}%`,
                            width: `${previewCrop?.width}%`,
                            height: `${previewCrop?.height}%`,
                          }}
                          onMouseDown={handleCropMouseDown}
                        >
                          <div className="absolute -top-1 -left-1 w-2 h-2 bg-white rounded-full cursor-nwse-resize" />
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full cursor-nesw-resize" />
                          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white rounded-full cursor-nesw-resize" />
                          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white rounded-full cursor-nwse-resize" />
                        </div>
                      )}
                      {isSelecting && selectedAspectRatio === "freeform" && (
                        <div
                          className="absolute border-2 border-blue-400 bg-blue-400 bg-opacity-20"
                          style={{
                            left: `${cropX}%`,
                            top: `${cropY}%`,
                            width: `${cropWidth}%`,
                            height: `${cropHeight}%`,
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">Aspect ratio</h4>
            <div className="grid grid-cols-3 gap-2">
              {aspectRatioOptions.map((option) => (
                <button
                  key={option.id}
                  className={`flex flex-col items-center justify-center p-2 border rounded-md transition-colors ${selectedAspectRatio === option.id
                    ? 'border-purple-500 border-2 bg-purple-50 text-purple-600'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  onClick={() => handleAspectRatioChange(option.id)}
                >
                  <span className="text-lg font-medium mb-1">{option.icon}</span>
                  <span className="text-xs text-gray-500">{option.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm font-medium mb-2">Horizontal Position</div>
            <Slider
              value={[cropX]}
              min={0}
              max={100 - cropWidth}
              step={0.1}
              onValueChange={(value) => setCropX(value[0])}
            />
            <div className="flex justify-between text-xs text-editor-muted mt-1">
              <span>Left</span>
              <span>{cropX.toFixed(1)}%</span>
              <span>Right</span>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm font-medium mb-2">Vertical Position</div>
            <Slider
              value={[cropY]}
              min={0}
              max={100 - cropHeight}
              step={0.1}
              onValueChange={(value) => setCropY(value[0])}
            />
            <div className="flex justify-between text-xs text-editor-muted mt-1">
              <span>Top</span>
              <span>{cropY.toFixed(1)}%</span>
              <span>Bottom</span>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm font-medium mb-2">Width</div>
            <Slider
              value={[cropWidth]}
              min={5}
              max={100}
              step={0.1}
              onValueChange={(value) => {
                setCropWidth(value[0]);
                if (selectedAspectRatio && selectedAspectRatio !== "freeform") {
                  const ratio = aspectRatioOptions.find(opt => opt.id === selectedAspectRatio);
                  if (ratio && ratio.value) {
                    setCropHeight(value[0] / ratio.value);
                  }
                }
              }}
            />
            <div className="text-xs text-right text-editor-muted mt-1">
              {cropWidth.toFixed(1)}%
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm font-medium mb-2">Height</div>
            <Slider
              value={[cropHeight]}
              min={5}
              max={100}
              step={0.1}
              onValueChange={(value) => {
                setCropHeight(value[0]);
                if (selectedAspectRatio && selectedAspectRatio !== "freeform") {
                  const ratio = aspectRatioOptions.find(opt => opt.id === selectedAspectRatio);
                  if (ratio && ratio.value) {
                    setCropWidth(value[0] * ratio.value);
                  }
                }
              }}
            />
            <div className="text-xs text-right text-editor-muted mt-1">
              {cropHeight.toFixed(1)}%
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleResetCrop}
            >
              Reset
            </Button>
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleApplyCrop}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
};

export default CropTool;