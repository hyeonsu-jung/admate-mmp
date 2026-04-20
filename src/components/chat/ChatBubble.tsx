'use client';

import React, { createContext, useContext, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, AlertCircle, Info, CheckCircle2, ChevronRight, List } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ParameterListCard from './ParameterListCard';

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

    // P0 대응: 단독 줄에 있는 괄호 수정 및 마크다운 정규화
    const processedContent = useMemo(() => {
        if (isUser) return content;

        return content
            // 1. "텍스트 (\n)" 패턴이나 "텍스트 (\r\n)" 패턴이 있으면 붙여줌 (P0 대응)
            .replace(/(\S+)\s*\(\s*\n/g, '$1 (')
            // 2. 항목명 뒤에 바로 붙는 괄호 보정
            .replace(/(\*\*.*?\*\*)\s+\(/g, '$1 (');
    }, [content, isUser]);

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
                        : "bg-[#fcfdfe] border border-slate-200/60 rounded-tl-none text-slate-800" // Slightly lighter/cleaner surface
                )}>
                    {isUser ? (
                        <div className="whitespace-pre-wrap">{content}</div>
                    ) : (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-4 mt-2 text-slate-900 border-b border-slate-100 pb-2" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="text-lg font-bold mb-3 mt-6 text-slate-900 border-l-4 border-primary pl-3 py-0.5" {...props} />,
                                h3: ({ node, ...props }) => <h3 className="text-md font-bold mb-2 mt-4 text-slate-800" {...props} />,
                                p: ({ node, ...props }) => <p className="mb-4 last:mb-0 text-slate-700" {...props} />,
                                ul: ({ node, ...props }: any) => {
                                    const depth = useContext(ListDepthContext);
                                    return (
                                        <ListDepthContext.Provider value={depth + 1}>
                                            <ul className={cn("space-y-4 mb-6 list-none", depth > 0 && "mt-3 ml-4")} {...props} />
                                        </ListDepthContext.Provider>
                                    );
                                },
                                ol: ({ node, ...props }: any) => {
                                    const depth = useContext(ListDepthContext);
                                    return (
                                        <ListDepthContext.Provider value={depth + 1}>
                                            <ol className={cn("space-y-4 mb-6 list-none", depth > 0 && "mt-3 ml-4")} {...props} />
                                        </ListDepthContext.Provider>
                                    );
                                },
                                li: ({ node, ordered, index, ...props }: any) => {
                                    const depth = useContext(ListDepthContext);
                                    const isTopLevel = depth === 1;

                                    return (
                                        <li className={cn(
                                            "flex gap-3 items-start group relative",
                                            isTopLevel ? "pt-4 first:pt-0 border-t border-slate-100 first:border-0" : "mt-2"
                                        )}>
                                            {ordered ? (
                                                <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-1 shadow-sm uppercase">
                                                    {index + 1}
                                                </span>
                                            ) : isTopLevel ? (
                                                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center mt-1 shrink-0 group-hover:bg-primary/10 transition-colors">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-primary transition-colors" />
                                                </div>
                                            ) : (
                                                <ChevronRight size={14} className="text-slate-300 mt-1.5 shrink-0 group-hover:text-primary transition-colors" />
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
                                code: ({ node, inline, className, children, ...props }: any) => {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const codeValue = String(children).replace(/\n$/, '');

                                    // P3 대응: 코드블록이 JSON이고 type이 parameter_list인 경우 전용 카드 렌더링
                                    if (!inline && match && match[1] === 'json') {
                                        try {
                                            const data = JSON.parse(codeValue);
                                            if (data.type === 'parameter_list') {
                                                return <ParameterListCard items={data.items} />;
                                            }
                                        } catch (e) {
                                            // JSON 파싱 실패 시 일반 코드블록으로 렌더링
                                        }
                                    }

                                    return inline ? (
                                        <code className="bg-slate-100/80 px-1.5 py-0.5 rounded text-sm text-pink-600 font-mono font-bold border border-slate-200/50" {...props}>
                                            {children}
                                        </code>
                                    ) : (
                                        <div className="relative group my-6">
                                            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-[13px] font-mono border border-white/10 shadow-inner">
                                                {children}
                                            </pre>
                                            <div className="absolute top-2 right-2 px-2 py-1 rounded bg-white/5 text-[10px] text-white/40 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                                {match ? match[1] : 'code'}
                                            </div>
                                        </div>
                                    );
                                },
                                blockquote: ({ node, ...props }) => (
                                    <div className="my-6 p-4 bg-blue-50/50 border-l-4 border-primary rounded-r-xl flex gap-3 shadow-sm">
                                        <Info className="text-primary shrink-0 mt-0.5" size={18} />
                                        <div className="text-[14px] text-slate-700 italic font-medium leading-relaxed">
                                            {props.children}
                                        </div>
                                    </div>
                                ),
                                a: ({ node, ...props }) => (
                                    <a className="text-primary font-semibold underline underline-offset-4 hover:text-primary/80 transition-colors" target="_blank" {...props} />
                                )
                            }}
                        >
                            {processedContent}
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
