import "server-only";
import { revalidatePath } from "next/cache";

export function revalidateLinkedViews() {
  revalidatePath("/console", "layout");
  revalidatePath("/vendor", "layout");
  revalidatePath("/portal", "layout");
}
