'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatBubble from './ChatBubble';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    mmpName?: string;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedMmp, setSelectedMmp] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    mmpName: selectedMmp || undefined
                }),
            });

            if (!response.ok) throw new Error('API request failed');

            // MMP 출처 해더 확인 (API에서 전달하도록 수정 필요)
            const detectedMmp = response.headers.get('x-mmp-source') || selectedMmp || 'MMP';

            const reader = response.body?.getReader();
            let assistantMessage = '';

            // 초기 메시지 추가 시 출처 정보 포함
            setMessages((prev) => [...prev, { role: 'assistant', content: '', mmpName: detectedMmp }]);

            while (true) {
                const { done, value } = await reader!.read();
                if (done) break;
                const text = new TextDecoder().decode(value);
                assistantMessage += text;
                setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = assistantMessage;
                    return newMessages;
                });
            }
        } catch (error) {
            console.error('Chat error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[800px] w-full mx-auto glass rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
            {/* Header */}
            <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                        <Bot className="text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">AdMate-MMP AI Chat</h2>
                        <p className="text-xs text-gray-400 italic">AppsFlyer · Airbridge · Adjust Knowledge Base</p>
                    </div>
                </div>

                {/* MMP Selector */}
                <div className="flex gap-2">
                    {['', 'appsflyer', 'airbridge', 'adjust'].map((mmp) => (
                        <button
                            key={mmp}
                            onClick={() => setSelectedMmp(mmp)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tighter transition-all border",
                                selectedMmp === mmp
                                    ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                                    : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                            )}
                        >
                            {mmp || 'All'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar bg-black/40">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50 px-10">
                        <div className="p-4 rounded-full bg-primary/10 border border-primary/20 mb-2">
                            <Bot size={48} className="text-primary" />
                        </div>
                        <h3 className="text-xl font-bold text-white">무엇을 도와드릴까요?</h3>
                        <p className="text-gray-400 max-w-sm">MMP SDK 연동, 파트너 설정, 포스트백 가이드 등 기술적인 질문에 정확하게 답변해 드립니다.</p>
                    </div>
                )}
                <AnimatePresence>
                    {messages.map((msg, i) => (
                        <ChatBubble
                            key={i}
                            role={msg.role}
                            content={msg.content}
                            mmpName={msg.mmpName}
                            isLoading={isLoading && i === messages.length - 1}
                        />
                    ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-6 bg-white/5 border-t border-white/10 backdrop-blur-md">
                <div className="relative group">
                    <textarea
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        placeholder="MMP에 대해 질문해 보세요 (Shift + Enter: 줄바꿈)"
                        className="w-full bg-black/20 border border-white/10 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all resize-none shadow-inner"
                        style={{ minHeight: '56px', maxHeight: '200px' }}
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-2 h-11 w-11 rounded-xl bg-primary flex items-center justify-center hover:bg-primary/80 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    </button>
                </div>
            </form>
        </div>
    );
}
