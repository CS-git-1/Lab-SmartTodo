# Verify the Todo API in the browser

The Vite UI and Express API run separately. Start them in two terminals from the project root:

```powershell
cd frontend
npm run dev
```

```powershell
cd backend
npm run dev
```

Open `http://localhost:5173`, sign in, and follow these steps:

1. Press **F12** and open **Network**.
2. Select **Fetch/XHR** and enable **Preserve log**.
3. Reload the page. Find `GET http://localhost:3000/api/tasks`.
4. Check **Status** is `200`, and **Request Headers** contains `Authorization: Bearer …`. Do not copy or share the token.
5. Open **Response** and confirm it contains a `data` array. Compare a task in that array with the one shown in the UI.
6. If `data` is empty, the UI should show its empty state. If the request fails, the UI should show an error and a retry button instead of the empty state.

To check the error state, stop only the backend with **Ctrl+C** in its terminal, keep Vite running, and reload the page. Restart the API with `npm run dev` in the `backend` directory and use **Try loading again** in the UI.
