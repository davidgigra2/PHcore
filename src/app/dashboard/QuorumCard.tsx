"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuorumCardProps {
    quorum: number;
    loading: boolean;
    variant?: 'default' | 'compact';
}

export default function QuorumCard({ quorum, loading, variant = 'default' }: QuorumCardProps) {
    const hasQuorum = quorum > 0.5;
    const isCompact = variant === 'compact';
    const mainColor = hasQuorum ? "text-emerald-500" : "text-yellow-500";
    const accentColor = hasQuorum ? "text-emerald-400" : "text-yellow-400";
    const borderColor = hasQuorum ? "border-emerald-500/30" : "border-yellow-500/30";
    const bgColor = hasQuorum ? "bg-emerald-950/20" : "bg-yellow-950/20";
    const titleColor = isCompact ? (hasQuorum ? "text-emerald-300/70" : "text-yellow-300/70") : "text-gray-400";

    return (
        <Card 
            className={`h-full flex flex-col shadow-lg rounded-2xl transition-colors duration-500 ${isCompact ? `border-2 ${borderColor} ${bgColor}` : 'bg-[#121212] border-white/5'}`}
            style={{ padding: '0px' }}
        >
            <CardHeader className={`${isCompact ? '!p-2 !pb-0' : '!p-2 !pb-0 md:!p-4'}`}>
                <CardTitle className={`font-black uppercase tracking-widest leading-none text-center ${isCompact ? 'text-[9px] md:text-[10px]' : 'text-[10px] md:text-xs'} ${titleColor}`}>
                    Quórum Presente
                </CardTitle>
            </CardHeader>
            <CardContent className={`flex-1 flex flex-col justify-center ${isCompact ? '!p-2 !pt-0.5' : '!p-2 !pt-1 md:!p-4'}`}>
                {loading ? (
                    <div className="flex justify-between text-sm animate-pulse">
                        <div className="h-4 md:h-6 w-12 md:w-16 bg-white/10 rounded mx-auto"></div>
                    </div>
                ) : (
                    <>
                        <div className={`font-black tracking-tight leading-none text-center overflow-hidden ${mainColor} ${isCompact ? 'text-xl md:text-2xl' : 'text-3xl md:text-4xl'}`}>
                            {(quorum * 100).toFixed(2)}%
                        </div>
                        <div className={`flex justify-between items-center mt-1 md:mt-2`}>
                            {!isCompact && <span className="text-gray-500 font-medium text-[10px] md:text-xs">Req: &gt;50%</span>}
                            <span className={`font-black uppercase tracking-tighter ${accentColor} ${isCompact ? 'text-[8px] md:text-[9px] w-full text-center' : 'text-[11px] md:text-xs'}`}>
                                {hasQuorum ? "Alcanzado" : "Esperando"}
                            </span>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
