"use client";

import UnitsManagement from "@/app/dashboard/UnitsManagement";

interface UnitsTabProps {
    assemblyId: string;
    units: any[];
    totalUnits: number;
    totalCoefficient: number;
    proxyMap: Record<string, { type: string; is_external: boolean }>;
}

export default function UnitsTab({ 
    assemblyId, 
    units, 
    totalUnits, 
    totalCoefficient, 
    proxyMap 
}: UnitsTabProps) {
    return (
        <div className="bg-[#111] rounded-2xl border border-white/10 p-6">
            <UnitsManagement 
                assemblyId={assemblyId} 
                units={units} 
                proxyMap={proxyMap}
                userRole="SUPER_ADMIN"
                totalUnitsHeader={totalUnits}
                totalCoefficientHeader={totalCoefficient}
            />
        </div>
    );
}
