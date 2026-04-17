'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
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
                body: JSON.stringify({ messages: [...messages, userMessage] }),
            });

            if (!response.ok) throw new Error('API request failed');

            const reader = response.body?.getReader();
            const decoder = new TextEncoder();
            let assistantMessage = '';

            setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

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
        <div className="flex flex-col h-[700px] w-full max-w-4xl mx-auto glass rounded-3xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-white/10 bg-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    <Bot className="text-primary" />
                </div>
                <div>
                    <h2 className="text-lg font-bold">AdMate-MMP AI Chat</h2>
                    <p className="text-xs text-gray-400">AppsFlyer · Airbridge · Adjust 전문 어시스턴트</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-black/20">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                        <Bot size={48} className="text-primary" />
                        <p className="text-gray-300">궁금하신 MMP 설정이나 가이드에 대해 질문해 보세요!</p>
                    </div>
                )}
                <AnimatePresence>
                    {messages.map((msg, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "flex gap-4",
                                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                                msg.role === 'user' ? "bg-primary border-primary/50" : "bg-white/10 border-white/20"
                            )}>
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={cn(
                                "max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed",
                                msg.role === 'user'
                                    ? "bg-primary/20 border border-primary/30 rounded-tr-none"
                                    : "bg-white/5 border border-white/10 rounded-tl-none"
                            )}>
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                                {msg.content === '' && i === messages.length - 1 && isLoading && (
                                    <Loader2 className="animate-spin text-primary" size={16} />
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-6 bg-white/5 border-t border-white/10">
                <div className="relative">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="MMP에 대해 무엇이든 물어보세요..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 pr-16 focus:outline-none focus:border-primary/50 transition-colors"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-2 h-12 w-12 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-3 text-center">
                    AI의 답변은 참고용이며, 정확한 내용은 공식 문서를 확인해 주세요.
                </p>
            </form>
        </div>
    );
}
