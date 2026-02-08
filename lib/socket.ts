import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './api';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;
  const sessionString = await SecureStore.getItemAsync('session');
  const session = sessionString ? JSON.parse(sessionString) : {};
  socket = io(API_URL, {
    transports: ['websocket'],
    autoConnect: false,
    extraHeaders: {
      token: session.access_token || '',
    },
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
