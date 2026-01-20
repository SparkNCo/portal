"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, File, X, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface UploadedFile {
  name: string
  size: string
  status: "uploading" | "complete"
}

export function UploadDocument() {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      handleFiles(files)
    }
  }

  const handleFiles = (files: File[]) => {
    const newFiles = files.map((file) => ({
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      status: "uploading" as const,
    }))

    setUploadedFiles((prev) => [...prev, ...newFiles])

    // Simulate upload completion
    setTimeout(() => {
      setUploadedFiles((prev) => prev.map((f) => ({ ...f, status: "complete" as const })))
    }, 2000)
  }

  const removeFile = (name: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== name))
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4 text-accent" />
          Upload Document
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
            isDragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/50 hover:bg-secondary/30",
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 mb-3">
            <Upload className="h-6 w-6 text-accent" />
          </div>
          <p className="text-sm font-medium text-card-foreground text-center">
            Drag and drop files here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, PNG, JPG up to 50MB</p>
        </div>

        <Input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} accept="*/*" />

        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Uploaded Files</p>
            {uploadedFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2"
              >
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-card-foreground truncate max-w-[150px]">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{file.size}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {file.status === "complete" ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(file.name)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          disabled={uploadedFiles.length === 0}
        >
          Submit Documents
        </Button>
      </CardContent>
    </Card>
  )
}
