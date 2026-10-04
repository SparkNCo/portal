import { CometChat } from "@cometchat/chat-sdk-javascript";
import type { ChatAttachmentData as ChatAttachment } from "../ChatAttachmentView";

export interface ChatMessageData {
  id: string | number;
  senderUid: string;
  senderName: string;
  text: string;
  sentAt?: number;
  attachment?: ChatAttachment;
}

const MEDIA_TYPES = new Set(["image", "video", "audio", "file"]);

// A media message's file, from the SDK object or the raw payload.
function extractAttachment(msg: any): ChatAttachment | undefined {
  const type = msg.getType?.() ?? msg.type;
  if (!MEDIA_TYPES.has(type)) return undefined;
  const a = msg.getAttachment?.() ?? msg.data?.attachments?.[0];
  const url = a?.getUrl?.() ?? a?.url ?? msg.getURL?.() ?? msg.data?.url;
  if (!url) return undefined;
  return {
    url,
    name: a?.getName?.() ?? a?.name ?? "Attachment",
    mimeType: a?.getMimeType?.() ?? a?.mimeType ?? (type === "image" ? "image/*" : ""),
    size: a?.getSize?.() ?? a?.size,
  };
}

export function extractChatMessage(msg: any, index: number): ChatMessageData | null {
  const attachment = extractAttachment(msg);
  const text = attachment
    ? (msg.getCaption?.() ?? msg.caption ?? "")
    : (msg.getText?.() ?? msg.text ?? msg?.aiAssistantMessageData?.text);
  if (!attachment && !text?.trim()) return null;
  return {
    id: msg.getId?.() ?? index,
    senderUid: msg.getSender?.()?.getUid?.() ?? msg.sender?.uid ?? "",
    senderName: msg.getSender?.()?.getName?.() ?? msg.sender?.name ?? "Unknown",
    text: text ?? "",
    sentAt: msg.getSentAt?.() ?? msg.sentAt,
    attachment,
  };
}

function mediaTypeFor(file: File): string {
  if (file.type.startsWith("image/")) return CometChat.MESSAGE_TYPE.IMAGE;
  if (file.type.startsWith("video/")) return CometChat.MESSAGE_TYPE.VIDEO;
  if (file.type.startsWith("audio/")) return CometChat.MESSAGE_TYPE.AUDIO;
  return CometChat.MESSAGE_TYPE.FILE;
}

// Sends the text (if any) and then each file as its own media message to a
// group; returns the sent messages in order.
export async function sendGroupMessages(guid: string, text: string, files: File[]): Promise<any[]> {
  const sent: any[] = [];
  if (text) {
    sent.push(await CometChat.sendMessage(new CometChat.TextMessage(guid, text, CometChat.RECEIVER_TYPE.GROUP)));
  }
  for (const file of files) {
    const media = new CometChat.MediaMessage(guid, file, mediaTypeFor(file), CometChat.RECEIVER_TYPE.GROUP);
    sent.push(await CometChat.sendMediaMessage(media));
  }
  return sent;
}

// CometChat's sentAt is in seconds; null while a message is still sending.
export function getMessageDate(msg: any): Date | null {
  const sentAt = msg.getSentAt?.() ?? msg.sentAt;
  return sentAt ? new Date(sentAt * 1000) : null;
}
