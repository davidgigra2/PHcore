"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Smartphone, Save, CheckCircle2, Send, ArrowLeft, RefreshCw, Trash2, Play, Beaker, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { getTemplate, saveTemplate, NotificationType, NotificationChannel, NotificationTemplate, getNotificationLogs, generateNotificationLogs, dispatchNotifications, resetNotificationLogs, sendTestNotification, uploadTemplateImage } from "./notifications/actions";

function DispatchView({ assemblyId, activeType, activeChannel, onBack }: { assemblyId: string, activeType: NotificationType, activeChannel: NotificationChannel, onBack: () => void }) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const loadLogs = async () => {
        setLoading(true);
        const data = await getNotificationLogs(assemblyId, activeType, activeChannel);
        setLogs(data);
        setLoading(false);
    };

    useEffect(() => {
        loadLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assemblyId, activeType, activeChannel]);

    const handleGenerate = async () => {
        setProcessing(true);
        try {
            const res = await generateNotificationLogs(assemblyId, activeType, activeChannel);
            setMessage({ type: res.success ? 'success' : 'error', text: res.message || "Listo" });
            await loadLogs();
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || "Error al generar" });
        }
        setProcessing(false);
    };

    const handleReset = async () => {
        if (!confirm("¿Está seguro de limpiar todos los registros para esta plantilla? Tendrá que volver a generar la lista.")) return;
        setProcessing(true);
        try {
            await resetNotificationLogs(assemblyId, activeType, activeChannel);
            setMessage({ type: 'success', text: "Registros limpiados." });
            await loadLogs();
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || "Error al limpiar" });
        }
        setProcessing(false);
    };

    const handleDispatch = async () => {
        if (!confirm("¿Está seguro de iniciar o reanudar el envío a los destinos pendientes?")) return;
        setProcessing(true);
        try {
            const res = await dispatchNotifications(assemblyId, activeType, activeChannel);
            setMessage({ type: res.success ? 'success' : 'error', text: res.message || "Envío finalizado" });
            await loadLogs();
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || "Error durante el envío" });
        }
        setProcessing(false);
    };

    const pending = logs.filter(l => l.status === 'PENDING').length;
    const sent = logs.filter(l => l.status === 'SENT').length;
    const failed = logs.filter(l => l.status === 'FAILED').length;

    return (
        <div className="space-y-4 animate-in fade-in pt-2">
            <div className="flex items-center gap-4 mb-4">
                <Button variant="secondary" className="bg-gray-700 hover:bg-gray-600 text-white mb-2" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Editar Plantilla
                </Button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Total</p>
                    <p className="text-2xl font-light text-white">{logs.length}</p>
                </div>
                <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-4 text-center">
                    <p className="text-xs text-amber-500 uppercase tracking-widest font-bold">Pendientes</p>
                    <p className="text-2xl font-light text-amber-400">{pending}</p>
                </div>
                <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-4 text-center">
                    <p className="text-xs text-emerald-500 uppercase tracking-widest font-bold">Enviados</p>
                    <p className="text-2xl font-light text-emerald-400">{sent}</p>
                </div>
                <div className="bg-[#1A1A1A] border border-white/10 rounded-lg p-4 text-center">
                    <p className="text-xs text-red-500 uppercase tracking-widest font-bold">Fallidos</p>
                    <p className="text-2xl font-light text-red-400">{failed}</p>
                </div>
            </div>

            {message && (
                <div className={`p-3 rounded-md text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    <CheckCircle2 className="w-4 h-4" />
                    {message.text}
                </div>
            )}

            <div className="flex gap-2 mb-4">
                <Button onClick={handleGenerate} variant="outline" disabled={loading || processing} className="border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white">
                    <RefreshCw className={`w-4 h-4 mr-2 ${processing ? 'animate-spin' : ''}`} /> Generar / Actualizar Lista
                </Button>
                {logs.length > 0 && (
                    <>
                        <Button onClick={handleDispatch} disabled={loading || processing || pending + failed === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            Iniciar o Reanudar Envío Masivo
                        </Button>
                        <Button onClick={handleReset} variant="outline" disabled={loading || processing} className="border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20">
                            <Trash2 className="w-4 h-4 mr-2" /> Limpiar Todo
                        </Button>
                    </>
                )}
            </div>

            <div className="border border-white/10 rounded-lg bg-[#1A1A1A] overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-400 uppercase bg-black/40 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 font-medium">Nombre Destinatario</th>
                                <th className="px-4 py-3 font-medium">Contacto</th>
                                <th className="px-4 py-3 font-medium text-center">Estado</th>
                                <th className="px-4 py-3 font-medium">Error (Si aplica)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Cargando...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                        Sin registros. ¡Haz clic en Generar Lista!
                                    </td>
                                </tr>
                            ) : logs.map(log => (
                                <tr key={log.id} className="hover:bg-white/[0.02]">
                                    <td className="px-4 py-3 text-gray-300">{log.recipient_name}</td>
                                    <td className="px-4 py-3 text-gray-400">{log.recipient_contact}</td>
                                    <td className="px-4 py-3 text-center">
                                        {log.status === 'SENT' && <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-[10px] font-bold">ENVIADO</span>}
                                        {log.status === 'PENDING' && <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded text-[10px] font-bold">PENDIENTE</span>}
                                        {log.status === 'FAILED' && <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-[10px] font-bold">FALLIDO</span>}
                                    </td>
                                    <td className="px-4 py-3 text-gray-400 truncate max-w-[200px]" title={log.error_message}>
                                        {log.error_message || "-"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export interface VisualEditorRef {
    insertHtml: (html: string) => void;
}

const VisualIframeEditor = forwardRef<VisualEditorRef, { value: string; onChange: (v: string) => void }>(({ value, onChange }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const isInternalChange = useRef(false);
    const savedRange = useRef<Range | null>(null);

    useImperativeHandle(ref, () => ({
        insertHtml: (html: string) => {
            const iframe = iframeRef.current;
            if (!iframe || !iframe.contentWindow || !iframe.contentDocument) return;

            const doc = iframe.contentDocument;
            iframe.contentWindow.focus();

            let inserted = false;

            // Try to restore cursor and use execCommand
            if (savedRange.current) {
                const sel = iframe.contentWindow.getSelection();
                if (sel) {
                    sel.removeAllRanges();
                    sel.addRange(savedRange.current);
                    inserted = doc.execCommand('insertHTML', false, html);
                }
            }

            // Fallback: append before </body>
            if (!inserted) {
                const body = doc.body;
                if (body) {
                    const wrapper = doc.createElement('div');
                    wrapper.innerHTML = html;
                    while (wrapper.firstChild) {
                        body.appendChild(wrapper.firstChild);
                    }
                    inserted = true;
                }
            }

            if (inserted) {
                // Sync iframe content back to React state immediately
                // so the useEffect doesn't wipe the inserted content on next render
                isInternalChange.current = true;
                let innerHtml = doc.documentElement.innerHTML;
                innerHtml = innerHtml.replace(new RegExp(window.location.origin, 'g'), '{{appUrl}}');
                const newHtml = `<!DOCTYPE html>\n<html lang="es">\n${innerHtml}\n</html>`;
                onChange(newHtml);
                setTimeout(() => { isInternalChange.current = false; }, 100);
            }
        }
    }));

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const doc = iframe.contentDocument;
        if (!doc) return;

        if (!isInternalChange.current) {
            // Replace {{appUrl}} with local origin so preview images load
            const previewValue = value.replace(/\{\{appUrl\}\}/g, window.location.origin);

            doc.open();
            doc.write(previewValue);
            doc.close();
            doc.designMode = "on";

            const style = doc.createElement("style");
            style.innerHTML = "a { pointer-events: none; } body { cursor: text; font-family: sans-serif; }";
            doc.head.appendChild(style);

            const handleInput = () => {
                isInternalChange.current = true;
                // Convert origin back to {{appUrl}} for saving
                let innerHtml = doc.documentElement.innerHTML;
                innerHtml = innerHtml.replace(new RegExp(window.location.origin, 'g'), '{{appUrl}}');

                const newHtml = `<!DOCTYPE html>\n<html lang="es">\n${innerHtml}\n</html>`;
                onChange(newHtml);
                setTimeout(() => { isInternalChange.current = false; }, 50);
            };

            const saveSelection = () => {
                const sel = iframe.contentWindow?.getSelection();
                if (sel && sel.rangeCount > 0) {
                    savedRange.current = sel.getRangeAt(0);
                }
            };

            doc.addEventListener("input", handleInput);
            doc.addEventListener("keyup", () => { handleInput(); saveSelection(); });
            doc.addEventListener("mouseup", saveSelection);
            doc.addEventListener("focusout", saveSelection);
        }
    }, [value, onChange]);

    return (
        <iframe
            ref={iframeRef}
            className="w-full bg-white min-h-[600px] border-none rounded-b-xl"
            title="Visual Editor"
        />
    );
});
VisualIframeEditor.displayName = "VisualIframeEditor";

interface NotificationsTabProps {
    assemblyId: string;
}

export default function NotificationsTab({ assemblyId }: NotificationsTabProps) {
    const [activeType, setActiveType] = useState<NotificationType>("WELCOME");
    const [activeChannel, setActiveChannel] = useState<NotificationChannel>("EMAIL");

    const [viewMode, setViewMode] = useState<"template" | "dispatch">("template");
    const [template, setTemplate] = useState<NotificationTemplate | null>(null);
    const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const visualEditorRef = useRef<VisualEditorRef>(null);
    const [testContact, setTestContact] = useState("");
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const loadTemplate = async (type: NotificationType, channel: NotificationChannel) => {
        setLoading(true);
        setMessage(null);
        try {
            const data = await getTemplate(assemblyId, type, channel);
            setTemplate(data);
        } catch (error) {
            console.error("Error loading template:", error);
            setMessage({ type: 'error', text: "Error al cargar plantilla" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplate(activeType, activeChannel);
    }, [activeType, activeChannel, assemblyId]);

    const handleSave = async () => {
        if (!template) return;
        setSaving(true);
        setMessage(null);
        try {
            const result = await saveTemplate(template);
            if (result.success) {
                setMessage({ type: 'success', text: "Plantilla actualizada correctamente." });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: result.message || "Error al guardar." });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || "Error desconocido" });
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!testContact) {
            setMessage({ type: 'error', text: "Ingrese un correo o teléfono de prueba." });
            return;
        }
        setTesting(true);
        setMessage(null);
        try {
            // First save the current draft so the backend gets the latest text
            if (template) {
                await saveTemplate(template);
            }
            const res = await sendTestNotification(assemblyId, activeType, activeChannel, testContact);
            if (res.success) {
                setMessage({ type: 'success', text: res.message });
            } else {
                setMessage({ type: 'error', text: res.message });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || "Error desconocido enviando prueba" });
        } finally {
            setTesting(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !template) return;

        setUploadingImage(true);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.append('image', file);

            const res = await uploadTemplateImage(formData);
            if (res.success && res.url) {
                const imgTag = `<br/><img src="${res.url}" alt="Imagen Adjunta" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" />`;

                if (editorMode === "code") {
                    const textarea = document.getElementById('body') as HTMLTextAreaElement;
                    if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const newValue = template.body.substring(0, start) + imgTag + template.body.substring(end);
                        setTemplate({ ...template, body: newValue });
                        setTimeout(() => textarea.setSelectionRange(start + imgTag.length, start + imgTag.length), 0);
                    } else {
                        setTemplate({ ...template, body: template.body + imgTag });
                    }
                } else {
                    visualEditorRef.current?.insertHtml(imgTag);
                }
                setMessage({ type: 'success', text: 'Imagen subida e insertada correctamente.' });
            } else {
                setMessage({ type: 'error', text: res.message || 'Error al subir la imagen' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Error desconocido al subir imagen' });
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };


    const getVariablesHint = () => {
        if (activeType === "WELCOME") {
            return ["{{name}}", "{{doc_number}}", "{{password}}", "{{appUrl}}", "{{assembly_name}}"];
        }
        if (activeType === "PROXY_DOCUMENT") {
            return ["{{NOMBRE_PODERDANTE}}", "{{CEDULA_PODERDANTE}}", "{{NOMBRE_APODERADO}}", "{{CEDULA_APODERADO}}", "{{FECHA_ASAMBLEA}}", "{{CIUDAD}}", "{{DIA}}", "{{MES}}", "{{ANIO}}", "{{OTP}}", "{{TIMESTAMP}}"];
        }
        if (activeType === "CUSTOM_EMAIL" || activeType === "CUSTOM_SMS") {
            return ["{{name}}", "{{doc_number}}", "{{appUrl}}", "{{assembly_name}}"];
        }
        return ["{{name}}", "{{units}}", "{{coef}}", "{{otp_code}}", "{{appUrl}}", "{{assembly_name}}"];
    };

    return (
        <Card className="bg-[#121212] border-white/5 mt-6">
            <CardHeader>
                <CardTitle className="text-gray-200">Personalización de Mensajes y Notificaciones</CardTitle>
                <CardDescription>
                    Configure exactamente qué textos recibirán los usuarios de esta asamblea.
                    Puede usar variables entre llaves doble para personalizar cada mensaje automáticamente.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Left Sidebar: Type Selector */}
                    <div className="space-y-2 md:border-r border-white/10 md:pr-4">
                        <Label className="text-gray-300 text-xs uppercase font-bold tracking-wider mb-2 block">Tipo de Evento</Label>
                        <Button
                            variant="ghost"
                            className={`w-full justify-start transition-colors ${activeType === 'WELCOME' ? 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            onClick={() => setActiveType('WELCOME')}
                        >
                            Bienvenida y Credenciales
                        </Button>
                        <Button
                            variant="ghost"
                            className={`w-full justify-start transition-colors ${activeType === 'CUSTOM_EMAIL' ? 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            onClick={() => { setActiveType('CUSTOM_EMAIL'); setActiveChannel('EMAIL'); }}
                        >
                            Mensaje Personalizado (Email)
                        </Button>
                        <Button
                            variant="ghost"
                            className={`w-full justify-start transition-colors ${activeType === 'CUSTOM_SMS' ? 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            onClick={() => { setActiveType('CUSTOM_SMS'); setActiveChannel('SMS'); }}
                        >
                            Mensaje Personalizado (SMS)
                        </Button>
                        <Button
                            variant="ghost"
                            className={`w-full justify-start transition-colors ${activeType === 'OTP_SIGN' ? 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            onClick={() => { setActiveType('OTP_SIGN'); setActiveChannel('EMAIL'); }}
                        >
                            Firma de Poderes (OTP)
                            <span className="ml-auto text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 rounded">Pronto</span>
                        </Button>
                        <Button
                            variant="ghost"
                            className={`w-full justify-start transition-colors ${activeType === 'PROXY_DOCUMENT' ? 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            onClick={() => { setActiveType('PROXY_DOCUMENT'); setActiveChannel('EMAIL'); }}
                        >
                            Plantilla de Poder (PDF)
                        </Button>
                    </div>

                    {/* Right Content: Channel & Editor */}
                    <div className="md:col-span-3 space-y-4">
                        <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as NotificationChannel)}>
                            <TabsList className="bg-[#1A1A1A] w-full justify-start border-b border-white/10 rounded-none h-auto p-0 pb-px">
                                {activeType !== 'CUSTOM_SMS' && (
                                    <TabsTrigger value="EMAIL" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 py-3 px-6 text-gray-400 hover:text-gray-200">
                                        <Mail className="w-4 h-4 mr-2" /> {activeType === 'PROXY_DOCUMENT' ? 'Documento / Plantilla' : 'Correo (Email)'}
                                    </TabsTrigger>
                                )}
                                {activeType !== 'PROXY_DOCUMENT' && activeType !== 'CUSTOM_EMAIL' && (
                                    <TabsTrigger value="SMS" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 py-3 px-6 text-gray-400 hover:text-gray-200">
                                        <Smartphone className="w-4 h-4 mr-2" /> Celular (SMS)
                                    </TabsTrigger>
                                )}
                            </TabsList>
                        </Tabs>

                        {viewMode === "dispatch" ? (
                            <DispatchView
                                assemblyId={assemblyId}
                                activeType={activeType}
                                activeChannel={activeChannel}
                                onBack={() => setViewMode("template")}
                            />
                        ) : loading ? (
                            <div className="h-48 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                            </div>
                        ) : template ? (
                            <div className="space-y-4 animate-in fade-in pt-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-2 gap-4 border-b border-white/10 mb-4">
                                    <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                                        <Input
                                            value={testContact}
                                            onChange={(e) => setTestContact(e.target.value)}
                                            placeholder={activeChannel === "EMAIL" ? "correo@prueba.com" : "3001234567"}
                                            className="w-48 bg-[#1A1A1A] border-white/10 text-xs text-white"
                                        />
                                        <Button
                                            onClick={handleTest}
                                            disabled={testing || saving || !testContact}
                                            variant="secondary"
                                            className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/20 text-xs h-9"
                                        >
                                            {testing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Beaker className="w-3 h-3 mr-2" />}
                                            Enviar Prueba
                                        </Button>
                                    </div>

                                    <div className="flex gap-2 items-center ml-auto">
                                        {(activeType === 'WELCOME' || activeType === 'CUSTOM_EMAIL' || activeType === 'CUSTOM_SMS') && (
                                            <Button
                                                onClick={() => setViewMode("dispatch")}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 min-w-[120px]"
                                            >
                                                <Send className="w-4 h-4 mr-2" />
                                                Ir a Envío Masivo
                                            </Button>
                                        )}
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 min-w-[120px]"
                                        >
                                            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
                                            Guardar Plantilla
                                        </Button>
                                    </div>
                                </div>

                                {message && (
                                    <div className={`px-3 py-2 rounded-md text-xs flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                        {message.text}
                                    </div>
                                )}

                                {activeChannel === "EMAIL" && (
                                    <div className="space-y-2">
                                        <Label htmlFor="subject" className="text-gray-200">Asunto del Correo</Label>
                                        <Input
                                            id="subject"
                                            value={template.subject || ''}
                                            onChange={e => setTemplate({ ...template, subject: e.target.value })}
                                            className="bg-[#1A1A1A] border-white/10 text-white placeholder:text-gray-500"
                                            placeholder="Escriba el asunto del correo..."
                                        />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="body" className="text-gray-200">Cuerpo del Mensaje {activeChannel === 'SMS' && '(Recomendado max 160 caracteres)'}</Label>

                                    {activeChannel === 'EMAIL' ? (
                                        <div className="rounded-xl overflow-hidden shadow-lg mt-4 w-full border border-white/10">
                                            <div className="bg-[#1A1A1A] px-3 py-2 border-b border-white/10 flex justify-between items-center relative">
                                                <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as "visual" | "code")} className="w-[300px]">
                                                    <TabsList className="bg-black text-gray-400">
                                                        <TabsTrigger value="visual" className="text-xs">Vista Previa Editable</TabsTrigger>
                                                        <TabsTrigger value="code" className="text-xs">Código HTML</TabsTrigger>
                                                    </TabsList>
                                                </Tabs>

                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            ref={fileInputRef}
                                                            onChange={handleImageUpload}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={uploadingImage}
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="bg-white/5 border-white/10 text-xs text-gray-300 hover:bg-white/10 hover:text-white h-7 px-2"
                                                        >
                                                            {uploadingImage ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <ImageIcon className="w-3 h-3 mr-1.5" />}
                                                            Insertar Imagen
                                                        </Button>
                                                    </div>

                                                    <div className="flex gap-1.5 flex-wrap justify-end max-w-[250px]">
                                                        {getVariablesHint().map(v => (
                                                            <span
                                                                key={v}
                                                                className="bg-white/5 text-gray-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wider rounded cursor-pointer hover:bg-white/10 border border-white/5"
                                                                onClick={() => {
                                                                    if (editorMode === "code") {
                                                                        const textarea = document.getElementById('body') as HTMLTextAreaElement;
                                                                        if (textarea) {
                                                                            const start = textarea.selectionStart;
                                                                            const end = textarea.selectionEnd;
                                                                            const newValue = template.body.substring(0, start) + v + template.body.substring(end);
                                                                            setTemplate({ ...template, body: newValue });
                                                                            setTimeout(() => textarea.setSelectionRange(start + v.length, start + v.length), 0);
                                                                        }
                                                                    } else {
                                                                        visualEditorRef.current?.insertHtml(v);
                                                                    }
                                                                }}
                                                            >
                                                                {v}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {editorMode === "code" ? (
                                                <Textarea
                                                    id="body"
                                                    value={template.body}
                                                    onChange={e => setTemplate({ ...template, body: e.target.value })}
                                                    className="bg-[#0A0A0A] border-0 focus-visible:ring-1 focus-visible:ring-indigo-500 text-green-400 font-mono text-[11px] leading-relaxed resize-y min-h-[500px] p-4 shadow-none break-all rounded-none"
                                                    spellCheck={false}
                                                />
                                            ) : (
                                                <VisualIframeEditor
                                                    ref={visualEditorRef}
                                                    value={template.body}
                                                    onChange={newHtml => setTemplate({ ...template, body: newHtml })}
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <Textarea
                                            id="body"
                                            value={template.body}
                                            onChange={e => setTemplate({ ...template, body: e.target.value })}
                                            className="bg-[#1A1A1A] border-white/10 min-h-[150px] font-mono text-sm leading-relaxed resize-y text-white placeholder:text-gray-500 mt-2"
                                        />
                                    )}
                                </div>

                                <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg">
                                    <p className="text-xs text-indigo-300 font-medium mb-1">Variables Dinámicas Mágicas (Haz clic para copiar):</p>
                                    <div className="flex flex-wrap gap-2">
                                        {getVariablesHint().map(v => (
                                            <code key={v} className="text-xs bg-indigo-900/40 text-indigo-200 px-2 py-1 rounded cursor-pointer hover:bg-indigo-700/50 transition-colors" title="Copiar y pegar en el cuerpo">
                                                {v}
                                            </code>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-2">NOTA: No modifique los corchetes dobles {"{{}}"}.</p>
                                </div>



                            </div>
                        ) : null}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
