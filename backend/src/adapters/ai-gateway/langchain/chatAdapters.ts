// LangChain 기반 외부 AI 어댑터 — 프로바이더 공통 구현

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

import type {
  ExternalAdapter,
  ProcessedExternalAIRequest,
} from '../../../domain/ai-gateway/AIGateway.js';

export type ChatModelFactory = (opts: { temperature: number; json: boolean }) => BaseChatModel;

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        const p = part as { type?: string; text?: string };
        return p.type === 'text' && typeof p.text === 'string' ? p.text : '';
      })
      .join('');
  }
  return '';
}

function promptOf(processed: ProcessedExternalAIRequest): string {
  return String((processed.raw as { prompt?: unknown }).prompt ?? processed.text);
}

export function createChatEmotionAdapter(factory: ChatModelFactory): ExternalAdapter {
  const model = factory({ temperature: 0, json: true });
  return {
    async invoke(processed: ProcessedExternalAIRequest): Promise<{ raw: string }> {
      const result = await model.invoke([new HumanMessage(promptOf(processed))]);
      return { raw: contentToText(result.content) };
    },
  };
}

export function createChatDialogueAdapter(factory: ChatModelFactory): ExternalAdapter {
  const model = factory({ temperature: 0.7, json: false });
  return {
    async invoke(processed: ProcessedExternalAIRequest): Promise<{ text: string }> {
      const raw = processed.raw as { systemPrompt?: string; userText?: string };
      const result = await model.invoke([
        new SystemMessage(raw.systemPrompt ?? ''),
        new HumanMessage(raw.userText ?? ''),
      ]);
      return { text: contentToText(result.content) };
    },
  };
}

export function createChatDiaryAdapter(factory: ChatModelFactory): ExternalAdapter {
  const model = factory({ temperature: 0.6, json: false });
  return {
    async invoke(processed: ProcessedExternalAIRequest): Promise<{ text: string }> {
      const result = await model.invoke([new HumanMessage(promptOf(processed))]);
      return { text: contentToText(result.content) };
    },
  };
}

export function createChatRiskAdapter(factory: ChatModelFactory): ExternalAdapter {
  const model = factory({ temperature: 0, json: true });
  return {
    async invoke(processed: ProcessedExternalAIRequest): Promise<{ raw: string }> {
      const result = await model.invoke([new HumanMessage(promptOf(processed))]);
      return { raw: contentToText(result.content) };
    },
  };
}

export function createChatAdapters(factory: ChatModelFactory): {
  gpt4o_emotion: ExternalAdapter;
  gpt4o_dialogue: ExternalAdapter;
  gpt4o_diary: ExternalAdapter;
  gpt4o_risk: ExternalAdapter;
} {
  return {
    gpt4o_emotion: createChatEmotionAdapter(factory),
    gpt4o_dialogue: createChatDialogueAdapter(factory),
    gpt4o_diary: createChatDiaryAdapter(factory),
    gpt4o_risk: createChatRiskAdapter(factory),
  };
}
