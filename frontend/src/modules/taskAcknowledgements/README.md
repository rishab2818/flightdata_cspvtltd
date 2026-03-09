Task acknowledgement UI module

Files:
- `api/taskAcknowledgementsApi.js`: backend calls
- `context/TaskAcknowledgementContext.jsx`: polling + acknowledge action
- `components/TaskAcknowledgementToasts.jsx`: toast stack with `Okay` action
- `styles/taskAcknowledgements.css`: presentation

Integration points:
1. Wrap your app with `TaskAcknowledgementProvider`
2. Ensure the backend exposes `/api/task-acknowledgements/pending`
3. Ensure assignment creation creates acknowledgement records on the backend

Behavior:
- Pending items render as fixed toasts near the notification corner
- Clicking `Okay` advances or completes the acknowledgement transaction
