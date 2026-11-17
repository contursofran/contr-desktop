# e2e finds chat rows after the list settles (#82, #92)

- The chat list (Legend List) can move by itself: back to its end while it settles at start, and to keep the visible rows in place when a row above changes height. This is library behavior for a short time at start. It is not an app fault, so the app does not change.
- e2e specs find a chat row only with `chatRow` in `apps/desktop/e2e/chat.ts`. The search runs in the page. After each scroll it waits until the scroll position, height and rendered rows stay the same for 3 frames. When the row is not found or not in view, the whole search runs again.
- After a change to the chat list, a spec waits with `chatSettled(page)` or on a condition. It does not use a fixed `waitForTimeout`.
