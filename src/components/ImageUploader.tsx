// components/ImageUploader.tsx
import { useState, useCallback } from "react";
import { UploadCloud, X } from "lucide-react";
import { notifyError } from "@/lib/notify";

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  initialImage?: string;
}

const ImageUploader = ({ onImageUpload, initialImage }: ImageUploaderProps) => {
  const [previewImage, setPreviewImage] = useState<string | null>(
    initialImage || null
  );
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = useCallback(
    (file: File) => {
      if (!file.type.match("image.*")) {
        notifyError(null, "Veuillez choisir un fichier image valide.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      onImageUpload(file);
    },
    [onImageUpload]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0]);
    }
  };

  const removeImage = () => {
    setPreviewImage(null);
    onImageUpload(null as any); // Pass null to indicate removal
  };

  return (
    <div className="space-y-2">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
        } ${previewImage ? "hidden" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <UploadCloud className="w-8 h-8 text-gray-400" />
          <p className="text-sm text-gray-600">
            Drag & drop an image here, or click to select
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
            id="image-upload"
          />
          <label
            htmlFor="image-upload"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer text-sm"
          >
            Select Image
          </label>
        </div>
      </div>

      {previewImage && (
        <div className="relative group">
          <img
            src={previewImage}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
