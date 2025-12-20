import React, { useState, useRef, useEffect } from 'react';
import { Alert } from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Bell, Droplets, Activity, Wifi, AlertTriangle, Check, X, ChevronDown } from 'lucide-react';

interface NotificationPanelProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
  onMarkAllRead: () => void;
  patientNames?: Record<string, string>; // Map of patientId to patient name
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  alerts, 
  onAcknowledge, 
  onMarkAllRead,
  patientNames = {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showMoreIndicator, setShowMoreIndicator] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  const notificationCount = unacknowledgedAlerts.length;

  // Calculate dynamic height based on notification count
  const getMaxHeight = () => {
    const viewportHeight = window.innerHeight;
    const maxViewportHeight = viewportHeight - 100;
    
    if (notificationCount === 0) return 'auto';
    if (notificationCount <= 3) return 'auto'; // Fit content exactly
    if (notificationCount <= 6) return 'auto'; // Show all with spacing
    return `${Math.min(500, maxViewportHeight)}px`; // Max 500px or viewport-100px
  };

  // Handle scroll to show/hide more indicator
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtTop = target.scrollTop < 10;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 10;
    
    setIsScrolled(!isAtTop);
    setShowMoreIndicator(!isAtBottom && notificationCount > 6);
    
    // Calculate how many notifications are hidden below
    if (!isAtBottom && notificationCount > 6) {
      const scrollPercentage = (target.scrollTop / (target.scrollHeight - target.clientHeight));
      const estimatedHidden = Math.floor((1 - scrollPercentage) * notificationCount);
      setHiddenCount(estimatedHidden);
    } else {
      setHiddenCount(0);
    }
  };

  // Update scroll state when opening
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      const element = scrollRef.current;
      const hasScroll = element.scrollHeight > element.clientHeight;
      setShowMoreIndicator(hasScroll && notificationCount > 6);
      if (hasScroll) {
        const scrollPercentage = element.scrollTop / (element.scrollHeight - element.clientHeight);
        const estimatedHidden = Math.floor((1 - scrollPercentage) * notificationCount);
        setHiddenCount(estimatedHidden > 0 ? estimatedHidden : Math.floor(notificationCount * 0.3));
      }
    }
  }, [isOpen, notificationCount]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'bedwetting':
        return <Droplets className="w-4 h-4" />;
      case 'vital_signs':
        return <Activity className="w-4 h-4" />;
      case 'device':
        return <Wifi className="w-4 h-4" />;
      case 'anomaly':
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'rgba(217, 83, 79, 0.1)',
          border: 'var(--status-critical)',
          text: 'var(--status-critical)',
        };
      case 'warning':
        return {
          bg: 'rgba(240, 173, 78, 0.1)',
          border: 'var(--status-warning)',
          text: 'var(--status-warning)',
        };
      case 'normal':
        return {
          bg: 'rgba(77, 184, 179, 0.1)',
          border: 'var(--status-normal)',
          text: 'var(--status-normal)',
        };
    }
  };

  const getSeverityBadge = (severity: Alert['severity']) => {
    const colors = {
      critical: 'bg-[var(--status-critical)] text-white',
      warning: 'bg-[var(--status-warning)] text-white',
      normal: 'bg-[var(--status-normal)] text-white',
    };
    
    return (
      <Badge className={`${colors[severity]} text-xs`}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  const handleMarkAllRead = () => {
    onMarkAllRead();
    setIsOpen(false);
  };

  const handleAcknowledge = (alertId: string) => {
    onAcknowledge(alertId);
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unacknowledgedAlerts.length > 0 && (
          <div
            className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-white text-xs"
            style={{ backgroundColor: 'var(--status-critical)' }}
          >
            {unacknowledgedAlerts.length}
          </div>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-96 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden transition-all duration-300 ease-out"
          style={{
            maxHeight: getMaxHeight(),
            boxShadow: '0 10px 40px rgba(77, 184, 179, 0.15)',
            animation: 'slideDown 200ms ease-out',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 z-10 bg-card" style={{ backgroundColor: 'var(--teal-50)' }}>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" style={{ color: 'var(--teal-700)' }} />
              <h3 className="text-sm">Notifications</h3>
              {notificationCount > 0 && (
                <Badge className="bg-[var(--teal-600)] text-white text-xs">
                  {notificationCount}
                </Badge>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Notifications List */}
          {unacknowledgedAlerts.length === 0 ? (
            <div className="px-4 py-8 text-center" style={{ backgroundColor: 'var(--teal-50)' }}>
              <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--teal-100)' }}>
                <Bell className="w-8 h-8" style={{ color: 'var(--teal-600)' }} />
              </div>
              <p className="text-sm mb-1">All caught up! 🎉</p>
              <p className="text-xs text-muted-foreground">No new notifications</p>
            </div>
          ) : (
            <>
              <div className="relative">
                {/* Scrollable container */}
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="overflow-y-auto custom-scrollbar"
                  style={{
                    maxHeight: notificationCount > 6 ? '400px' : 'auto',
                    scrollBehavior: 'smooth',
                  }}
                >
                  <div className="p-3 space-y-3">
                    {unacknowledgedAlerts.map((alert, index) => {
                      const severityColors = getSeverityColor(alert.severity);
                      const patientName = patientNames[alert.patientId];

                      return (
                        <div
                          key={alert.id}
                          className="p-3 rounded-lg border transition-all hover:shadow-md"
                          style={{
                            backgroundColor: severityColors.bg,
                            borderColor: severityColors.border,
                            animation: `slideInNotification 300ms ease-out ${index * 50}ms both`,
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="p-2 rounded-lg"
                              style={{ 
                                backgroundColor: 'var(--card)',
                                color: severityColors.text 
                              }}
                            >
                              {getAlertIcon(alert.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="text-sm line-clamp-1">{alert.title}</h4>
                                {getSeverityBadge(alert.severity)}
                              </div>

                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                {alert.message}
                              </p>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {patientName && (
                                    <>
                                      <span>{patientName}</span>
                                      <span>•</span>
                                    </>
                                  )}
                                  <span>{formatTimestamp(alert.timestamp)}</span>
                                </div>

                                <button
                                  onClick={() => handleAcknowledge(alert.id)}
                                  className="p-1 rounded hover:bg-card transition-colors"
                                  title="Acknowledge"
                                >
                                  <Check className="w-4 h-4" style={{ color: 'var(--teal-600)' }} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom fade gradient */}
                {showMoreIndicator && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
                    style={{
                      background: 'linear-gradient(to bottom, transparent, var(--card))',
                    }}
                  />
                )}
              </div>

              {/* More notifications indicator */}
              {showMoreIndicator && hiddenCount > 0 && (
                <div className="px-4 py-2 text-center border-t border-border bg-muted/50">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <ChevronDown className="w-3 h-3 animate-bounce" />
                    <span>{hiddenCount} more notification{hiddenCount !== 1 ? 's' : ''} below</span>
                  </div>
                </div>
              )}

              {/* Footer - Sticky at bottom */}
              <div 
                className="px-4 py-3 border-t bg-card sticky bottom-0 z-10"
                style={{
                  boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)',
                }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleMarkAllRead}
                  style={{ 
                    borderColor: 'var(--teal-300)',
                    color: 'var(--teal-700)',
                  }}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark all as read
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInNotification {
          from {
            opacity: 0;
            transform: translateX(10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(77, 184, 179, 0.3) transparent;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: transparent;
          border-radius: 3px;
          transition: background-color 200ms;
        }

        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(77, 184, 179, 0.3);
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(77, 184, 179, 0.5);
        }
      `}</style>
    </div>
  );
};