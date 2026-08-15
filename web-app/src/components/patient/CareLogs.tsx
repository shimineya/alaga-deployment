import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { FileText, Send, User } from "lucide-react";

export const CareLogs: React.FC = () => {
    const [note, setNote] = useState('');
    const [logs, setLogs] = useState<{ id: number; author: string; content: string; timestamp: Date }[]>([]); // [MODIFIED] Removed mock data

    const handleAddNote = () => {
        if (!note.trim()) return;
        const newLog = {
            id: Date.now(),
            author: 'You', // In real app, use auth context
            content: note,
            timestamp: new Date()
        };
        setLogs([newLog, ...logs]);
        setNote('');
    };

    return (
        <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-slate-500" />
                        Care Notes & Logs
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Textarea
                            placeholder="Add a care note, observation, or intervention..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="min-h-[100px]"
                        />
                        <div className="flex justify-end">
                            <Button size="sm" onClick={handleAddNote} disabled={!note.trim()}>
                                <Send className="w-4 h-4 mr-2" />
                                Add Note
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                {logs.map((log) => (
                    <Card key={log.id} className="bg-slate-50/50">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                                <Avatar className="w-8 h-8">
                                    <AvatarFallback className="bg-slate-200 text-slate-600">
                                        {log.author[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold text-sm text-slate-800">{log.author}</h4>
                                        <span className="text-xs text-slate-400">
                                            {log.timestamp.toLocaleDateString()} {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                                        {log.content}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
