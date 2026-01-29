import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Wifi, WifiOff, Plus, Ban, CheckCircle, RefreshCcw } from "lucide-react";

interface Device {
  mac_address: string;
  device_name: string;
  firmware_version: string;
  status: 'ACTIVE' | 'REVOKED' | 'MAINTENANCE';
  last_heartbeat: string;
  added_by_name: string;
}

export default function DeviceGovernance() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [mac, setMac] = useState("");
  const [name, setName] = useState("");

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/admin/devices', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setDevices(data.data);
    } catch (err) {
      toast.error("Failed to load device fleet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/admin/whitelist-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ mac_address: mac, device_name: name })
        });
        
        const data = await res.json();
        if (data.success) {
            toast.success("Device Authorized");
            setMac(""); setName("");
            fetchDevices(); // Refresh list
        } else {
            toast.error(data.message);
        }
    } catch (err) {
        toast.error("Connection Error");
    }
  };

  const toggleStatus = async (mac: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'REVOKED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to set this device to ${newStatus}?`)) return;

    try {
        const token = localStorage.getItem('token');
        await fetch(`http://localhost:3000/api/admin/devices/${mac}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: newStatus })
        });
        toast.success(`Device ${newStatus}`);
        fetchDevices();
    } catch (err) {
        toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Device Governance</h2>
                <p className="text-muted-foreground">Manage authorized IoT sensors (ESP32 Fleet).</p>
            </div>
            <Button variant="outline" onClick={fetchDevices}>
                <RefreshCcw className="w-4 h-4 mr-2" /> Refresh
            </Button>
       </div>
       
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* --- LEFT: DEVICE LIST (Takes up 2/3 space) --- */}
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Authorized Fleet</CardTitle>
                    <CardDescription>All sensors permitted to transmit patient data.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Device Info</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Seen</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {devices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No devices found. Add one to start monitoring.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                devices.map((device) => (
                                    <TableRow key={device.mac_address}>
                                        <TableCell>
                                            <div className="font-medium">{device.device_name}</div>
                                            <div className="text-xs font-mono text-muted-foreground">{device.mac_address}</div>
                                        </TableCell>
                                        <TableCell>
                                            {device.status === 'ACTIVE' ? (
                                                <Badge className="bg-emerald-500 hover:bg-emerald-600">Active</Badge>
                                            ) : (
                                                <Badge variant="destructive">Revoked</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {device.last_heartbeat ? new Date(device.last_heartbeat).toLocaleString() : 'Never'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className={device.status === 'ACTIVE' ? "text-red-500 hover:text-red-700" : "text-emerald-500 hover:text-emerald-700"}
                                                onClick={() => toggleStatus(device.mac_address, device.status)}
                                            >
                                                {device.status === 'ACTIVE' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* --- RIGHT: ADD DEVICE FORM (Takes up 1/3 space) --- */}
            <Card className="h-fit">
                <CardHeader>
                    <CardTitle>Whitelist Sensor</CardTitle>
                    <CardDescription>Register a new ESP32 unit.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleWhitelist} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">MAC Address</label>
                            <Input 
                                placeholder="24:6F:28:..." 
                                value={mac} 
                                onChange={(e) => setMac(e.target.value)} 
                                required 
                                className="font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Device Label</label>
                            <Input 
                                placeholder="e.g. Room 301 - Crib A" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                                required 
                            />
                        </div>
                        <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700">
                            <Plus className="w-4 h-4 mr-2" /> Authorize Device
                        </Button>
                    </form>
                </CardContent>
            </Card>
       </div>
    </div>
  );
}