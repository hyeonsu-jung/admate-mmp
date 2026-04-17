'use client';

import React, { createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, AlertCircle, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// 리스트 깊이를 추적하기 위한 컨텍스트
const ListDepthContext = createContext(0);

interface ChatBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    mmpName?: string;
    isLoading?: boolean;
}

export default function ChatBubble({ role, content, mmpName, isLoading }: ChatBubbleProps) {
    const isUser = role === 'user';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "flex gap-4 w-full mb-6",
                isUser ? "flex-row-reverse" : "flex-row"
            )}
        >
            {/* Avatar */}
            <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border shadow-sm",
                isUser ? "bg-primary border-primary/50 text-white" : "bg-white/10 border-white/20 text-primary"
            )}>
                {isUser ? <User size={20} /> : <Bot size={20} />}
            </div>

            {/* Bubble Container */}
            <div className={cn(
                "flex flex-col max-w-[92%] sm:max-w-[85%]",
                isUser ? "items-end" : "items-start"
            )}>
                {/* MMP Badge (Assistant only) */}
                {!isUser && mmpName && (
                    <div className="flex items-center gap-1.5 mb-2 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-wider">
                        <Info size={10} />
                        {mmpName} Source
                    </div>
                )}

                {/* Message Bubble */}
                <div className={cn(
                    "p-5 rounded-2xl shadow-lg leading-relaxed text-[15px] break-words overflow-hidden",
                    isUser
                        ? "bg-primary/20 border border-primary/30 rounded-tr-none text-blue-50"
                        : "bg-[#f8fafc] border border-slate-200 rounded-tl-none text-slate-800" // Light surface for Assistant
                )}>
                    {isUser ? (
                        <div className="whitespace-pre-wrap">{content}</div>
                    ) : (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-4 mt-2 text-slate-900 border-b pb-1" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="text-lg font-bold mb-3 mt-4 text-slate-900" {...props} />,
                                h3: ({ node, ...props }) => <h3 className="text-md font-bold mb-2 mt-4 text-slate-800" {...props} />,
                                p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
                                ul: ({ node, ...props }: any) => {
                                    const depth = useContext(ListDepthContext);
                                    return (
                                        <ListDepthContext.Provider value={depth + 1}>
                                            <ul className={cn("space-y-2 mb-4 list-none", depth > 0 && "mt-2 ml-4")} {...props} />
                                        </ListDepthContext.Provider>
                                    );
                                },
                                ol: ({ node, ...props }: any) => {
                                    const depth = useContext(ListDepthContext);
                                    return (
                                        <ListDepthContext.Provider value={depth + 1}>
                                            <ol className={cn("space-y-3 mb-4 list-none", depth > 0 && "mt-2 ml-4")} {...props} />
                                        </ListDepthContext.Provider>
                                    );
                                },
                                li: ({ node, ordered, index, ...props }: any) => {
                                    const depth = useContext(ListDepthContext);
                                    const isTopLevel = depth === 1;

                                    return (
                                        <li className={cn("flex gap-3 items-start group", isTopLevel ? "mt-4 first:mt-0" : "mt-1")}>
                                            {ordered ? (
                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold shrink-0 mt-0.5 shadow-sm">
                                                    {index + 1}
                                                </span>
                                            ) : isTopLevel ? (
                                                <CheckCircle2 size={18} className="text-primary mt-1 shrink-0" />
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2.5 ml-2 shrink-0 group-hover:bg-primary transition-colors" />
                                            )}
                                            <div className={cn(
                                                "flex-1 transition-colors",
                                                isTopLevel ? "text-slate-900 font-bold" : "text-slate-600 font-medium text-[14px]"
                                            )}>
                                                {props.children}
                                            </div>
                                        </li>
                                    );
                                },
                                strong: ({ node, ...props }) => <strong className="font-bold text-slate-950" {...props} />,
                                code: ({ node, inline, ...props }: any) => (
                                    inline
                                        ? <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-pink-600 font-mono" {...props} />
                                        : <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto my-4 text-xs font-mono border border-white/10" {...props} />
                                ),
                                blockquote: ({ node, ...props }) => (
                                    <div className="my-6 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl flex gap-3 shadow-sm">
                                        <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                                        <div className="text-sm text-amber-900 italic font-medium">
                                            {props.children}
                                        </div>
                                    </div>
                                ),
                                a: ({ node, ...props }) => (
                                    <a className="text-primary font-semibold underline underline-offset-4 hover:text-primary/80 transition-colors" target="_blank" {...props} />
                                )
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    )}
                    {isLoading && content === '' && (
                        <div className="flex items-center gap-2 text-slate-400">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                                <Bot size={16} />
                            </motion.div>
                            <span>답변을 생성하고 있습니다...</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
