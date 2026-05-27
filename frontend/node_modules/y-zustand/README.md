# y-zustand

A simple and efficient middleware to synchronize a [Zustand](https://github.com/pmndrs/zustand) store with a [Yjs](https://github.com/yjs/yjs) document.

This middleware enables real-time collaboration by connecting your Zustand state to a shared Yjs YDoc, allowing state to be seamlessly synced between multiple clients.

## Features

- Connects a Zustand store to a Yjs `Y.Doc`.
- Synchronizes state changes in both directions (Zustand -> Yjs and Yjs -> Zustand).
- Efficiently handles updates, only transmitting changes for modified properties.
- Correctly handles complex data types like arrays and their methods.
- Ignores functions in the store, only syncing data properties.
- Supports partial state syncing with the `partialize` option.

## Installation

```bash
npm install y-zustand yjs zustand
# or
yarn add y-zustand yjs zustand
# or
pnpm add y-zustand yjs zustand
```

## Basic Usage

1. Import the middleware and your Yjs document.
2. Wrap your Zustand store creator with the `syncYjsMiddleware`.

```typescript
import { create } from "zustand";
import * as Y from "yjs";
import { syncYjsMiddleware } from "y-zustand";

// 1. Create a Yjs document
const ydoc = new Y.Doc();

// (Optional) Connect to a provider for network synchronization
// import { WebsocketProvider } from 'y-websocket';
// new WebsocketProvider('ws://localhost:1234', 'my-room-name', ydoc);

// 2. Define your store's interface and initial state
interface MyState {
  count: number;
  name: string;
  increment: () => void;
}

// 3. Create your store, wrapping the creator with the middleware
export const useStore = create<MyState>()(
  syncYjsMiddleware<MyState>(
    ydoc,
    "shared"
  )((set) => ({
    count: 0,
    name: "Alice",
    increment: () => set((state) => ({ count: state.count + 1 })),
  }))
);
```

## Partial State Syncing

You can selectively sync only specific parts of your state using the `partialize` option. This is useful when you have local-only state that shouldn't be shared with other clients.

```typescript
import { create } from "zustand";
import * as Y from "yjs";
import { syncYjsMiddleware } from "y-zustand";

const ydoc = new Y.Doc();

interface MyState {
  count: number;
  name: string;
  localOnly: string; // This won't be synced
  increment: () => void;
}

export const useStore = create<MyState>()(
  syncYjsMiddleware<MyState>(ydoc, "shared", {
    // Only sync count and name, omit localOnly
    partialize: (state) => {
      const { localOnly, ...rest } = state;
      return rest;
    },
  })((set) => ({
    count: 0,
    name: "Alice",
    localOnly: "This won't be synced",
    increment: () => set((state) => ({ count: state.count + 1 })),
  }))
);
```

You can also use a more concise approach with `Object.fromEntries`:

```typescript
export const useStore = create<MyState>()(
  syncYjsMiddleware<MyState>(ydoc, "shared", {
    // Omit specific keys from syncing
    partialize: (state) =>
      Object.fromEntries(
        Object.entries(state).filter(([key]) => !["localOnly"].includes(key))
      ),
  })((set) => ({
    count: 0,
    name: "Alice",
    localOnly: "This won't be synced",
    increment: () => set((state) => ({ count: state.count + 1 })),
  }))
);
```
