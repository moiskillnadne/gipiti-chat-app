import cn from "classnames";
import { LoaderIcon } from "./icons";

type VideoPlayerProps = {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline: boolean;
};

export function VideoPlayer({
  title,
  content,
  status,
  isInline,
}: VideoPlayerProps) {
  return (
    <div
      className={cn("flex w-full flex-row items-center justify-center", {
        "h-[calc(100dvh-60px)]": !isInline,
        "h-[200px]": isInline,
      })}
    >
      {status === "streaming" ? (
        <div className="flex flex-row items-center gap-4">
          {!isInline && (
            <div className="animate-spin">
              <LoaderIcon />
            </div>
          )}
          <div>Generating Video...</div>
        </div>
      ) : (
        <video
          className={cn("h-fit w-full max-w-[800px] rounded-lg", {
            "p-0 md:p-20": !isInline,
          })}
          controls
          playsInline
          preload="metadata"
          src={content}
          title={title}
        >
          <track kind="captions" />
        </video>
      )}
    </div>
  );
}
