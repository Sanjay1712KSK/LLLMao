# Database

Runtime SQLite files live here during development.

The default backend database URL points to:

```text
database/workspace.sqlite3
```

The schema is created automatically on backend startup:

- `chats`: `id`, `title`, `created_at`
- `messages`: `id`, `chat_id`, `role`, `content`, `created_at`

SQLite artifacts are ignored by git.
