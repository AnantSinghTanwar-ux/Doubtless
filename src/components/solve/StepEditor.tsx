"use client";

import { useState, useRef } from "react";
import Button from "@/components/ui/Button";
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
        <label className="block text-sm font-medium text-gray-300 mb-2">The Question / Problem</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g., Solve for x: 2x^2 + 5x - 3 = 0"
          className="w-full h-24 p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-white placeholder-gray-500 resize-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          disabled={loading}
          required
        />
      </div>

      <div className="flex gap-2">
        <Button 
          type="button" 
          variant={mode === "text" ? "primary" : "secondary"} 
          onClick={() => setMode("text")}
          size="sm"
        >
          Type Solution Steps
        </Button>
        <Button 
          type="button" 
          variant={mode === "image" ? "primary" : "secondary"} 
          onClick={() => setMode("image")}
          size="sm"
        >
          Upload Photo of Work
        </Button>
      </div>

      {mode === "text" ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300 mb-2">Your Solution Steps</label>
          {steps.map((step, index) => (
            <div key={index} className="flex gap-2 items-start">
              <span className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 font-semibold text-sm border border-blue-500/20 mt-1">
                {index + 1}
              </span>
              <textarea
                value={step}
                onChange={(e) => handleStepChange(index, e.target.value)}
                placeholder={`Step ${index + 1}`}
                className="flex-1 min-h-[60px] p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 transition-all"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => handleRemoveStep(index)}
                disabled={steps.length <= 1 || loading}
                className="flex-none p-2 mt-1 text-gray-500 hover:text-red-400 disabled:opacity-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          <Button type="button" variant="ghost" onClick={handleAddStep} disabled={loading} size="sm" className="mt-2">
            + Add Step
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300 mb-2">Upload Photo</label>
          
          {!imagePreview ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-blue-500/50 bg-white/[0.02] hover:bg-blue-500/5 rounded-2xl p-10 text-center cursor-pointer transition-all duration-300"
            >
              <div className="text-4xl mb-3">📸</div>
              <p className="text-white font-medium mb-1">Click to upload photo</p>
              <p className="text-sm text-gray-500">Handwritten solutions supported</p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-white/10 group">
              <img src={imagePreview} alt="Solution preview" className="w-full object-contain max-h-96 bg-black/50" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
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

      <div className="pt-4 border-t border-white/10 flex justify-end">
        <Button 
          type="submit" 
          disabled={!question.trim() || (mode === "text" && steps[0].trim() === "") || (mode === "image" && !imageFile) || loading}
          loading={loading}
        >
          Evaluate Solution
        </Button>
      </div>
    </form>
  );
}
