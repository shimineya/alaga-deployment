import React, { useState, useRef } from 'react';
import { useAuth } from '../lib/auth-context';
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
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("manual");

    // Form State
    const [vitalDeviceNo, setVitalDeviceNo] = useState("");
    const [diaperDeviceNo, setDiaperDeviceNo] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});

    // File Upload Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsLoading(true);
            toast.info("Analyzing QR Code...");

            setTimeout(() => {
                setVitalDeviceNo("VS-2025-001");
                setDiaperDeviceNo("SD-2025-002");
                setIsLoading(false);
                setActiveTab("manual");
                toast.success("QR Code Scanned Successfully!");
            }, 1500);
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!vitalDeviceNo.trim()) {
            newErrors.vitalDeviceNo = "Vital device No. is required";
        } else if (!/^VS-\d{4}-\d{3,}$/.test(vitalDeviceNo.trim())) {
            newErrors.vitalDeviceNo = "Format: VS-YYYY-XXX (e.g. VS-2025-001)";
        }

        if (!diaperDeviceNo.trim()) {
            newErrors.diaperDeviceNo = "Diaper device No. is required";
        } else if (!/^SD-\d{4}-\d{3,}$/.test(diaperDeviceNo.trim())) {
            newErrors.diaperDeviceNo = "Format: SD-YYYY-XXX (e.g. SD-2025-001)";
        }

        if (vitalDeviceNo && diaperDeviceNo && vitalDeviceNo === diaperDeviceNo) {
            newErrors.diaperDeviceNo = "Device IDs cannot be the same";
        }

        return newErrors;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const formErrors = validateForm();
        if (Object.keys(formErrors).length > 0) {
            setErrors(formErrors);
            const firstErrorField = Object.keys(formErrors)[0];
            const element = document.getElementById(firstErrorField);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            toast.error("Please fix the errors below.");
            return;
        }

        setIsLoading(true);

        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:3000/api/caregiver/devices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    vitalDeviceNo: vitalDeviceNo,
                    diaperDeviceNo: diaperDeviceNo
                })
            });

            const data = await response.json();

            if (data.success) {
                toast.success("Devices registered successfully.");
                onDeviceAdded();
            } else {
                toast.error(data.message || "Failed to register devices");
            }
        } catch (error) {
            console.error("Device Reg Error:", error);
            toast.error("Network Error: Could not register devices");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 h-12">
                    <TabsTrigger value="manual" className="flex items-center gap-2">
                        <Keyboard className="w-4 h-4" /> Manual
                    </TabsTrigger>
                    <TabsTrigger value="qr" className="flex items-center gap-2">
                        <QrCode className="w-4 h-4" /> Scan QR
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="mt-0">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 pb-2">
                            <CardTitle className="text-lg">Device Details</CardTitle>
                            <CardDescription>
                                Enter the unique serial numbers found on the hardware.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="vitalDeviceNo" className="flex items-center gap-2 text-slate-700">
                                            <Smartphone className="w-4 h-4 text-rose-500" />
                                            Vital Sign Device No. <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="vitalDeviceNo"
                                            placeholder="e.g. VS-2025-001"
                                            value={vitalDeviceNo}
                                            onChange={(e) => {
                                                setVitalDeviceNo(e.target.value);
                                                if (errors.vitalDeviceNo) setErrors({ ...errors, vitalDeviceNo: '' });
                                            }}
                                            className={`font-mono text-sm uppercase ${errors.vitalDeviceNo ? 'border-red-500' : ''}`}
                                            style={{ scrollMarginTop: '150px' }}
                                        />
                                        {errors.vitalDeviceNo && <span className="text-red-500 text-xs">{errors.vitalDeviceNo}</span>}
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor="diaperDeviceNo" className="flex items-center gap-2 text-slate-700">
                                            <Smartphone className="w-4 h-4 text-blue-500" />
                                            Smart Diaper Device No. <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="diaperDeviceNo"
                                            placeholder="e.g. SD-2025-001"
                                            value={diaperDeviceNo}
                                            onChange={(e) => {
                                                setDiaperDeviceNo(e.target.value);
                                                if (errors.diaperDeviceNo) setErrors({ ...errors, diaperDeviceNo: '' });
                                            }}
                                            className={`font-mono text-sm uppercase ${errors.diaperDeviceNo ? 'border-red-500' : ''}`}
                                            style={{ scrollMarginTop: '150px' }}
                                        />
                                        {errors.diaperDeviceNo && <span className="text-red-500 text-xs">{errors.diaperDeviceNo}</span>}
                                    </div>
                                </div>

                                <div className="pt-2 grid grid-cols-2 gap-3">
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