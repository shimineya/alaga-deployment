import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Cpu, Upload, CheckCircle, AlertTriangle, FileCheck } from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });

interface FirmwareVersion { key: string; version: string; file: string; checksum: string; uploaded_at: string; }

export default function FirmwareManagement() {
    const [versions, setVersions] = useState<FirmwareVersion[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [versionLabel, setVersionLabel] = useState('');
    const [checksum, setChecksum] = useState('');
    const [uploading, setUploading] = useState(false);

    const fetchVersions = async () => {
        const res = await fetch(`${API}/firmware/versions`, { headers: getAuth() });
        const data = await res.json();
        if (data.success) setVersions(data.data);
    };

    useEffect(() => { fetchVersions(); }, []);

    const handleUpload = async () => {
        if (!selectedFile || !versionLabel || !checksum) {
            return toast.error('File, version label, and SHA-256 checksum are all required.');
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('firmware_file', selectedFile);
        formData.append('version_label', versionLabel);
        formData.append('provided_checksum', checksum.toLowerCase().trim());

        try {
            const res = await fetch(`${API}/firmware/upload`, {
                method: 'POST',
                headers: getAuth(), // No Content-Type — browser sets multipart boundary automatically
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                setSelectedFile(null);
                setVersionLabel('');
                setChecksum('');
                fetchVersions();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error('Upload failed. Check your connection.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-bold text-teal-900 tracking-tight">Firmware Management</h2>
                <p className="text-[10px] font-medium text-slate-500">
                    Upload and verify ESP32 firmware packages. All uploads are validated against a SHA-256 checksum.
                </p>
                {/* Technical Debt notice required for thesis defense Q&A */}
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                        <strong>Technical Debt (Prototype):</strong> This implementation uses SHA-256 checksum verification as a proxy for cryptographic signature verification. In production, firmware packages would be signed with a Hardware Security Module (HSM) private key and verified against a certificate chain, per NIST SP 800-147B.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Upload Panel */}
                <Card className="bg-white border border-slate-200 shadow-sm">
                    <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Upload className="w-4 h-4 text-teal-600" /> Upload New Firmware
                        </CardTitle>
                        <CardDescription className="text-[10px] text-slate-400">
                            Only .bin files are accepted. Obtain the SHA-256 hash from your build toolchain (e.g., ESP-IDF) before uploading.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0 space-y-2">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-0.5">Firmware File (.bin only)</label>
                            <input
                                type="file"
                                accept=".bin"
                                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                className="text-xs text-slate-600 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-100 file:text-slate-600 file:cursor-pointer cursor-pointer w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-0.5">Version Label</label>
                            <Input value={versionLabel} onChange={e => setVersionLabel(e.target.value)} placeholder="e.g. v2.1.0-production" className="bg-white border-slate-300 text-slate-800 h-8 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-0.5">SHA-256 Checksum</label>
                            <p className="text-[10px] text-slate-400 mb-1">The 64-character hexadecimal hash of the .bin file, used to verify the file was not tampered with during transfer. (OWASP A08)</p>
                            <Input value={checksum} onChange={e => setChecksum(e.target.value)} placeholder="64-character hex string" className="bg-white border-slate-300 text-slate-800 h-8 text-sm font-mono" />
                        </div>
                        <Button onClick={handleUpload} disabled={uploading} className="w-full h-8 bg-teal-700 hover:bg-teal-600 text-white text-sm">
                            <FileCheck className="w-4 h-4 mr-2" />
                            {uploading ? 'Uploading & Verifying...' : 'Upload and Verify'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Version History */}
                <Card className="bg-white border border-slate-200 shadow-sm">
                    <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-teal-600" /> Verified Firmware Versions
                        </CardTitle>
                        <CardDescription className="text-[10px] text-slate-400">All listed versions have passed SHA-256 integrity verification.</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        {versions.length === 0
                            ? <p className="text-xs text-slate-400 py-4">No firmware versions uploaded yet.</p>
                            : (
                                <ul className="space-y-2 max-h-72 overflow-y-auto">
                                    {versions.map((ver, i) => (
                                        <li key={i} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 space-y-0.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-slate-800 font-mono">{ver.version}</span>
                                                <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                                    <CheckCircle className="w-3 h-3 mr-1" /> Verified
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-slate-500 break-all">SHA-256: {ver.checksum}</p>
                                            <p className="text-xs text-slate-400">{ver.file} — {new Date(ver.uploaded_at).toLocaleString()}</p>
                                        </li>
                                    ))}
                                </ul>
                            )
                        }
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
