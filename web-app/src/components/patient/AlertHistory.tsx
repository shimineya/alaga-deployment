import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { AlertTriangle, Bell, Archive, Loader2 } from "lucide-react";
import { toast } from 'sonner';

interface AlertHistoryProps {
    patientId: string;
}

export const AlertHistory: React.FC<AlertHistoryProps> = ({ patientId }) => {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isArchiving, setIsArchiving] = useState(false);

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const apiBase = (import.meta as any).env?.VITE_API_URL || '';
            const response = await fetch(`${apiBase}/api/alerts/clinical?patientId=${patientId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                setAlerts(data.data);
            }
        } catch (err) {
            console.error("Failed to fetch alerts:", err);
            toast.error("Could not load alert history");
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(alerts.map(a => a.alert_id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (alertId: number, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, alertId]);
        } else {
            setSelectedIds(prev => prev.filter(id => id !== alertId));
        }
    };

    const handleArchiveSelected = async () => {
        if (selectedIds.length === 0) return;
        setIsArchiving(true);
        try {
            const token = localStorage.getItem('token');
            const apiBase = (import.meta as any).env?.VITE_API_URL || '';
            const response = await fetch(`${apiBase}/api/alerts/clinical/archive-bulk`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ alertIds: selectedIds })
            });
            const data = await response.json();
            if (data.success) {
                toast.success(`${selectedIds.length} alert(s) archived successfully.`);
                setSelectedIds([]);
                fetchAlerts();
            } else {
                toast.error(data.message || 'Failed to archive alerts.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Network error while archiving alerts.');
        } finally {
            setIsArchiving(false);
        }
    };

    const getSeverityStyles = (severity: string) => {
        const lower = (severity || '').toLowerCase();
        if (lower === 'critical') return 'bg-red-50 text-red-700 border-red-200';
        if (lower === 'warning') return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-blue-50 text-blue-700 border-blue-200';
    };

    const formatAlertDate = (sentAt: string) => {
        const date = new Date(sentAt);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatAlertTime = (sentAt: string) => {
        const date = new Date(sentAt);
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    };

    const isAllSelected = alerts.length > 0 && selectedIds.length === alerts.length;

    return (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                    <Bell className="w-4 h-4 text-teal-600 animate-pulse" />
                    Clinical Alerts History
                </CardTitle>
                
                {alerts.length > 0 && (
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-medium">
                            {selectedIds.length} of {alerts.length} selected
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
                        <span className="text-xs font-medium">Loading alerts...</span>
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                        <div className="p-3 bg-slate-100 rounded-full text-slate-400 mb-3">
                            <Bell className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800">No Alerts Recorded</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs">There are no active alerts recorded for this patient.</p>
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
                            <div className="w-24 shrink-0">Date</div>
                            <div className="w-20 shrink-0">Time</div>
                            <div className="w-28 shrink-0">Type of Alert</div>
                            <div className="flex-1">Description</div>
                        </div>

                        {/* Alert Rows */}
                        {alerts.map((alert) => {
                            const isSelected = selectedIds.includes(alert.alert_id);
                            return (
                                <div 
                                    key={alert.alert_id} 
                                    className={`flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50/50 ${
                                        isSelected ? 'bg-teal-50/10' : ''
                                    }`}
                                >
                                    <div className="flex items-center shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={e => handleSelectOne(alert.alert_id, e.target.checked)}
                                            className="w-3.5 h-3.5 accent-teal-600 rounded border-slate-300"
                                        />
                                    </div>
                                    <div className="w-24 shrink-0 text-xs font-medium text-slate-600">
                                        {formatAlertDate(alert.sent_at)}
                                    </div>
                                    <div className="w-20 shrink-0 text-xs text-slate-500">
                                        {formatAlertTime(alert.sent_at)}
                                    </div>
                                    <div className="w-28 shrink-0">
                                        <Badge 
                                            variant="outline" 
                                            className={`text-[10px] px-1.5 py-0.5 font-semibold capitalize border ${getSeverityStyles(alert.severity)}`}
                                        >
                                            {alert.alert_category || alert.anomaly_type || 'Clinical'}
                                        </Badge>
                                    </div>
                                    <div className="flex-1 flex items-start gap-2 text-xs font-medium text-slate-700 leading-normal">
                                        {alert.severity?.toLowerCase() === 'critical' && (
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                        )}
                                        {alert.message}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
