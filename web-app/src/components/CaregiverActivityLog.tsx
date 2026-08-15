import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { History, ShieldAlert, User, LogIn, Settings, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface LogEntry {
    id: number;
    action: string;
    details: string;
    timestamp: string;
    type: 'info' | 'warning' | 'security';
}

export const CaregiverActivityLog: React.FC<{ userId: number }> = ({ userId }) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        // Simulate API Fetch
        setTimeout(() => {
            setLogs([
                { id: 1, action: "Viewed Vitals", details: "Checked Baby Althea's oxygen levels", timestamp: new Date().toISOString(), type: 'info' },
                { id: 2, action: "Updated Profile", details: "Changed contact number", timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'security' },
                { id: 3, action: "Login", details: "Successful login from IP 192.168.1.5", timestamp: new Date(Date.now() - 7200000).toISOString(), type: 'info' },
                { id: 4, action: "Dismissed Alert", details: "Acknowledged High Temp Alert for Patient #102", timestamp: new Date(Date.now() - 86400000).toISOString(), type: 'warning' },
            ]);
            setLoading(false);
        }, 500);
    }, [userId]);

    const getIcon = (action: string) => {
        if (action.includes("Login")) return <LogIn className="w-4 h-4 text-blue-500" />;
        if (action.includes("Alert")) return <ShieldAlert className="w-4 h-4 text-amber-500" />;
        if (action.includes("Update") || action.includes("Settings")) return <Settings className="w-4 h-4 text-slate-500" />;
        return <FileText className="w-4 h-4 text-emerald-500" />;
    };

    return (
        <Card className="h-full border-0 shadow-none rounded-none flex flex-col">
            <CardHeader className="px-0 pt-6 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-600" />
                    Recent Activity
                </CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-2 flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                    {loading ? (
                        <div className="text-center py-8 text-xs text-slate-400">Loading history...</div>
                    ) : (
                        <div className="relative border-l border-slate-200 ml-2 space-y-6 my-2">
                            {logs.map((log) => (
                                <div key={log.id} className="ml-6 relative">
                                    <span className="absolute -left-[31px] top-1 bg-white border border-slate-200 rounded-full p-1">
                                        {getIcon(log.action)}
                                    </span>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-medium text-slate-800">{log.action}</p>
                                            <span className="text-[10px] text-slate-400">
                                                {format(new Date(log.timestamp), 'MMM d, h:mm a')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-snug">
                                            {log.details}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
};