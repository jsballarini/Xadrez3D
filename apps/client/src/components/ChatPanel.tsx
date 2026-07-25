import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@xadrez3d/shared';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
}

export function ChatPanel({ messages, onSend, disabled }: ChatPanelProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      setError(null);
      await onSend(text.trim());
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar');
    }
  };

  return (
    <div className="panel chat-panel">
      <h3>Chat</h3>
      <div className="chat-log">
        {messages.length === 0 && <p className="muted">Nenhuma mensagem ainda.</p>}
        {messages.map((m) => (
          <div key={m.id} className="chat-line">
            <strong>{m.nickname}</strong>
            <span>{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="chat-form">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem…"
          maxLength={300}
          disabled={disabled}
        />
        <button type="submit" disabled={disabled || !text.trim()}>
          Enviar
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
