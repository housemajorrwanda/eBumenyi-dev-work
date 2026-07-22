import React, { useState } from "react";
import { IAttachment } from "@/types";
import { Lightbox } from "./Lightbox";

interface ImageAttachmentProps {
  attachment: IAttachment;
  variant: "bubble" | "card";
}

export const ImageAttachment: React.FC<ImageAttachmentProps> = ({ attachment, variant }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <img
        src={attachment.url}
        alt={attachment.name || "Shared image"}
        onClick={() => setOpen(true)}
        className={
          variant === "bubble"
            ? "w-full h-52 object-cover cursor-pointer block"
            : "w-full h-64 object-cover rounded-lg cursor-pointer block"
        }
      />
      {open && <Lightbox url={attachment.url} onClose={() => setOpen(false)} />}
    </>
  );
};
