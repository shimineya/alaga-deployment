import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Badge } from "../ui/badge";
import { Droplets, Clock, CheckCircle } from "lucide-react";

export const SmartDiaperEvents: React.FC = () => {
    // Mock Data
    const events: any[] = []; // [MODIFIED] Removed mock data. Waiting for API implementation.

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Droplets className="w-5 h-5 text-teal-500" />
                    Smart Diaper Events
                </CardTitle>
                <CardDescription>Recent wetness detections and diaper changes</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pl-6 pb-2">
                    {events.map((event) => (
                        <div key={event.id} className="relative">
                            {/* Dot */}
                            <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${event.type === 'wetness' ? 'bg-blue-400' : 'bg-emerald-400'
                                }`} />

                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                <div>
                                    <p className="font-semibold text-slate-800">
                                        {event.type === 'wetness' ? 'Wetness Detected' : 'Diaper Changed'}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        {event.type === 'wetness' ? `Moisture Level: ${event.level}` : `Changed by: ${event.by}`}
                                    </p>
                                </div>
                                <div className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    <span className="mx-1">•</span>
                                    {event.timestamp.toLocaleDateString()}
                                </div>
                            </div>
                            {event.status === 'Pending' && (
                                <Badge variant="outline" className="mt-2 text-amber-600 border-amber-200 bg-amber-50">
                                    Change Required
                                </Badge>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
