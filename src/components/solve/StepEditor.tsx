"use client";

import { useState, useRef } from "react";
import Button from "@/components/ui/Button";
import { Camera, Plus, Trash2 } from "lucide-react";
import { fileToBase64 } from "@/lib/utils";

interface StepEditorProps {
  onSubmitSteps: (question: string, steps: string[]) => void;
  onSubmitImage: (question: string, imageBase64: string, mimeType: string) => void;
  loading: boolean;
}

export default function StepEditor({ onSubmitSteps, onSubmitImage, loading }: StepEditorProps) {
  const [question, setQuestion] = useState("");
  const [steps, setSteps] = useState<string[]>([""]);
  const [mode, setMode] = useState<"text" | "image">("text");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddStep = () => {
    setSteps([...steps, ""]);
  };

  const handleStepChange = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length > 1) {
      const newSteps = [...steps];
      newSteps.splice(index, 1);
      setSteps(newSteps);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    if (mode === "text") {
      const validSteps = steps.filter(s => s.trim() !== "");
      if (validSteps.length === 0) return;
      onSubmitSteps(question, validSteps);
    } else {
      if (!imageFile) return;
      try {
        const base64 = await fileToBase64(imageFile);
        onSubmitImage(question, base64, imageFile.type);
      } catch (err) {
        console.error("Failed to read image", err);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="solve-question" className="mb-2 block text-sm font-medium text-ink">The question</label>
        <textarea
          id="solve-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g., Solve for x: 2x^2 + 5x - 3 = 0"
          className="h-24 w-full resize-none p-4"
          disabled={loading}
          required
        />
      </div>

      <div className="flex gap-2" role="group" aria-label="Input method">
        <Button 
          type="button" 
          variant={mode === "text" ? "primary" : "secondary"} 
          onClick={() => setMode("text")}
          size="sm"
        >
          Type the steps
        </Button>
        <Button 
          type="button" 
          variant={mode === "image" ? "primary" : "secondary"} 
          onClick={() => setMode("image")}
          size="sm"
        >
          Upload a photo
        </Button>
      </div>

      {mode === "text" ? (
        <div className="space-y-3">
          <p className="mb-2 text-sm font-medium text-ink">Your solution steps</p>
          {steps.map((step, index) => (
            <div key={index} className="flex gap-2 items-start">
              <span className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-pen/10 text-pen font-semibold text-sm border border-pen/25 mt-1.5">
                {index + 1}
              </span>
              <textarea
                value={step}
                onChange={(e) => handleStepChange(index, e.target.value)}
                placeholder={`Step ${index + 1}`}
                className="min-h-[60px] flex-1 p-3"
                aria-label={`Step ${index + 1}`}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => handleRemoveStep(index)}
                disabled={steps.length <= 1 || loading}
                className="mt-1 flex-none rounded-lg p-2 text-faint transition-colors hover:text-margin disabled:opacity-40"
              >
                <Trash2 className="h-5 w-5" aria-label="Remove step" />
              </button>
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={handleAddStep} disabled={loading} size="sm" className="mt-2">
            <Plus className="h-4 w-4" aria-hidden /> Add a step
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="mb-2 text-sm font-medium text-ink">Photo of your working</p>
          
          {!imagePreview ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center rounded-card border-2 border-dashed border-line-strong p-10 text-center transition-colors hover:border-pen hover:bg-pen-wash"
            >
              <Camera className="mb-3 h-8 w-8 text-pen" aria-hidden />
              <span className="mb-1 font-medium text-ink">Choose a photo</span>
              <span className="text-sm text-muted">Handwritten solutions work too</span>
            </button>
          ) : (
            <div className="relative rounded-card overflow-hidden border border-line group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Solution preview" className="max-h-96 w-full bg-sunk object-contain" />
              <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center justify-center transition-opacity">
                <Button type="button" variant="secondary" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                  Remove Image
                </Button>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>
      )}

      <div className="pt-4 border-t border-line flex justify-end">
        <Button 
          type="submit" 
          disabled={!question.trim() || (mode === "text" && steps[0].trim() === "") || (mode === "image" && !imageFile) || loading}
          loading={loading}
        >
          Check my working
        </Button>
      </div>
    </form>
  );
}
