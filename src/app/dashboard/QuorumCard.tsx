"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuorumCardProps {
    quorum: number;
    loading: boolean;
}

export default function QuorumCard({ quorum, loading }: QuorumCardProps) {
    const hasQuorum = quorum > 0.5;

    return (
        <Card className="bg-[#121212] border-white/5 h-full flex flex-col shadow-lg rounded-2xl" style={{ padding: '0px' }}>
            <CardHeader className="!p-1 md:!p-6 !pb-0 md:!pb-2 !pt-2 md:!pt-6">
                <CardTitle className="text-gray-400 text-[10px] md:text-xs font-black uppercase tracking-widest leading-none text-center md:text-left">Quórum Presente</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end !p-1 md:!p-6 !pt-0 !pb-2 md:!pt-4 md:!pb-6">
                {loading ? (
                    <div className="flex justify-between text-sm mt-1 animate-pulse">
                        <div className="h-4 md:h-6 w-12 md:w-16 bg-white/10 rounded mx-auto md:mx-0"></div>
                    </div>
                ) : (
                    <>
                        <div className={`text-2xl md:text-4xl font-black tracking-tight leading-none text-center md:text-left overflow-hidden ${hasQuorum ? "text-emerald-500" : "text-yellow-500"}`}>
                            {(quorum * 100).toFixed(2)}%
                        </div>
                        <div className="flex justify-between text-[11px] md:text-xs mt-1 md:mt-3">
                            <span className="text-gray-500 font-medium">Req: &gt;50%</span>
                            <span className={`font-bold ${hasQuorum ? "text-emerald-400" : "text-yellow-400"}`}>
                                {hasQuorum ? "Alcanzado" : "Esperando"}
                            </span>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
