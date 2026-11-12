import { PickedDocument } from '../../core/documents';
import { array, number, object, required, text } from '../../core/json';

export function parseQuota(value: unknown) {
  const j = object(value);
  const maxPromptLength = limit(j.maxPromptLength);
  if (j.guest !== false || maxPromptLength === 0) throw new Error('Signed-in chat quota required');
  return {
    maxPromptLength,
    imagesAllowed: j.imagesAllowed === true,
    maxImages: limit(j.maxImages),
    maxImageBytes: limit(j.maxImageSizeMb) * 1024 ** 2,
    maxTotalImageBytes: limit(j.maxTotalImageSizeMb) * 1024 ** 2,
  };
}
function limit(value: unknown) {
  const n = number(value);
  if (n === undefined || n < 0 || !Number.isSafeInteger(n)) throw new Error('Invalid chat limit');
  return n;
}
export type ChatQuota = ReturnType<typeof parseQuota>;

export function parseConversation(value: unknown) {
  const j = object(value);
  return {
    id: required(j.conversationId),
    title: required(j.title),
    updatedAt: text(j.updatedAt),
    version: limit(j.version),
  };
}
export type Conversation = ReturnType<typeof parseConversation>;

export function parseThread(value: unknown) {
  const j = object(value);
  return {
    ...parseConversation(j),
    messages: array(j.messages).map((value) => {
      const message = object(value);
      if (message.messageRole !== 'USER' && message.messageRole !== 'ASSISTANT')
        throw new Error('Invalid chat author');
      return {
        id: required(message.chatMessageId),
        role: message.messageRole,
        content: text(message.content),
        images: array(message.images).map((entry) => {
          const image = object(entry);
          const url = text(image.downloadUrl);
          return {
            id: required(image.mediaFileId),
            name: text(image.originalFileName),
            url: /^https:\/\/[^\s]+$/i.test(url) ? url : '',
          };
        }),
      };
    }),
  };
}
export function parseAnswer(value: unknown) {
  const j = object(value);
  return {
    id: required(j.conversationId),
    title: required(j.conversationTitle),
    answer: required(j.answer),
  };
}

const IMAGE_TYPES: Record<string, RegExp> = {
  'image/jpeg': /\.(jpg|jpeg)$/i,
  'image/png': /\.png$/i,
  'image/webp': /\.webp$/i,
};
export const chatImageTypes = Object.keys(IMAGE_TYPES);
export function validChatImages(images: PickedDocument[], quota: ChatQuota) {
  if (!images.length) return true;
  return (
    quota.imagesAllowed &&
    images.length <= quota.maxImages &&
    images.every(
      (image) =>
        !!image.size &&
        image.size > 0 &&
        image.size <= quota.maxImageBytes &&
        !!IMAGE_TYPES[image.mimeType ?? '']?.test(image.name),
    ) &&
    images.reduce((size, image) => size + (image.size ?? 0), 0) <= quota.maxTotalImageBytes
  );
}
