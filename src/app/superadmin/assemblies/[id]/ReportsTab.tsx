"use client";

import AdminReports from "@/app/dashboard/AdminReports";

interface ReportsTabProps {
    assemblyId: string;
}

export default function ReportsTab({ assemblyId }: ReportsTabProps) {
    return (
        <div className="bg-[#111] border border-white/5 rounded-xl p-6">
            <AdminReports
                assemblyId={assemblyId}
                hideHeader={true}
                showCard={false}
            />
        </div>
    );
}
