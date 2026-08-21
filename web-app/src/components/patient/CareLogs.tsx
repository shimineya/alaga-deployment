import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { FileText, Send, Archive, Loader2 } from "lucide-react";
import { toast } from 'sonner';

interface CareLogsProps {
    patientId: string;
}

export const CareLogs: React.FC<CareLogsProps> = ({ patientId }) => {
    const [note, setNote] = useState('');
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const apiBase = (import.meta as any).env?.VITE_API_URL || '';
            const response = await fetch(`${apiBase}/api/caregiver/patients/${patientId}/care-logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setLogs(data.data);
            }
        } catch (err) {
            console.error("Failed to fetch care logs:", err);
            toast.error("Could not load care logs history");
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleAddNote = async () => {
        if (!note.trim()) return;
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const apiBase = (import.meta as any).env?.VITE_API_URL || '';
            const response = await fetch(`${apiBase}/api/caregiver/patients/${patientId}/care-logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content: note })
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Care note added successfully.');
                setNote('');
                fetchLogs();
            } else {
                toast.error(data.message || 'Failed to add care note.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error while adding care note.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(logs.map(l => l.log_id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (logId: number, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, logId]);
        } else {
            setSelectedIds(prev => prev.filter(id => id !== logId));
        }
    };

    const handleArchiveSelected = async () => {
        if (selectedIds.length === 0) return;
        setIsArchiving(true);
        try {
            const token = localStorage.getItem('token');
            const apiBase = (import.meta as any).env?.VITE_API_URL || '';
            const response = await fetch(`${apiBase}/api/caregiver/patients/${patientId}/care-logs/archive-bulk`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ logIds: selectedIds })
            });
            const data = await response.json();
            if (data.success) {
                toast.success(`${selectedIds.length} care log(s) archived successfully.`);
                setSelectedIds([]);
                fetchLogs();
            } else {
                toast.error(data.message || 'Failed to archive care logs.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Network error while archiving care logs.');
        } finally {
            setIsArchiving(false);
        }
    };

    const formatLogDate = (createdAt: string) => {
        const date = new Date(createdAt);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatLogTime = (createdAt: string) => {
        const date = new Date(createdAt);
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    };

    const isAllSelected = logs.length > 0 && selectedIds.length === logs.length;

    return (
        <div className="space-y-6">
            {/* Add Care Note Card */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                        <FileText className="w-4 h-4 text-teal-600" />
                        Add Care Log or Observation
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                        placeholder="Add a care note, daily observation, behavior update, or intervention..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="min-h-[100px] text-sm resize-none"
                    />
                    <div className="flex justify-end">
                        <Button 
                            size="sm" 
                            onClick={handleAddNote} 
                            disabled={!note.trim() || isSaving}
                            className="bg-teal-600 hover:bg-teal-700 text-white font-medium gap-1.5 h-8 text-xs cursor-pointer"
                        >
                            {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Send className="w-3.5 h-3.5" />
                            )}
                            Add Log Entry
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Care Logs List Card */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                        <FileText className="w-4 h-4 text-teal-600" />
                        Care Logs History
                    </CardTitle>
                    
                    {logs.length > 0 && (
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 font-medium">
                                {selectedIds.length} of {logs.length} selected
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={selectedIds.length === 0 || isArchiving}
                                onClick={handleArchiveSelected}
                                className="h-8 text-xs gap-1.5 border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-slate-600 disabled:opacity-50"
                            >
                                {isArchiving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Archive className="w-3.5 h-3.5 text-teal-600" />
                                )}
                                Archive Selected
                            </Button>
                        </div>
                    )}
                </CardHeader>
                
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                            <span className="text-xs font-medium">Loading logs...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                            <div className="p-3 bg-slate-100 rounded-full text-slate-400 mb-3">
                                <FileText className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-semibold text-slate-800">No Care Logs</h3>
                            <p className="text-xs text-slate-500 mt-1 max-w-xs">No care logs or observation entries have been registered for this patient yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {/* Table Header Row */}
                            <div className="flex items-center gap-4 px-6 py-2.5 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                <div className="flex items-center shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={e => handleSelectAll(e.target.checked)}
                                        className="w-3.5 h-3.5 accent-teal-600 rounded border-slate-300"
                                    />
                                </div>
                                <div className="w-24 shrink-0 font-bold">Date</div>
                                <div className="w-20 shrink-0 font-bold">Time</div>
                                <div className="w-28 shrink-0 font-bold">Logged By</div>
                                <div className="flex-1 font-bold">Log Content</div>
                            </div>

                            {/* Log Rows */}
                            {logs.map((log) => {
                                const isSelected = selectedIds.includes(log.log_id);
                                return (
                                    <div 
                                        key={log.log_id} 
                                        className={`flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50/50 ${
                                            isSelected ? 'bg-teal-50/10' : ''
                                        }`}
                                    >
                                        <div className="flex items-center shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={e => handleSelectOne(log.log_id, e.target.checked)}
                                                className="w-3.5 h-3.5 accent-teal-600 rounded border-slate-300"
                                            />
                                        </div>
                                        <div className="w-24 shrink-0 text-xs font-medium text-slate-600">
                                            {formatLogDate(log.created_at)}
                                        </div>
                                        <div className="w-20 shrink-0 text-xs text-slate-500">
                                            {formatLogTime(log.created_at)}
                                        </div>
                                        <div className="w-28 shrink-0 flex items-center gap-2">
                                            <Avatar className="w-5 h-5 shrink-0">
                                                <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-bold">
                                                    {(log.author_name || 'U')[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-semibold text-slate-700 truncate max-w-[90px]">
                                                {log.author_name}
                                            </span>
                                        </div>
                                        <div className="flex-1 text-xs text-slate-600 leading-normal whitespace-pre-wrap">
                                            {log.content}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
