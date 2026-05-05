'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Square, Trash2, AlertCircle, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdvisor } from '@/lib/useAdvisor';
import { cn } from '@/lib/utils';

const SUGGESTED_PROMPTS = [
  "How much should I have in my emergency fund?",
  "Should I prioritize 401(k) or pay off debt faster?",
  "How can I reduce my taxable income this year?",
  "What's a realistic savings rate for someone my age?",
  "Explain the difference between Roth and Traditional 401(k).",
  "How do I start investing with limited extra income?",
];

export default function AdvisorPage() {
  const { messages, streaming, error, send, stop, clear } = useAdvisor();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    send(text);
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] max-w-4xl flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Sparkles className="h-6 w-6 text-[#1a56a8]" />
            AI Financial Advisor
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Powered by Claude · Your financial data is included as context · 20 messages/hour
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={clear} className="gap-1.5 text-gray-600">
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Chat area */}
      <Card className="flex flex-1 flex-col overflow-hidden shadow-sm">
        <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-6 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                  <Sparkles className="h-8 w-8 text-[#1a56a8]" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-800">
                    Ask me anything about personal finance
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    I can see your current month&apos;s transactions and budget — no need to repeat them.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 w-full max-w-xl">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => send(prompt)}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm transition-all hover:border-[#1a56a8] hover:shadow-md"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white',
                    msg.role === 'user' ? 'bg-[#1a56a8]' : 'bg-gray-700'
                  )}
                >
                  {msg.role === 'user'
                    ? <User className="h-4 w-4" />
                    : <Bot className="h-4 w-4" />
                  }
                </div>

                {/* Bubble */}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-[#1a56a8] text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  )}
                >
                  {msg.content}
                  {/* Streaming cursor on last assistant message */}
                  {streaming && i === messages.length - 1 && msg.role === 'assistant' && (
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-gray-400" />
                  )}
                </div>
              </div>
            ))}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-100 bg-white px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Ask a financial question… (Enter to send, Shift+Enter for newline)"
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                disabled={streaming}
                className={cn(
                  'flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none transition-colors',
                  'focus:border-[#1a56a8] focus:ring-1 focus:ring-[#1a56a8]',
                  'disabled:opacity-50',
                  'min-h-[42px] max-h-[160px]'
                )}
              />
              {streaming ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={stop}
                  className="h-[42px] w-[42px] shrink-0 p-0 text-gray-600"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="h-[42px] w-[42px] shrink-0 p-0 bg-[#1a56a8] hover:bg-[#1545a0]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
