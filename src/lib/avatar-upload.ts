import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const AVATAR_SIZE = 256; // Zielkantenlänge des quadratischen Avatars

/** Bild laden, mittig quadratisch zuschneiden, auf AVATAR_SIZE skalieren → WebP-Blob.
 *  Nur im Browser nutzbar (FileReader/Image/canvas). */
export async function resizeToSquareWebp(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    i.src = dataUrl;
  });

  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Konvertierung fehlgeschlagen"))),
      "image/webp",
      0.85
    );
  });
}

/** Verkleinert + lädt das Bild in den avatars-Bucket, gibt die public URL zurück. */
export async function uploadAvatar(
  supabase: SupabaseClient<Database>,
  userId: string,
  file: File
): Promise<string> {
  const blob = await resizeToSquareWebp(file);
  const path = `${userId}/${Date.now()}.webp`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/webp", upsert: true });
  if (error) throw new Error("Bild-Upload fehlgeschlagen");

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  return publicUrl;
}
