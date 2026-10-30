import { useState, useRef, useEffect, type FormEvent } from 'react';
import { callFunction } from '@core/services/callables';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '@core/config/constants';
import { Icon } from './Icon';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

const QUICK_PROMPTS = [
  'Check One-Way Outstation Fares',
  'What car types do you have?',
  'What is the cancellation policy?',
  'Airport pickup/drop booking guide',
  'Plan a tour to Munnar / Ooty',
];

function formatTime(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderFormattedText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    let formatted = line;
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(
      /\[(.*?)\]\((.*?)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>'
    );

    const isBullet = /^[•\-*]\s+/.test(line.trim());
    if (isBullet) {
      const clean = formatted.trim().replace(/^[•\-*]\s+/, '');
      return (
        <li
          key={idx}
          className="chat-bullet"
          dangerouslySetInnerHTML={{ __html: clean }}
        />
      );
    }

    if (!line.trim()) {
      return <div key={idx} className="chat-spacer" />;
    }

    return (
      <p
        key={idx}
        className="chat-paragraph"
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    );
  });
}

export function AiChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! 👋 Welcome to **NESAM Cabs & Travels**. I am your **Groq-powered AI Travel Advisor**.\n\nAsk me anything about:\n• **Outstation one-way drop taxis & round trips**\n• **Zero surge pricing guarantee** across Tamil Nadu, Bangalore, Kerala\n• **Fleet options**: Sedans, SUVs, Prime Innova Crysta, Tempo Travellers\n• **Airport transfers, local hourly rentals & pilgrimage tours**\n\nHow may I help plan your trip?`,
      time: formatTime(),
    },
  ]);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [open, messages, loading]);

  const send = async (textToSend?: string) => {
    const q = (textToSend ?? input).trim();
    if (!q || loading) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: q,
      time: formatTime(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await callFunction<
        {
          brand: string;
          messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        },
        { message: string; provider: string }
      >('chatWithBot', {
        brand: 'nesam',
        messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
      });

      const reply = res?.message || 'I am having trouble answering right now. Please call our 24/7 helpline at ' + SUPPORT_PHONE_DISPLAY;
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: reply,
          time: formatTime(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I could not connect right now. You can reach our 24/7 desk directly at **${SUPPORT_PHONE_DISPLAY}** or book directly on the home page!`,
          time: formatTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        type="button"
        className={`floating-ai-launcher floating-ai-launcher--nesam ${open ? 'is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI Travel Assistant' : 'Open AI Travel Assistant'}
        title="Chat with NESAM AI Travel Assistant (Groq AI)"
      >
        <span className="floating-ai-launcher__sparkle" aria-hidden="true">
          {open ? <Icon name="close" size={20} /> : <span className="ai-badge-icon">✨</span>}
        </span>
        <span className="floating-ai-launcher__text">
          {open ? 'Close' : 'Ask AI'}
        </span>
        {!open && <span className="floating-ai-launcher__pulse" aria-hidden="true" />}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="ai-chat-window ai-chat-window--nesam" role="dialog" aria-modal="true" aria-label="NESAM AI Travel Assistant">
          {/* Header */}
          <div className="ai-chat-head">
            <div className="ai-chat-brand">
              <span className="ai-chat-avatar">
                <span className="ai-sparkle">✨</span>
              </span>
              <div>
                <strong>NESAM Travel Advisor</strong>
                <span className="ai-status">
                  <span className="ai-status-dot" /> Online · Powered by Groq AI
                </span>
              </div>
            </div>
            <div className="ai-chat-actions">
              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="ai-chat-call"
                title={`Call Support: ${SUPPORT_PHONE_DISPLAY}`}
                aria-label={`Call Support: ${SUPPORT_PHONE_DISPLAY}`}
              >
                <Icon name="phone" size={16} />
              </a>
              <button
                type="button"
                className="ai-chat-close"
                onClick={() => setOpen(false)}
                aria-label="Close Chat"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>

          {/* Quick Questions Pills */}
          <div className="ai-chat-prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="ai-prompt-pill"
                onClick={() => void send(prompt)}
                disabled={loading}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Feed */}
          <div className="ai-chat-body">
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble chat-bubble--${m.role}`}>
                <div className="chat-bubble__content">
                  {renderFormattedText(m.content)}
                </div>
                <span className="chat-bubble__time">{m.time}</span>
              </div>
            ))}

            {loading && (
              <div className="chat-bubble chat-bubble--assistant chat-bubble--typing">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input Form */}
          <form className="ai-chat-foot" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="ai-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about fares, outstation cabs, routes..."
              disabled={loading}
            />
            <button
              type="submit"
              className="ai-chat-send"
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              <Icon name="send" size={17} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default AiChatbot;

