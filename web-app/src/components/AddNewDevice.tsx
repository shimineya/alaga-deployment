import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { QrCode, Keyboard, Upload, Smartphone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AddNewDeviceProps {
    onDeviceAdded: () => void;
    onCancel: () => void;
}

export const AddNewDevice: React.FC<AddNewDeviceProps> = ({ onDeviceAdded, onCancel }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("manual");

    // Form State
    const [vitalDeviceNo, setVitalDeviceNo] = useState("");
    const [diaperDeviceNo, setDiaperDeviceNo] = useState("");

    // File Upload Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsLoading(true);
            toast.info("Analyzing QR Code...");

            setTimeout(() => {
                setVitalDeviceNo("ESP32-HR-8821");
                setDiaperDeviceNo("ESP32-DP-9902");
                setIsLoading(false);
                setActiveTab("manual");
                toast.success("QR Code Scanned Successfully!");
            }, 1500);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!vitalDeviceNo.trim() || !diaperDeviceNo.trim()) {
            toast.error("Both Device IDs are required.");
            return;
        }

        if (vitalDeviceNo === diaperDeviceNo) {
            toast.error("Vital Sign and Diaper Device IDs cannot be the same.");
            return;
        }

        setIsLoading(true);

        setTimeout(() => {
            setIsLoading(false);
            toast.success("Devices registered successfully.");
            onDeviceAdded();
        }, 1000);
    };

    return (
        <div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
                    <TabsTrigger value="manual" className="flex items-center gap-2">
                        <Keyboard className="w-4 h-4" /> Manual
                    </TabsTrigger>
                    <TabsTrigger value="qr" className="flex items-center gap-2">
                        <QrCode className="w-4 h-4" /> Scan QR
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="mt-0">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 pb-4">
                            <CardTitle className="text-lg">Device Details</CardTitle>
                            <CardDescription>
                                Enter the unique serial numbers found on the hardware.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-6">

                                <div className="space-y-2">
                                    <Label htmlFor="vital-id" className="flex items-center gap-2 text-slate-700">
                                        <Smartphone className="w-4 h-4 text-rose-500" />
                                        Vital Sign Device No. <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="vital-id"
                                        placeholder="e.g. VS-2024-XXXX"
                                        value={vitalDeviceNo}
                                        onChange={(e) => setVitalDeviceNo(e.target.value)}
                                        className="font-mono text-sm uppercase"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="diaper-id" className="flex items-center gap-2 text-slate-700">
                                        <Smartphone className="w-4 h-4 text-blue-500" />
                                        Smart Diaper Device No. <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="diaper-id"
                                        placeholder="e.g. SD-2024-XXXX"
                                        value={diaperDeviceNo}
                                        onChange={(e) => setDiaperDeviceNo(e.target.value)}
                                        className="font-mono text-sm uppercase"
                                        required
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full border-slate-200"
                                        onClick={onCancel}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="w-full bg-teal-600 hover:bg-teal-700"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                        Register Devices
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="qr" className="mt-0">
                    <Card className="border-slate-200 shadow-sm border-dashed border-2">
                        <CardContent className="pt-12 pb-12 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                                <QrCode className="w-10 h-10 text-slate-400" />
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-slate-800">Upload QR Code</h3>
                                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                                    Take a picture of the QR code sticker on the device packaging.
                                </p>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileUpload}
                            />

                            <Button
                                variant="outline"
                                className="mt-4 border-teal-200 text-teal-700 hover:bg-teal-50"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                            >
                                {isLoading ? "Processing..." : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" /> Select Image
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div >
    );
};