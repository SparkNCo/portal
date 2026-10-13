import { CometChat } from "@cometchat/chat-sdk-javascript";
import type { ChatAttachmentData as ChatAttachment } from "../ChatAttachmentView";

export interface ChatMessageData {
  id: string | number;
  senderUid: string;
  senderName: string;
  text: string;
  sentAt?: number;
  attachment?: ChatAttachment;
  /** The sender changed its text afterwards. */
  edited?: boolean;
  /** The sender deleted it — shown as a placeholder, with no content. */
  deleted?: boolean;
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
  // Only real messages: CometChat also keeps "action" entries in a group's
  // history (e.g. one per edit/delete), which aren't something to show.
  const category = msg.getCategory?.() ?? msg.category;
  if (category === "action") return null;

  if (msg.getDeletedAt?.() ?? msg.deletedAt) {
    return {
      id: msg.getId?.() ?? index,
      senderUid: msg.getSender?.()?.getUid?.() ?? msg.sender?.uid ?? "",
      senderName: msg.getSender?.()?.getName?.() ?? msg.sender?.name ?? "Unknown",
      text: "",
      sentAt: msg.getSentAt?.() ?? msg.sentAt,
      deleted: true,
    };
  }

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
    edited: !!(msg.getEditedAt?.() ?? msg.editedAt),
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

// `prev` plus whichever of `incoming` it doesn't already have (by message id).
// The same message can arrive twice — e.g. on a ticket's first message the
// history fetched for the just-created group already includes it when the
// send returns it too — and must only be shown once.
export function mergeMessages(prev: any[], incoming: any[]): any[] {
  const ids = new Set(prev.map((m) => m.getId?.() ?? m.id).filter(Boolean));
  const added = incoming.filter((m) => {
    const id = m.getId?.() ?? m.id;
    if (!id) return true;
    if (ids.has(id)) return false;
    ids.add(id);
    return true;
  });
  return added.length ? [...prev, ...added] : prev;
}

// A group's history without CometChat's "action" entries (member changes,
// and one per edit/delete) — they aren't shown, and left in the list they'd
// count as the "last message" and as a break between a sender's messages.
export function withoutActions(messages: any[]): any[] {
  return messages.filter((m) => (m.getCategory?.() ?? m.category) !== "action");
}

// `prev` with the message of the same id swapped for `updated` — after an
// edit or delete (ours, or someone else's arriving through the listener).
export function replaceMessage(prev: any[], updated: any): any[] {
  const id = updated?.getId?.() ?? updated?.id;
  if (!id) return prev;
  return prev.map((m) => ((m.getId?.() ?? m.id) === id ? updated : m));
}

// Changes the text of one of the user's own text messages; resolves to the
// edited message.
export async function editTextMessage(msg: any, text: string): Promise<any> {
  const edited = new CometChat.TextMessage(msg.getReceiverId(), text, msg.getReceiverType());
  edited.setId(msg.getId());
  return CometChat.editMessage(edited);
}

// Deletes one of the user's own messages (text or attachment); resolves to
// the message as CometChat now has it (with deletedAt set).
export async function deleteOwnMessage(msg: any): Promise<any> {
  return CometChat.deleteMessage(String(msg.getId()));
}

// CometChat's sentAt is in seconds; null while a message is still sending.
export function getMessageDate(msg: any): Date | null {
  const sentAt = msg.getSentAt?.() ?? msg.sentAt;
  return sentAt ? new Date(sentAt * 1000) : null;
}
