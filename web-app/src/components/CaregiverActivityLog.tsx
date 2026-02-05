import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { History, ShieldAlert, User } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { format } from 'date-fns';

interface ActivityLog {
    log_id: string;
    action: string;
    details: string;
    timestamp: string;
    first_name: string;
    last_name: string;
    email: string;
}

interface CaregiverActivityLogProps {
    patientId: string;
    currentUserAccessLevel: string;
}

export const CaregiverActivityLog: React.FC<CaregiverActivityLogProps> = ({ patientId, currentUserAccessLevel }) => {
    const { token } = useAuth();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const canViewLogs = currentUserAccessLevel === 'Edit' || currentUserAccessLevel === 'Admin';

    useEffect(() => {
        if (!canViewLogs) return;

        const fetchLogs = async () => {
            try {
                const response = await fetch(`http://localhost:3000/api/assignments/caregiver/activity-log/${patientId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await response.json();
                if (data.success) {
                    setLogs(data.data);
                } else {
                    setError(data.message);
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load activity logs.");
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [patientId, token, canViewLogs]);

    if (!canViewLogs) {
        return (
            <Card className="border-slate-200 shadow-sm bg-slate-50">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <ShieldAlert className="w-10 h-10 text-slate-400 mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">Access Restricted</h3>
                    <p className="text-slate-500 max-w-sm">
                        You do not have permission to view the activity log. detailed audit logs are restricted to Admins and Primary Caregivers.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-500" /> Activity Log
                </CardTitle>
                <CardDescription>
                    Recent actions taken by the care team.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                    {loading ? (
                        <p className="text-center text-slate-500 py-4">Loading logs...</p>
                    ) : error ? (
                        <p className="text-center text-red-500 py-4">{error}</p>
                    ) : logs.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">No activity recorded yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {logs.map((log) => (
                                <div key={log.log_id} className="flex gap-4 p-3 rounded-lg border border-slate-100 bg-white items-start">
                                    <div className="mt-1 bg-slate-100 p-2 rounded-full">
                                        <User className="w-4 h-4 text-slate-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-semibold text-slate-900">
                                                {log.first_name} {log.last_name}
                                                <span className="text-slate-400 font-normal ml-2 text-xs">({log.email})</span>
                                            </p>
                                            <span className="text-xs text-slate-400 whitespace-nowrap">
                                                {format(new Date(log.timestamp), 'MMM d, h:mm a')}
                                            </span>
                                        </div>
                                        <p className="text-xs font-medium text-slate-700 mt-1 uppercase tracking-wide">
                                            {log.action.replace('_', ' ')}
                                        </p>
                                        <p className="text-sm text-slate-600 mt-0.5">
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
