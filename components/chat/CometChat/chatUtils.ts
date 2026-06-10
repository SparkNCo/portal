export interface ChatMessageData {
  id: string | number;
  senderUid: string;
  senderName: string;
  text: string;
  sentAt?: number;
}

export function extractChatMessage(msg: any, index: number): ChatMessageData | null {
  const text = msg.getText?.() ?? msg.text ?? msg?.aiAssistantMessageData?.text;
  if (!text?.trim()) return null;
  return {
    id: msg.getId?.() ?? index,
    senderUid: msg.getSender?.()?.getUid?.() ?? msg.sender?.uid ?? "",
    senderName: msg.getSender?.()?.getName?.() ?? msg.sender?.name ?? "Unknown",
    text,
    sentAt: msg.getSentAt?.() ?? msg.sentAt,
  };
}

export function formatMessageTime(sentAt: number): string {
  return new Date(sentAt * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
