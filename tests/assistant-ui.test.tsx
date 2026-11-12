import React from 'react';
import { Alert } from 'react-native';
import { expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Routes } from '../src/app/routes';
import { ApiClient } from '../src/core/api';
import { AppProvider, useApp } from '../src/core/app-context';
import { AssistantScreen } from '../src/features/assistant/screen';
import { AssistantRepository } from '../src/features/assistant/repository';

const Stack = createNativeStackNavigator<Routes>();

function Subject() {
  const { user } = useApp();
  if (!user) return null;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Assistant" component={AssistantScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function fixture() {
  let conversation = { conversationId: 'c', title: 'Lịch làm', version: 3 };
  let deleted = false;
  const writes: { method: string; body: unknown }[] = [];
  const question = 'Tôi xem lịch ở đâu?';
  const answer = 'Mở mục Lịch làm việc.';
  const client = new ApiClient(
    'http://test',
    { get: async () => 'refresh', set: async () => undefined },
    async (input, init) => {
      const path = new URL(String(input)).pathname;
      let result: unknown;
      if (path.endsWith('/auth/refresh'))
        result = { accessToken: 'access', refreshToken: 'refresh' };
      else if (path.endsWith('/users/me'))
        result = { id: 'u', status: 'ACTIVE', roles: ['CAREGIVER'] };
      else if (path.endsWith('/ai/chat/quota'))
        result = {
          guest: false,
          maxPromptLength: 800,
          imagesAllowed: true,
          maxImages: 3,
          maxImageSizeMb: 10,
          maxTotalImageSizeMb: 20,
        };
      else if (path.endsWith('/ai/conversations')) result = deleted ? [] : [conversation];
      else if (path.endsWith('/ai/conversations/c')) {
        if (init?.method === 'PATCH') {
          const body = JSON.parse(String(init.body));
          writes.push({ method: 'PATCH', body });
          conversation = { ...conversation, title: body.title, version: conversation.version + 1 };
          result = conversation;
        } else if (init?.method === 'DELETE') {
          writes.push({ method: 'DELETE', body: undefined });
          deleted = true;
          result = null;
        } else {
          result = {
            ...conversation,
            messages: [
              { chatMessageId: 'q', messageRole: 'USER', content: question },
              { chatMessageId: 'a', messageRole: 'ASSISTANT', content: answer },
            ],
          };
        }
      }
      return new Response(JSON.stringify({ code: 200, result }));
    },
  );
  return { client, writes, question, answer };
}

function open(client: ApiClient) {
  return render(
    <SafeAreaProvider>
      <AppProvider client={client}>
        <Subject />
      </AppProvider>
    </SafeAreaProvider>,
  );
}

test('chat keeps its draft while reading history and shows one acknowledged exchange after sending', async () => {
  const f = fixture();
  let finish!: () => void;
  const send = jest.spyOn(AssistantRepository.prototype, 'send').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ id: 'c', title: 'Lịch làm', answer: f.answer });
      }),
  );
  const screen = await open(f.client);
  try {
    await screen.findByText(/tổng 20 MB/);
    expect(screen.getByText(/Xin chào!/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Câu hỏi của bạn'), f.question);
    await fireEvent.press(screen.getByRole('button', { name: 'Lịch sử trò chuyện' }));
    await screen.findByText('Lịch làm');
    expect(screen.queryByLabelText('Câu hỏi của bạn')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại trò chuyện' }));
    expect(screen.getByLabelText('Câu hỏi của bạn')).toHaveProp('value', f.question);
    await fireEvent.press(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
    expect(screen.getByText('Trợ lý đang trả lời…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled();
    await act(async () => finish());
    await screen.findByText(f.answer);
    await waitFor(() => expect(screen.getAllByText(f.answer)).toHaveLength(1));
    expect(screen.getByLabelText('Câu hỏi của bạn')).toHaveProp('value', '');
  } finally {
    await screen.unmount();
    send.mockRestore();
  }
});

test('history renames with the server version and deletes only after confirmation', async () => {
  const f = fixture();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await open(f.client);
  try {
    await fireEvent.press(await screen.findByRole('button', { name: 'Lịch sử trò chuyện' }));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Đổi tên cuộc trò chuyện Lịch làm' }),
    );
    await fireEvent.changeText(screen.getByLabelText('Tên cuộc trò chuyện'), 'Lịch tuần');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    await screen.findByText('Lịch tuần');
    expect(f.writes).toEqual([{ method: 'PATCH', body: { title: 'Lịch tuần', version: 3 } }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa cuộc trò chuyện Lịch tuần' }));
    expect(f.writes).toHaveLength(1);
    expect(alert.mock.calls[0]?.[1]).toContain('Lịch tuần');
    const confirmDelete = alert.mock.calls[0]?.[2]?.find((button) => button.text === 'Xóa');
    expect(confirmDelete?.onPress).toBeDefined();
    await act(async () => confirmDelete?.onPress?.());
    await screen.findByText('Đã xóa cuộc trò chuyện.');
    expect(f.writes).toHaveLength(2);
    expect(f.writes[1]?.method).toBe('DELETE');
  } finally {
    await screen.unmount();
    alert.mockRestore();
  }
});
