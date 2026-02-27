import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { DownloadIcon, RedoIcon, UndoIcon } from "@/components/icons";
import { VideoPlayer } from "@/components/video-player";

export const videoArtifact = new Artifact({
  kind: "video",
  description: "Useful for video generation",
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-videoDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        status: "streaming",
      }));
    }
  },
  content: VideoPlayer,
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        return currentVersionIndex === 0;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        return isCurrentVersion;
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: "Download video",
      onClick: async ({ content }) => {
        try {
          const response = await fetch(content);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = content.split("/").pop() ?? "generated-video.mp4";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch {
          toast.error("Failed to download video");
        }
      },
    },
  ],
  toolbar: [],
});
