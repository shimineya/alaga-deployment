import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { AlertTriangle, CheckCircle, Bell } from "lucide-react";

export const AlertHistory: React.FC = () => {
    // Mock Data
    const alerts: any[] = []; // [MODIFIED] Removed mock data

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-slate-500" />
                    Recent Alerts
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {alerts.map((alert) => (
                        <div key={alert.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${alert.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                    }`}>
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800 text-sm">{alert.message}</p>
                                    <p className="text-xs text-slate-500">
                                        {alert.timestamp.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <Badge variant={alert.status === 'Resolved' ? 'secondary' : 'outline'} className="text-xs">
                                {alert.status}
                            </Badge>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
