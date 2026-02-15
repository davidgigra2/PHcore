import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Panel de Control</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">{user.email}</span>
                        <form action="/auth/signout" method="post">
                            <Button variant="outline" className="border-white/10 hover:bg-white/5">Cerrar Sesión</Button>
                        </form>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-[#121212] border-white/5">
                        <CardHeader>
                            <CardTitle className="text-gray-200">Estado de Asamblea</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-indigo-500">Activa</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#121212] border-white/5">
                        <CardHeader>
                            <CardTitle className="text-gray-200">Quórum Presente</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-emerald-500">0.00%</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#121212] border-white/5">
                        <CardHeader>
                            <CardTitle className="text-gray-200">Unidades Registradas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-white">0</div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
