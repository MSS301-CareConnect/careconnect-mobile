import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { ApiClient } from './src/core/api';
import { AppProvider } from './src/core/app-context';
import { AppNavigator } from './src/app/navigation';
export default function App({ client }: { client?: ApiClient }) {
  return (
    <SafeAreaProvider>
      <AppProvider client={client}>
        <StatusBar barStyle="dark-content" />
        <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
