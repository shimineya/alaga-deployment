import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
    RefreshCw,
    AlertCircle,
    Download,
    Server,
    ShieldCheck,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

export const FirmwareOTA: React.FC = () => {
    const [isChecking, setIsChecking] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [progress, setProgress] = useState(0);

    const checkUpdates = () => {
        setIsChecking(true);
        // Simulate API call
        setTimeout(() => {
            setIsChecking(false);
            setUpdateAvailable(true);
            toast.info('New firmware version v1.2.0 is available.');
        }, 2000);
    };

    const startUpdate = () => {
        setIsUpdating(true);
        setProgress(0);

        // Simulate Update Process
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setIsUpdating(false);
                    setUpdateAvailable(false);
                    toast.success('Firmware updated successfully to v1.2.0');
                    return 100;
                }
                return prev + 5;
            });
        }, 300);
    };

    return (
        <div className="space-y-6 max-w-[1000px] mx-auto p-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Firmware Management (OTA)</h2>
                <p className="text-slate-500 text-sm">Manage device firmware versions and security patches over-the-air.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Update Card */}
                <Card className="md:col-span-2 shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Server className="w-5 h-5 text-teal-600" />
                            Current Firmware Status
                        </CardTitle>
                        <CardDescription>
                            Device Fleet Version: <strong>v1.1.2</strong> (Stable)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Alert className="bg-blue-50 border-blue-200">
                            <ShieldCheck className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800 font-semibold">Security Compliance</AlertTitle>
                            <AlertDescription className="text-blue-700 text-xs">
                                All firmware updates are cryptographically signed and verified before installation
                                to prevent tampering. (OWASP A08: Software and Data Integrity Failures)
                            </AlertDescription>
                        </Alert>

                        {updateAvailable ? (
                            <div className="space-y-4 rounded-lg border border-slate-200 p-4 bg-slate-50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-slate-800">New Version Available: v1.2.0</h4>
                                        <p className="text-xs text-slate-500">Includes security patches for BLE stack and improved battery management.</p>
                                    </div>
                                    <Badge className="bg-emerald-500 text-white">Recommended</Badge>
                                </div>

                                {isUpdating ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium text-slate-700">
                                            <span>Downloading & Installing...</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <Progress value={progress} className="h-2 bg-slate-200" />
                                        <p className="text-[10px] text-slate-500 italic">Do not turn off devices during this process.</p>
                                    </div>
                                ) : (
                                    <Button onClick={startUpdate} className="w-full bg-slate-800 hover:bg-slate-700 text-white">
                                        <Download className="w-4 h-4 mr-2" />
                                        Install Update Now
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                                <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-slate-800">Your fleet is up to date</p>
                                    <p className="text-xs text-slate-500">Last checked: Just now</p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={checkUpdates}
                                    disabled={isChecking}
                                    className="mt-2"
                                >
                                    {isChecking ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                    Check for Updates
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Sidebar Info */}
                <div className="space-y-4">
                    <Card className="shadow-sm border-slate-200 bg-amber-50/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                                <AlertCircle className="w-4 h-4" /> Important
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-amber-900 leading-relaxed">
                            Ensure all devices have at least <strong>50% battery</strong> before initiating an OTA update.
                            Failed updates due to power loss may require manual flashing.
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">Release Notes (v1.2.0)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="text-xs space-y-2 list-disc pl-4 text-slate-600">
                                <li>Fixed memory leak in WiFi stack.</li>
                                <li>Optimized deep sleep intervals.</li>
                                <li>Added support for new sensor revision.</li>
                                <li>Updated SSL certificates.</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
