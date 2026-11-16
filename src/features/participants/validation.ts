import { validateEmailAddress } from "@/features/auth/validation";

export function validateParticipant(formData: FormData) {
  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const emailResult = validateEmailAddress(formData);
  const fieldErrors: Record<string, string> = {};
  if (!name || Array.from(name).length > 80) {
    fieldErrors.name = "Enter a name between 1 and 80 characters.";
  }
  if (!emailResult.success) fieldErrors.email = emailResult.fieldErrors.email;
  if (Object.keys(fieldErrors).length || !emailResult.success) {
    return { success: false as const, fieldErrors };
  }
  return { success: true as const, data: { name, email: emailResult.data.email } };
}
