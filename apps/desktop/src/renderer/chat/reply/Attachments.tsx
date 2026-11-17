import { X } from "lucide-react";
import { useState } from "react";
import { LOCAL_IMAGE, localImageUrl } from "../markdown/markdownLocalImages";

/**
 * The files attached to the reply (docs/design/recipe-herdr.md, reply box): a PNG, JPEG or SVG shows as a
 * 56 px high picture with a × on its top right corner; any other file, and a picture that does not load,
 * is a chip with its name and a ×. The × takes the file out of what is sent.
 */
export function Attachments({ images, onRemove }: { images: string[]; onRemove: (index: number) => void }) {
  if (images.length === 0) return null;
  return (
    <ul aria-label="Attachments" className="mb-2 flex flex-wrap items-start gap-2 pt-1.5 pr-1.5">
      {images.map((image, index) => (
        <Attachment key={`${index}:${image}`} path={image} onRemove={() => onRemove(index)} />
      ))}
    </ul>
  );
}

const remove =
  "grid size-4 shrink-0 place-items-center rounded-full text-muted hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground";

function Attachment({ path, onRemove }: { path: string; onRemove: () => void }) {
  const name = path.split("/").pop() || path;
  const [broken, setBroken] = useState(false);
  const button = (className: string) => (
    <button type="button" aria-label={`Remove ${name}`} title={`Remove ${name}`} onClick={onRemove} className={`${remove} ${className}`}>
      <X aria-hidden className="size-3" />
    </button>
  );
  if (LOCAL_IMAGE.test(path) && !broken) {
    return (
      <li className="relative">
        <img src={localImageUrl(path)} alt={name} title={name} onError={() => setBroken(true)} className="h-14 max-w-40 rounded-lg border border-border object-cover" />
        {button("absolute -top-1.5 -right-1.5 border border-border bg-raised")}
      </li>
    );
  }
  return (
    <li title={path} className="flex items-center gap-1 rounded bg-selected py-0.5 pr-1 pl-2 text-xs text-muted">
      {name}
      {button("")}
    </li>
  );
}
