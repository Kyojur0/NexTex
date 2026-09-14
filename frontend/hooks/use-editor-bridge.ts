import { useEffect } from 'react'
import { useEditorStore } from '@/lib/store'
import { editorSnapshot, executeEditorCommand, type EditorCommand } from '@/lib/editor-bridge'
import { getEditorSocketUrl } from '@/lib/api'

/** One connection per mounted editor; commands use the same store as human input. */
export function useEditorBridge() {
  useEffect(() => {
    const sessionId = crypto.randomUUID()
    let stopped = false
    let socket: WebSocket | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let stateTimer: ReturnType<typeof setTimeout> | undefined
    let queue: Promise<void> = Promise.resolve()
    let retryDelay = 1000
    const send = (connection: WebSocket, data: unknown) => {
      if (!stopped && connection === socket && connection.readyState === WebSocket.OPEN)
        connection.send(JSON.stringify(data))
    }
    const publish = () => {
      if (socket) send(socket, { type: 'state', session_id: sessionId, state: editorSnapshot() })
    }
    const connect = () => {
      if (stopped) return
      const connection = new WebSocket(getEditorSocketUrl())
      socket = connection
      connection.onopen = () => { retryDelay = 1000; publish() }
      connection.onmessage = (event) => {
        let command: EditorCommand
        try { command = JSON.parse(event.data) as EditorCommand } catch { return }
        if (command.type !== 'command' || typeof command.id !== 'string' ||
            !command.args || typeof command.args !== 'object') return
        queue = queue.then(async () => {
          if (stopped || socket !== connection || connection.readyState !== WebSocket.OPEN) return
          try {
            const state = await executeEditorCommand(command)
            send(connection, { type: 'result', id: command.id, ok: true, state })
          } catch (error) {
            send(connection, { type: 'result', id: command.id, ok: false, state: editorSnapshot(),
              error: error instanceof Error ? error.message : 'Editor command failed' })
          }
        }).catch(() => { /* A closed connection must not break later commands. */ })
      }
      connection.onclose = () => {
        if (stopped || socket !== connection) return
        reconnectTimer = setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 10000)
      }
      connection.onerror = () => connection.close()
    }
    const unsubscribe = useEditorStore.subscribe(() => {
      // Publish at most once per 100 ms while typing; read commands get fresh state.
      if (!stateTimer) stateTimer = setTimeout(() => { stateTimer = undefined; publish() }, 100)
    })
    connect()
    return () => {
      stopped = true
      unsubscribe()
      clearTimeout(reconnectTimer)
      clearTimeout(stateTimer)
      socket?.close()
    }
  }, [])
}
