import { ApiClient, ApiError } from '../../core/api';
import { PickedDocument } from '../../core/documents';
import { array } from '../../core/json';
import {
  ChatQuota,
  Conversation,
  parseAnswer,
  parseConversation,
  parseQuota,
  parseThread,
  validChatImages,
} from './models';

// Android's RN transport preserves the content type of each part returned by getParts().
class ChatForm extends FormData {
  getParts() {
    return super.getParts().map((part, index) =>
      index === 0
        ? {
            ...part,
            headers: { ...part.headers, 'content-type': 'application/json; charset=utf-8' },
          }
        : part,
    );
  }
}

export class AssistantRepository {
  constructor(private api: Pick<ApiClient, 'request'>) {}
  async quota() {
    return parseQuota(await this.api.request('GET', '/ai/chat/quota'));
  }
  async list() {
    const result = await this.api.request('GET', '/ai/conversations');
    if (!Array.isArray(result)) throw new Error('Invalid conversation list');
    return array(result).map(parseConversation);
  }
  private path(id: string) {
    return '/ai/conversations/' + encodeURIComponent(id);
  }
  async thread(id: string) {
    const result = parseThread(await this.api.request('GET', this.path(id)));
    if (result.id !== id) throw new Error('Unexpected conversation');
    return result;
  }
  async send(prompt: string, id: string | undefined, images: PickedDocument[], quota: ChatQuota) {
    const trimmed = prompt.trim();
    if (!trimmed || trimmed.length > quota.maxPromptLength || !validChatImages(images, quota))
      throw new Error('Invalid chat prompt');
    const form = new ChatForm();
    form.append('request', JSON.stringify({ prompt: trimmed, conversationId: id }));
    for (const image of images)
      form.append('images', { uri: image.uri, type: image.mimeType, name: image.name });
    const result = await this.api.request('POST', '/ai/chat', form, undefined, {
      timeoutMs: 95000,
    });
    try {
      const answer = parseAnswer(result);
      if (id && answer.id !== id) throw new Error('Unexpected conversation');
      return answer;
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
  async rename(conversation: Conversation, title: string) {
    const trimmed = title.trim();
    if (!trimmed || trimmed.length > 120) throw new Error('Invalid conversation title');
    const result = await this.api.request('PATCH', this.path(conversation.id), {
      title: trimmed,
      version: conversation.version,
    });
    try {
      const updated = parseConversation(result);
      if (updated.id !== conversation.id || updated.title !== trimmed)
        throw new Error('Unexpected conversation update');
      return updated;
    } catch {
      throw new ApiError(0, 0, true);
    }
  }
  async remove(id: string) {
    await this.api.request('DELETE', this.path(id));
  }
}
