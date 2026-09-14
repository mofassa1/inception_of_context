import { CHAT_ROUTING } from "@/shared/constants/chat";

export function isChangeRequest(text: string): boolean {
  let request = text.trim().toLowerCase();

  for (const leadingWord of CHAT_ROUTING.LEADING_WORDS) {
    request = request.replace(new RegExp(`^${leadingWord}[,!.]?\\s+`), "");
  }

  const firstWord = request.split(/\s+/)[0] ?? "";
  return (CHAT_ROUTING.CHANGE_VERBS as readonly string[]).includes(firstWord);
}
