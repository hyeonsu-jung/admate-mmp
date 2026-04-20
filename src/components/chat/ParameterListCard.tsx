'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

interface ParameterItem {
    name: string;
    key: string;
    description: string;
}

interface ParameterListCardProps {
    items: ParameterItem[];
}

export default function ParameterListCard({ items }: ParameterListCardProps) {
    if (!items || items.length === 0) return null;

    return (
        <div className="my-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
                <Info size={14} className="text-primary" />
                <span className="text-[12px] font-bold text-slate-700 uppercase tracking-tight">상세 파라미터 정보</span>
            </div>
            <div className="divide-y divide-slate-100">
                {items.map((item, index) => (
                    <motion.div
                        key={`${item.key}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 hover:bg-slate-50/30 transition-colors"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h4 className="text-[15px] font-bold text-slate-900 leading-none">
                                {item.name}
                            </h4>
                            <code className="px-2 py-0.5 rounded-md bg-slate-100 text-pink-600 text-[12px] font-mono font-bold shadow-sm border border-slate-200/50">
                                {item.key}
                            </code>
                        </div>
                        <p className="text-[13.5px] text-slate-600 leading-relaxed">
                            {item.description}
                        </p>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
