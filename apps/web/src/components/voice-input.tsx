import { useState, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export function VoiceInput({ onTranscription, placeholder = "Click to start recording", className }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const transcribeMutation = useMutation(
    orpc.voice.transcribe.mutationOptions({
      onSuccess: (data: any) => {
        if (data.text) {
          onTranscription(data.text);
          toast.success("Transcription complete");
        }
      },
      onError: (error: any) => {
        toast.error(`Transcription failed: ${error.message}`);
      },
      onSettled: () => {
        setIsProcessing(false);
      },
    })
  );

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording started...");
    } catch (error: any) {
      toast.error(`Failed to start recording: ${error.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.info("Recording stopped");
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    // Convert blob to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Audio = reader.result?.toString().split(",")[1];
      if (base64Audio) {
        transcribeMutation.mutate({
          audio: base64Audio,
          format: "webm",
        } as any);
      } else {
        toast.error("Failed to process audio");
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(audioBlob);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant={isRecording ? "destructive" : "outline"}
        size="icon"
        onClick={toggleRecording}
        disabled={isProcessing}
        title={placeholder}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}