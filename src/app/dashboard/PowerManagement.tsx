"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    FileText, Smartphone, UserPlus, XCircle, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp, ShieldCheck,
    MessageSquare, Trash2, UploadCloud, Camera, RefreshCw
} from "lucide-react";
import { registerProxy, revokeProxy, ProxyType } from "./power-actions"; // We will create this
import { cn } from "@/lib/utils";

interface PowerManagementProps {
    userId: string;
    userRole: string; // Added userRole
    // We could pass initial data here or fetch it inside
    givenProxy?: any;
    receivedProxies?: any[];
}

export default function PowerManagement({ userId, userRole, givenProxy, receivedProxies = [] }: PowerManagementProps) {
    // Only collapsible/hidden by default for Operators
    const isOperator = userRole === 'OPERATOR';
    const [isExpanded, setIsExpanded] = useState(!isOperator);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Form Stats
    const [repDoc, setRepDoc] = useState("");
    const [repName, setRepName] = useState("");
    const [ownerDoc, setOwnerDoc] = useState(""); // Nuevo para Operador
    const [method, setMethod] = useState<ProxyType | null>(isOperator ? 'PDF' : null);

    // Operator specific hardware
    const [isCaptured, setIsCaptured] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [pdfFile, setPdfFile] = useState<File | null>(null); // Restore for standard users
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Stop camera cleanup
    useEffect(() => {
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach(track => track.stop());
            }
        };
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }, // Rear camera preferred
                audio: false
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setMessage({ type: 'error', text: "No se pudo acceder a la cámara. Verifica los permisos de tu navegador." });
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setCapturedImage(dataUrl);
                setIsCaptured(true);
                stopCamera();
            }
        }
    };

    // Common for USER role
    const [otpCode, setOtpCode] = useState(""); // New: OTP
    const [otpSent, setOtpSent] = useState(false); // Mock OTP state
    const [otpVerified, setOtpVerified] = useState(false); // New: OTP verification state
    const [registered, setRegistered] = useState(false); // New: To show success screen

    const handleSendOTP = () => {
        if (!repDoc) {
            setMessage({ type: 'error', text: "Ingrese el documento primero." });
            return;
        }
        setLoading(true);
        // Mock Send
        setTimeout(() => {
            setLoading(false);
            setOtpSent(true);
            setMessage({ type: 'success', text: "Código enviado al usuario (Simulado: 1234)" });
            // For demo purposes, auto-verify OTP
            setOtpVerified(true);
        }, 1500);
    };

    const handleGrant = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const result = await registerProxy({
                type: (isOperator ? 'OPERATOR' : method) as ProxyType,
                representativeDoc: repDoc,
                externalName: repName,
                ownerDoc: ownerDoc, // PASSING ownerDoc
            });

            if (result.success) {
                setRegistered(true);
                // Reset form
                setRepDoc("");
                setRepName("");
                setOwnerDoc("");
                setIsCaptured(false);
                setCapturedImage(null);
                setIsCameraActive(false);
            } else {
                setMessage({ type: 'error', text: result.message || "Error al registrar poder." });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (proxyId: string) => {
        if (!confirm("¿Estás seguro de revocar este poder?")) return;
        setLoading(true);
        try {
            const result = await revokeProxy(proxyId);
            if (result.success) {
                setMessage({ type: 'success', text: "Poder revocado exitosamente." });
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Helper variables for progressive disclosure
    const step1Complete = repDoc.trim().length > 0 && repName.trim().length > 0;
    const step1OperatorComplete = ownerDoc.trim().length > 0 && repDoc.trim().length > 0 && repName.trim().length > 0;
    const step3Complete = isOperator ? !!capturedImage : ((method === 'DIGITAL' && otpVerified) || (method === 'PDF' && !!pdfFile));
    const SuccessScreenLocal = () => (
        <div className="flex flex-col items-center justify-center py-14 gap-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="relative">
                <div className="w-32 h-32 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <div className="w-22 h-22 rounded-full bg-emerald-500/20 flex items-center justify-center p-4">
                        <CheckCircle2 className="w-14 h-14 text-emerald-400" strokeWidth={1.5} />
                    </div>
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
            </div>

            <div className="text-center space-y-3 max-w-xs">
                <h3 className="text-2xl font-extrabold text-white leading-tight">
                    ¡Poder registrado exitosamente!
                </h3>
                <p className="text-lg text-gray-300 leading-relaxed">
                    Tu representante ha sido autorizado.
                </p>
            </div>

            <div className="w-full p-4 rounded-2xl bg-emerald-900/15 border border-emerald-500/20 text-center">
                <p className="text-sm text-emerald-400 font-medium">
                    ✅ El poder quedó registrado en el sistema de la asamblea.
                </p>
            </div>
            <Button onClick={() => setRegistered(false)} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 px-8">
                Registrar otro poder
            </Button>
        </div>
    );

    return (
        <Card className="bg-[#121212] border-white/5 transition-all duration-300">
            <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => isOperator && setIsExpanded(!isExpanded)}>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-gray-200 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        {isOperator ? "Validar Poder" : "Gestión de Poderes"}
                    </CardTitle>
                    {isOperator && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                    )}
                </div>
                {(isExpanded || !isOperator) && (
                    <CardDescription>
                        {isOperator
                            ? "Registre o valide poderes presentados físicamente."
                            : "Otorga tu voto a un tercero o administra los poderes recibidos."}
                    </CardDescription>
                )}
            </CardHeader>

            {isExpanded && (
                <CardContent className="animate-in slide-in-from-top-2 duration-200">
                    {registered ? (
                        <SuccessScreenLocal />
                    ) : isOperator ? (
                        <div className="space-y-8 py-2">
                            {/* PASO 1 (OPERADOR): Datos Iniciales */}
                            <div className="space-y-5">
                                <div className="space-y-3">
                                    <Label htmlFor="ownerDoc" className="text-gray-200 text-base font-semibold block">
                                        Número de Cédula del Propietario
                                    </Label>
                                    <Input
                                        id="ownerDoc"
                                        placeholder="Ej: 80123456"
                                        value={ownerDoc}
                                        onChange={(e) => setOwnerDoc(e.target.value)}
                                        className="h-14 text-lg bg-[#1E1E1E] border-2 border-white/15 text-white placeholder:text-gray-500 focus:border-indigo-500 rounded-xl px-4 transition-colors"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label htmlFor="repDoc" className="text-gray-200 text-base font-semibold block">
                                        Número de Cédula del Apoderado
                                    </Label>
                                    <Input
                                        id="repDoc"
                                        placeholder="Ej: 12345678"
                                        value={repDoc}
                                        onChange={(e) => setRepDoc(e.target.value)}
                                        className="h-14 text-lg bg-[#1E1E1E] border-2 border-white/15 text-white placeholder:text-gray-500 focus:border-indigo-500 rounded-xl px-4 transition-colors"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label htmlFor="repName" className="text-gray-200 text-base font-semibold block">
                                        Nombre Completo del Apoderado
                                    </Label>
                                    <Input
                                        id="repName"
                                        placeholder="Ej: Juan Pérez"
                                        value={repName}
                                        onChange={(e) => setRepName(e.target.value)}
                                        className="h-14 text-lg bg-[#1E1E1E] border-2 border-white/15 text-white placeholder:text-gray-500 focus:border-indigo-500 rounded-xl px-4 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* PASO 2 (OPERADOR): Cámara Real */}
                            {step1OperatorComplete && !capturedImage && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 fill-mode-both">
                                    <p className="text-gray-200 text-base font-semibold">Captura del Documento Físico</p>

                                    {!isCameraActive ? (
                                        <Button
                                            onClick={() => {
                                                setIsCameraActive(true);
                                                setTimeout(startCamera, 100); // Small delay to ensure ref is ready
                                            }}
                                            className="w-full h-24 text-xl font-bold rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl transition-all flex items-center justify-center gap-4"
                                        >
                                            <Camera className="w-8 h-8" />
                                            Abrir Cámara para tomar foto al Poder
                                        </Button>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-[#1A1A1A] border-4 border-white/5 shadow-2xl group/camera">
                                                <video
                                                    ref={videoRef}
                                                    autoPlay
                                                    playsInline
                                                    className="w-full h-full object-cover"
                                                />

                                                {/* Overlay de Guía */}
                                                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40 flex items-center justify-center">
                                                    <div className="w-full h-full border-2 border-dashed border-white/30 rounded-xl" />
                                                </div>

                                                {/* Indicador Live */}
                                                <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                                    <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">En Vivo</span>
                                                </div>

                                                {/* Botón Obturador Central */}
                                                <div className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in-95 duration-500">
                                                    <button
                                                        onClick={takePhoto}
                                                        className="group/shutter flex flex-col items-center gap-3 transition-transform active:scale-95"
                                                    >
                                                        <div className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center bg-black/20 backdrop-blur-sm group-hover/shutter:bg-black/40 transition-colors">
                                                            <div className="w-18 h-18 rounded-full bg-white shadow-lg" />
                                                        </div>
                                                        <span className="bg-black/80 backdrop-blur-md text-white text-sm font-black px-4 py-2 rounded-xl uppercase tracking-widest shadow-xl">
                                                            Tomar foto
                                                        </span>
                                                    </button>
                                                </div>
                                            </div>
                                            <canvas ref={canvasRef} className="hidden" />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* VISTA PREVIA (OPERADOR) */}
                            {capturedImage && (
                                <div className="space-y-4 animate-in zoom-in-95 duration-300 fill-mode-both">
                                    <p className="text-gray-200 text-base font-semibold">Previsualización de la Captura</p>
                                    <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border-4 border-emerald-500/30 shadow-2xl">
                                        <img
                                            src={capturedImage}
                                            alt="Vista previa"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute bottom-4 right-4 bg-emerald-500/90 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-lg">
                                            <CheckCircle2 className="w-4 h-4" />
                                            Capturado
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setIsCaptured(false);
                                            setCapturedImage(null);
                                            setIsCameraActive(true);
                                            setTimeout(startCamera, 100);
                                        }}
                                        className="w-full h-14 rounded-2xl bg-red-900/10 border-2 border-red-500/20 text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-all flex items-center justify-center gap-3"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                        Descartar y volver a tomar foto
                                    </Button>
                                </div>
                            )}

                            {/* PASO 3 (OPERADOR): Finalizar */}
                            {capturedImage && (
                                <div className="animate-in fade-in zoom-in-95 duration-500 fill-mode-both pt-4">
                                    <Button
                                        onClick={() => handleGrant()}
                                        disabled={loading}
                                        className="w-full h-20 text-xl font-extrabold tracking-wide bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-2xl shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-3"
                                    >
                                        {loading ? (
                                            <><Loader2 className="w-7 h-7 animate-spin" /> Procesando...</>
                                        ) : (
                                            <><CheckCircle2 className="w-7 h-7" /> FINALIZAR Y ENVIAR PODER</>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {message && message.type === 'error' && (
                                <div className="p-4 rounded-xl text-base flex items-center gap-3 font-medium bg-red-900/20 text-red-400 border border-red-500/20">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    {message.text}
                                </div>
                            )}
                        </div>
                    ) : (
                        <Tabs defaultValue="give" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-[#1A1A1A]">
                                <TabsTrigger value="give">Otorgar Poder</TabsTrigger>
                                {userRole === 'USER' && (
                                    <TabsTrigger value="receive">Poderes Recibidos</TabsTrigger>
                                )}
                            </TabsList>

                            {/* GRANT POWER TAB */}
                            <TabsContent value="give" className="space-y-4 pt-4">
                                {givenProxy ? (
                                    <div className="p-4 rounded-lg bg-indigo-950/20 border border-indigo-500/20 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="w-6 h-6 text-indigo-400" />
                                            <div>
                                                <h4 className="font-semibold text-indigo-300">Poder Activo</h4>
                                                <p className="text-sm text-gray-400">
                                                    Has otorgado tu poder de voto a: <br />
                                                    <span className="text-white font-medium">
                                                        {givenProxy.representative?.full_name || givenProxy.external_name || givenProxy.representative_doc_number}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleRevoke(givenProxy.id)}
                                            disabled={loading}
                                            className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                                            Revocar Poder
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleGrant} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-gray-300">Método de Representación</Label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div
                                                    onClick={() => setMethod('DIGITAL')}
                                                    className={cn(
                                                        "cursor-pointer p-3 rounded-lg border flex flex-col items-center gap-2 transition-all",
                                                        method === 'DIGITAL'
                                                            ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                                                            : "bg-[#1A1A1A] border-white/10 text-gray-500 hover:bg-[#222]"
                                                    )}
                                                >
                                                    <Smartphone className="w-6 h-6" />
                                                    <span className="text-xs font-medium">Digital (App)</span>
                                                </div>
                                                <div
                                                    onClick={() => setMethod('PDF')}
                                                    className={cn(
                                                        "cursor-pointer p-3 rounded-lg border flex flex-col items-center gap-2 transition-all",
                                                        method === 'PDF'
                                                            ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                                                            : "bg-[#1A1A1A] border-white/10 text-gray-500 hover:bg-[#222]"
                                                    )}
                                                >
                                                    <FileText className="w-6 h-6" />
                                                    <span className="text-xs font-medium">Subir PDF</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Common Fields */}
                                        <div className="space-y-2">
                                            <Label htmlFor="repDoc" className="text-gray-300">Número de Identificación</Label>
                                            <Input
                                                id="repDoc"
                                                placeholder="Cédula / ID"
                                                value={repDoc}
                                                onChange={(e) => setRepDoc(e.target.value)}
                                                className="bg-[#1A1A1A] border-white/10 text-white"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="repName" className="text-gray-300">Nombre Completo</Label>
                                            <Input
                                                id="repName"
                                                placeholder="Nombre del Apoderado"
                                                value={repName}
                                                onChange={(e) => setRepName(e.target.value)}
                                                className="bg-[#1A1A1A] border-white/10 text-white"
                                            />
                                        </div>

                                        {method === 'DIGITAL' ? (
                                            <div className="space-y-2">
                                                <Label htmlFor="otp" className="text-gray-300">Código OTP</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        id="otp"
                                                        placeholder="Código de verificación"
                                                        value={otpCode}
                                                        onChange={(e) => setOtpCode(e.target.value)}
                                                        className="bg-[#1A1A1A] border-white/10 text-white"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={handleSendOTP}
                                                        disabled={loading || otpSent || !repDoc}
                                                        className="shrink-0"
                                                    >
                                                        {otpSent ? "Enviado" : "Enviar Código"}
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-gray-500">Se enviará un código al contacto del usuario.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 animate-in fade-in">
                                                <Label htmlFor="pdf" className="text-gray-300">Subir Poder Firmado (PDF)</Label>
                                                <Input
                                                    id="pdf"
                                                    type="file"
                                                    accept=".pdf"
                                                    onChange={(e) => setPdfFile(e.target.files ? e.target.files[0] : null)}
                                                    className="bg-[#1A1A1A] border-white/10 text-gray-300 file:bg-indigo-600 file:text-white file:border-0 file:rounded-md file:px-2 file:py-1 file:mr-3 file:text-sm file:font-medium hover:file:bg-indigo-500"
                                                />
                                            </div>
                                        )}

                                        <Button
                                            type="submit"
                                            disabled={loading || !step1Complete || !step3Complete}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-2"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                                            Registrar Poder
                                        </Button>
                                    </form>
                                )}
                            </TabsContent>

                            {/* RECEIVED POWERS TAB - Only for USER role */}
                            {userRole === 'USER' && (
                                <TabsContent value="receive" className="pt-4">
                                    {receivedProxies.length > 0 ? (
                                        <div className="space-y-3">
                                            <p className="text-sm text-gray-400 mb-2">
                                                Estás representando a {receivedProxies.length} unidades:
                                            </p>
                                            {receivedProxies.map((proxy) => (
                                                <div key={proxy.id} className="p-3 bg-[#1A1A1A] border border-white/10 rounded-lg flex justify-between items-center">
                                                    <div>
                                                        <p className="text-white font-medium">{proxy.principal?.full_name}</p>
                                                        <p className="text-xs text-gray-500">
                                                            Unidad: {proxy.principal?.units?.number} | Coef: {Number(proxy.principal?.units?.coefficient).toFixed(4)}
                                                        </p>
                                                    </div>
                                                    <div className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded border border-emerald-500/20">
                                                        Activo
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="p-3 bg-indigo-900/10 border border-indigo-500/20 rounded-lg mt-4">
                                                <p className="text-sm text-indigo-300 text-center">
                                                    Tu voto ahora vale: <span className="font-bold text-white">
                                                        {(
                                                            receivedProxies.reduce((acc, p) => acc + (p.principal?.units?.coefficient || 0), 0)
                                                        ).toFixed(4)} + Tu Coef.
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            <p>No has recibido poderes de otros usuarios.</p>
                                        </div>
                                    )}
                                </TabsContent>
                            )}
                        </Tabs>
                    )}

                    {message && !registered && ( // Only show message if not showing success screen
                        <div className={cn(
                            "mt-4 p-3 rounded-lg text-sm flex items-center gap-2",
                            message.type === 'success' ? "bg-emerald-900/20 text-emerald-400" : "bg-red-900/20 text-red-400"
                        )}>
                            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            {message.text}
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
