import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCaregiverLanguage } from '@/lib/caregiver-language-context';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Bell, Droplets, Activity, Wifi, AlertTriangle, Check, X, Megaphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface UnifiedNotification {
  id: string;
  type: 'clinical' | 'system' | 'announcement';
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'normal';
  timestamp: string;
  status: string;
  patientName?: string | null;
}

export function GlobalNotificationBell() {
  const { user } = useAuth();
  const { t } = useCaregiverLanguage();
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [archivedBroadcasts, setArchivedBroadcasts] = useState<string[]>([]);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const API_BASE = import.meta.env.VITE_API_URL || '';

  // Load archived broadcasts from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('archived_broadcasts');
      if (stored) {
        setArchivedBroadcasts(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/alerts/unified`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setNotifications(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [user, API_BASE]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        isOpen &&
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Filter out notifications archived locally
  const activeNotifications = notifications.filter(n => {
    if (n.type === 'announcement') {
      return !archivedBroadcasts.includes(n.id);
    }
    return n.status !== 'Archived';
  });

  const handleArchive = async (id: string) => {
    if (id.startsWith('announcement_')) {
      const newArchived = [...archivedBroadcasts, id];
      setArchivedBroadcasts(newArchived);
      localStorage.setItem('archived_broadcasts', JSON.stringify(newArchived));
      toast.success(t('Announcement archived', 'Na-archive ang anunsyo'));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/alerts/archive-unified-bulk`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: [id] })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('Alert archived', 'Na-archive ang alert'));
        fetchNotifications();
      } else {
        toast.error(data.message || 'Failed to archive alert');
      }
    } catch {
      toast.error('Failed to archive alert');
    }
  };

  const handleArchiveAll = async () => {
    const idsToArchiveDb: string[] = [];
    const localArchivedBroadcasts = [...archivedBroadcasts];

    activeNotifications.forEach(n => {
      if (n.type === 'announcement') {
        localArchivedBroadcasts.push(n.id);
      } else {
        idsToArchiveDb.push(n.id);
      }
    });

    // Save broadcasts locally
    setArchivedBroadcasts(localArchivedBroadcasts);
    localStorage.setItem('archived_broadcasts', JSON.stringify(localArchivedBroadcasts));

    if (idsToArchiveDb.length === 0) {
      toast.success(t('All notifications cleared', 'Nalinis na ang lahat ng notipikasyon'));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/alerts/archive-unified-bulk`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: idsToArchiveDb })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('All alerts archived', 'Na-archive ang lahat ng alert'));
        fetchNotifications();
      } else {
        toast.error(data.message || 'Failed to archive alerts');
      }
    } catch {
      toast.error('Failed to archive alerts');
    }
  };

  const getIcon = (type: string, severity: string) => {
    switch (type) {
      case 'announcement':
        return <Megaphone className="w-4 h-4 text-blue-500" />;
      case 'system':
        return <Wifi className="w-4 h-4 text-amber-500" />;
      default:
        return severity === 'critical' ? (
          <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
        ) : (
          <Activity className="w-4 h-4 text-teal-600" />
        );
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return t('Just now', 'Ngayon lang');
    if (diffMins < 60) return `${diffMins}m ${t('ago', 'nakalipas')}`;
    if (diffHours < 24) return `${diffHours}h ${t('ago', 'nakalipas')}`;
    return d.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-all focus:outline-none cursor-pointer flex items-center justify-center shadow-sm"
      >
        <Bell className="w-4 h-4 text-slate-600" />
        {activeNotifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-white text-[8px] font-bold bg-rose-500 animate-pulse">
            {activeNotifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-[450px]"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
            <div className="flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold text-slate-700">{t('Notifications', 'Mga Notipikasyon')}</span>
              {activeNotifications.length > 0 && (
                <Badge className="bg-teal-500 hover:bg-teal-600 text-white border-none font-bold text-[8px] px-1 py-0 h-4 min-w-[16px] justify-center">
                  {activeNotifications.length}
                </Badge>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 custom-scrollbar bg-slate-50/10">
            {activeNotifications.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center px-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-xs font-semibold text-slate-500">{t('All caught up! 🎉', 'Lahat ay naproseso na! 🎉')}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{t('No new notifications', 'Walang bagong notipikasyon')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeNotifications.map((notif) => (
                  <div key={notif.id} className="p-3 hover:bg-slate-50/50 transition-colors flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      {getIcon(notif.type, notif.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-800 truncate" title={notif.title}>
                          {notif.title}
                        </span>
                        {notif.severity === 'critical' && (
                          <Badge className="bg-rose-50 text-rose-700 border-none font-bold text-[7px] scale-90 px-1 py-0 h-3.5 shrink-0 uppercase">
                            CRITICAL
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed break-words">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                          {notif.patientName && (
                            <>
                              <span className="font-semibold text-slate-500">{notif.patientName}</span>
                              <span>•</span>
                            </>
                          )}
                          <span>{formatTime(notif.timestamp)}</span>
                        </div>
                        <button
                          onClick={() => handleArchive(notif.id)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                          title={t('Archive notification', 'I-archive ang notipikasyon')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeNotifications.length > 0 && (
            <div className="p-2 border-t border-slate-100 bg-white shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[10px] h-8 font-semibold border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                onClick={handleArchiveAll}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                {t('Archive All', 'I-archive Lahat')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
