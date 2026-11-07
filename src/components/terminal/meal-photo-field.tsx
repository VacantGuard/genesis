"use client";

import { useEffect, useId, useRef, useState } from "react";

const MAX_EDGE = 1600;
const TARGET_BYTES = 700 * 1024;

async function shrinkMealPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The picture could not be prepared.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.86;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) throw new Error("The picture could not be prepared.");
      if (blob.size <= TARGET_BYTES) break;
      if (quality <= 0.5) break;
      quality = Math.max(0.5, quality - 0.1);
    }
    if (!blob || blob.size > 1024 * 1024) throw new Error("The picture is still too large.");
    return new File([blob], "meal.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export function MealPhotoField({ currentUrl }: { currentUrl?: string | null }) {
  const named = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const generation = useRef(0);
  const preparing = useRef<Promise<boolean> | null>(null);
  const pickerId = useId();
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const form = named.current?.form;
    if (!form) return;
    const onSubmit = (event: SubmitEvent) => {
      const job = preparing.current;
      if (!job) return;
      event.preventDefault();
      event.stopPropagation();
      void job.then((ready) => {
        if (ready) form.requestSubmit();
      });
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  function onPick(file: File | undefined) {
    if (!file) return;
    const ticket = generation.current + 1;
    generation.current = ticket;
    setNote("Preparing photo…");
    const job = shrinkMealPhoto(file)
      .then((shrunk) => {
        if (ticket !== generation.current) return false;
        const list = new DataTransfer();
        list.items.add(shrunk);
        if (named.current) named.current.files = list.files;
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        const url = URL.createObjectURL(shrunk);
        previewUrl.current = url;
        setPreview(url);
        setNote("");
        return true;
      })
      .catch(() => {
        if (ticket !== generation.current) return false;
        if (named.current) named.current.value = "";
        setNote("That picture could not be used. Choose a jpg or png.");
        return false;
      })
      .finally(() => {
        if (ticket === generation.current) preparing.current = null;
      });
    preparing.current = job;
  }

  return (
    <div className="grid gap-1.5">
      <label htmlFor={pickerId} className="font-medium">
        Photo
      </label>
      {preview ? (
        <img src={preview} alt="" className="h-36 w-full max-w-xs rounded-lg object-cover" />
      ) : (
        <span className="text-muted-foreground">No photo yet. It shows above this meal on the public menu.</span>
      )}
      <input ref={named} name="photo" type="file" accept="image/jpeg,.jpg,.jpeg" className="hidden" tabIndex={-1} />
      <input
        id={pickerId}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="text-sm"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onPick(file);
        }}
      />
      <span className="text-xs text-muted-foreground">
        {note || "Jpg or png. Large pictures are resized before they are saved."}
      </span>
    </div>
  );
}
