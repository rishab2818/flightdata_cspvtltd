Task acknowledgement module

Files:
- `models.py`: response and state models
- `service.py`: collection access, notification handoff, acknowledgement transitions
- `router.py`: `/api/task-acknowledgements/*` endpoints

Integration points:
- Include `router` in `app/main.py`
- Call `create_assignment_request_sync(...)` when your app creates a new user-to-user assignment

Collection:
- `task_acknowledgements`

Lifecycle:
1. Assignment is created -> assignee gets notification + pending acknowledgement record
2. Assignee clicks `Okay` -> assigner gets a notification + the record waits for assigner confirmation
3. Assigner clicks `Okay` -> record is deleted
