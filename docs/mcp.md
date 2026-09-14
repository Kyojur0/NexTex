# Use NexTex from an agent

NexTex includes an MCP server for agents that support **Streamable HTTP** or
**stdio**. Agents can manage workspace files, edit the open document, use undo,
save, compile LaTeX, read diagnostics and retrieve PDFs.

Start NexTex first (`npm run setup` after updating dependencies, then `npm run dev`,
or `npm run build && npm start`). Open the editor in a browser for live controls.
File and build tools also work with just the backend running.

## Connect

Use the HTTP endpoint **`http://127.0.0.1:8000/mcp`**. In clients that accept an
`mcpServers` configuration, add:

```json
{
  "mcpServers": {
    "nextex": {
      "type": "http",
      "url": "http://127.0.0.1:8000/mcp"
    }
  }
}
```

For a client that launches stdio servers, use this instead. Replace
`/absolute/path/NexTex` with your checkout's full path; no working directory is
required. On Windows use `backend/venv/Scripts/python.exe`.

```json
{
  "mcpServers": {
    "nextex": {
      "command": "/absolute/path/NexTex/backend/venv/bin/python",
      "args": ["/absolute/path/NexTex/backend/mcp_server.py"],
      "env": { "NEXTEX_API_URL": "http://127.0.0.1:8000" }
    }
  }
}
```

The settings file location and HTTP field names depend on the client. Enable the
server there and choose that client's tool-approval settings. Connections are
local to this computer; a cloud agent needs a local connector. For another API
port, use `NEXTEX_API_PORT` with the root launcher and update the client URL
(and stdio `NEXTEX_API_URL`). When launching services separately, set
`NEXTEX_API_URL` on the backend and `NEXT_PUBLIC_API_URL` on the frontend.

## What agents can do

| Workflow | Tools |
| --- | --- |
| Inspect the workspace | `get_status`, `list_files`, `read_file` |
| Manage files and images | `create_file`, `create_folder`, `write_file`, `rename_path`, `delete_path`, `upload_image` |
| Compile and retrieve PDFs | `compile_document`, `get_pdf` |
| Use an open editor tab | `list_editors`, `read_editor`, `edit_editor`, `editor_action` |

`editor_action` supports `open`, `save`, `save_as`, `build`, `undo`, `redo`, and
`set_mode` (`text` or `visual`). Build saves first and returns diagnostics and the
PDF URL. `get_pdf` returns base64 PDF bytes. The `nextex://workspace` resource
provides workspace and compiler information.

Example request to an agent:

> Use NexTex to read my open document, improve its introduction, then save and
> build it. Check the compiler diagnostics and give me the PDF.

Agents start with `list_editors`, then `read_editor` for a fresh state. Live edits
and actions require its session ID, workspace, path and source hash. They preserve
undo and recovery drafts. Stale requests fail instead of overwriting newer text.
Saved-file writes require the revision from `read_file`; writing, renaming or
deleting an open file is rejected. Select a different document first when needed.

All paths stay inside the workspace selected in **File → Open Folder**. Live
source is limited to 8 MiB and images to 10 MiB. After a timeout, read the state
before retrying: the operation may have completed. If no editor is listed, open
or refresh the browser tab. If compilation is unavailable, install a local TeX
distribution.
