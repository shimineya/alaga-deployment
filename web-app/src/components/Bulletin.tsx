import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Megaphone, X, Plus, Calendar, AlertCircle, Info, CheckCircle, Heart, Thermometer, Activity, Clock, Bell, Wrench } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface BulletinPost {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'critical' | 'health_summary' | 'shift_note' | 'maintenance' | 'protocol';
  author: string;
  timestamp: Date;
  expiresAt?: Date;
  category?: 'vital_signs' | 'coordination' | 'medical' | 'system' | 'safety';
}

interface BulletinProps {
  userRole: 'caregiver' | 'medical_staff';
  userName: string;
}

const mockBulletins: BulletinPost[] = [
  {
    id: 'b1',
    title: 'Daily Health Summary - Baby Miguel',
    message: 'Last 24hrs Average: HR 118 bpm, Temp 37.0°C, SpO₂ 98%. Status: Normal. 2 moisture events detected overnight - within expected range.',
    type: 'health_summary',
    author: 'System',
    timestamp: new Date(Date.now() - 3600000),
    category: 'vital_signs',
  },
  {
    id: 'b2',
    title: 'Shift Handover Note - Lola Carmen',
    message: 'Morning shift: Patient was restless around 6 AM. Extra monitoring applied. Vitals stable. Medication administered at 8:00 AM as scheduled.',
    type: 'info',
    author: 'Maria Santos',
    timestamp: new Date(Date.now() - 7200000),
    category: 'coordination',
  },
  {
    id: 'b3',
    title: 'Protocol Update - Temperature Thresholds',
    message: 'Per Dr. Reyes orders: Temperature alert threshold for Lolo Pedro increased to 38.5°C. Updated in system. AI sensitivity set to HIGH due to COPD condition.',
    type: 'protocol',
    author: 'Dr. Jose Reyes',
    timestamp: new Date(Date.now() - 10800000),
    category: 'medical',
  },
  {
    id: 'b4',
    title: 'Medication Reminder - Baby Miguel',
    message: 'Upcoming: Paracetamol 500mg due at 2:00 PM. Check temperature before administration. Stock level: 7 days remaining.',
    type: 'warning',
    author: 'System',
    timestamp: new Date(Date.now() - 14400000),
    category: 'medical',
  },
  {
    id: 'b5',
    title: 'Device Maintenance Alert',
    message: 'ESP32-002 battery at 25%. Please charge device within next 12 hours. Sensor accuracy may decrease below 15% battery.',
    type: 'maintenance',
    author: 'System',
    timestamp: new Date(Date.now() - 18000000),
    category: 'system',
  },
  {
    id: 'b6',
    title: 'Anomaly Recap - Last Night',
    message: '3 bed-wetting events detected for Baby Lucas (11:30 PM, 2:15 AM, 5:45 AM). Pattern flagged as unusual by OC-SVM (confidence 82%). Recommend medical review.',
    type: 'critical',
    author: 'AI System',
    timestamp: new Date(Date.now() - 21600000),
    category: 'vital_signs',
  },
  {
    id: 'b7',
    title: 'Training Tip: Sensor Placement',
    message: 'For optimal moisture detection, ensure smart diaper sensor is centered and making contact with inner lining. Clean contacts weekly with soft cloth.',
    type: 'info',
    author: 'Clinical Coordinator',
    timestamp: new Date(Date.now() - 86400000),
    category: 'system',
  },
  {
    id: 'b8',
    title: 'Task List - Today',
    message: '☐ Change sensor batteries for ESP32-003\n☐ Update baseline vitals for Lola Carmen\n☐ Schedule lab appointment for Mr. Tan (blood work due)',
    type: 'info',
    author: 'Medical Staff',
    timestamp: new Date(Date.now() - 172800000),
    category: 'coordination',
  },
  {
    id: 'b9',
    title: 'Emergency Contact Reminder',
    message: '🚨 Dr. Reyes Emergency: +63-917-555-0123\n🏥 Nearest Hospital: St. Luke\'s Medical Center - 15 min away\n📞 Ambulance: 911',
    type: 'critical',
    author: 'System Administrator',
    timestamp: new Date(Date.now() - 259200000),
    category: 'safety',
  },
  {
    id: 'b10',
    title: 'OC-SVM Training Milestone',
    message: 'System has successfully learned baseline patterns for all 9 patients. Anomaly detection now active with 94% accuracy. Auto-alerts enabled.',
    type: 'success',
    author: 'AI System',
    timestamp: new Date(Date.now() - 345600000),
    category: 'system',
  },
];

export const Bulletin: React.FC<BulletinProps> = ({ userRole, userName }) => {
  const [bulletins, setBulletins] = useState<BulletinPost[]>(mockBulletins);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newPost, setNewPost] = useState({
    title: '',
    message: '',
    type: 'info' as BulletinPost['type'],
    category: 'coordination' as BulletinPost['category'],
  });

  const handleAddPost = () => {
    if (!newPost.title || !newPost.message) {
      toast.error('Please fill in all fields');
      return;
    }

    const post: BulletinPost = {
      id: `b${Date.now()}`,
      title: newPost.title,
      message: newPost.message,
      type: newPost.type,
      category: newPost.category,
      author: userName,
      timestamp: new Date(),
    };

    setBulletins([post, ...bulletins]);
    setNewPost({ title: '', message: '', type: 'info', category: 'coordination' });
    setIsAddingPost(false);
    toast.success('Bulletin posted successfully!');
  };

  const handleDeletePost = (id: string) => {
    setBulletins(bulletins.filter(b => b.id !== id));
    toast.success('Bulletin deleted');
  };

  const getTypeIcon = (type: BulletinPost['type']) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <Bell className="w-5 h-5 text-yellow-600" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'health_summary':
        return <Heart className="w-5 h-5 text-blue-600" />;
      case 'maintenance':
        return <Wrench className="w-5 h-5 text-orange-600" />;
      case 'protocol':
        return <Activity className="w-5 h-5 text-purple-600" />;
      default:
        return <Info className="w-5 h-5" style={{ color: '#7DD3C0' }} />;
    }
  };

  const getTypeColor = (type: BulletinPost['type']) => {
    switch (type) {
      case 'critical':
        return '#FEE2E2';
      case 'warning':
        return '#FEF3C7';
      case 'success':
        return '#D1FAE5';
      case 'health_summary':
        return '#DBEAFE';
      case 'maintenance':
        return '#FED7AA';
      case 'protocol':
        return '#E9D5FF';
      default:
        return '#E8F6F3';
    }
  };

  const getCategoryBadgeColor = (category?: BulletinPost['category']) => {
    switch (category) {
      case 'vital_signs':
        return 'bg-blue-100 text-blue-800';
      case 'coordination':
        return 'bg-purple-100 text-purple-800';
      case 'medical':
        return 'bg-red-100 text-red-800';
      case 'system':
        return 'bg-gray-100 text-gray-800';
      case 'safety':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor(diff / 60000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredBulletins = selectedCategory === 'all' 
    ? bulletins 
    : bulletins.filter(b => b.category === selectedCategory);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#7DD3C0' }}
            >
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Bulletin Board</CardTitle>
              <CardDescription>Health summaries, coordination notes, and system updates</CardDescription>
            </div>
          </div>
          <Button
            onClick={() => setIsAddingPost(!isAddingPost)}
            size="sm"
            style={{ backgroundColor: '#7DD3C0', color: 'white' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedCategory('all')}
            style={selectedCategory === 'all' ? { backgroundColor: '#7DD3C0', color: 'white' } : {}}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === 'vital_signs' ? 'default' : 'outline'}
            onClick={() => setSelectedCategory('vital_signs')}
            className={selectedCategory === 'vital_signs' ? 'bg-blue-600 text-white' : ''}
          >
            <Heart className="w-3 h-3 mr-1" />
            Health
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === 'coordination' ? 'default' : 'outline'}
            onClick={() => setSelectedCategory('coordination')}
            className={selectedCategory === 'coordination' ? 'bg-purple-600 text-white' : ''}
          >
            Coordination
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === 'medical' ? 'default' : 'outline'}
            onClick={() => setSelectedCategory('medical')}
            className={selectedCategory === 'medical' ? 'bg-red-600 text-white' : ''}
          >
            Medical
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === 'system' ? 'default' : 'outline'}
            onClick={() => setSelectedCategory('system')}
            className={selectedCategory === 'system' ? 'bg-gray-600 text-white' : ''}
          >
            <Wrench className="w-3 h-3 mr-1" />
            System
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === 'safety' ? 'default' : 'outline'}
            onClick={() => setSelectedCategory('safety')}
            className={selectedCategory === 'safety' ? 'bg-yellow-600 text-white' : ''}
          >
            Safety
          </Button>
        </div>

        {/* Add New Post Form */}
        {isAddingPost && (
          <div 
            className="p-4 rounded-lg space-y-4"
            style={{ backgroundColor: '#F0FAF9', border: '1px solid #7DD3C0' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium" style={{ color: '#2C3E50' }}>Create New Bulletin Post</h3>
              <button
                onClick={() => setIsAddingPost(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  placeholder="Enter bulletin title..."
                />
              </div>

              <div>
                <Label>Message</Label>
                <textarea
                  value={newPost.message}
                  onChange={(e) => setNewPost({ ...newPost, message: e.target.value })}
                  placeholder="Enter your message..."
                  rows={4}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
                  style={{ 
                    borderColor: '#D1D5DB',
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <select
                    value={newPost.type}
                    onChange={(e) => setNewPost({ ...newPost, type: e.target.value as BulletinPost['type'] })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
                    style={{ borderColor: '#D1D5DB' }}
                  >
                    <option value="info">Information</option>
                    <option value="success">Success / Update</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                    <option value="health_summary">Health Summary</option>
                    <option value="protocol">Protocol Update</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                <div>
                  <Label>Category</Label>
                  <select
                    value={newPost.category}
                    onChange={(e) => setNewPost({ ...newPost, category: e.target.value as BulletinPost['category'] })}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2"
                    style={{ borderColor: '#D1D5DB' }}
                  >
                    <option value="vital_signs">Vital Signs & Health</option>
                    <option value="coordination">Coordination</option>
                    <option value="medical">Medical</option>
                    <option value="system">System</option>
                    <option value="safety">Safety</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleAddPost}
                  style={{ backgroundColor: '#7DD3C0', color: 'white' }}
                >
                  Post Bulletin
                </Button>
                <Button
                  onClick={() => setIsAddingPost(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Bulletin Posts */}
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {filteredBulletins.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No bulletins in this category</p>
            </div>
          ) : (
            filteredBulletins.map((bulletin) => (
              <div
                key={bulletin.id}
                className="p-4 rounded-lg border"
                style={{ 
                  backgroundColor: getTypeColor(bulletin.type),
                  borderColor: bulletin.type === 'critical' ? '#EF4444' : bulletin.type === 'info' ? '#7DD3C0' : 'transparent'
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getTypeIcon(bulletin.type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium" style={{ color: '#2C3E50' }}>
                            {bulletin.title}
                          </h4>
                          {bulletin.category && (
                            <span className={`text-xs px-2 py-0.5 rounded ${getCategoryBadgeColor(bulletin.category)}`}>
                              {bulletin.category.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-line" style={{ color: '#7F8C8D' }}>
                          {bulletin.message}
                        </p>
                      </div>
                      {(userRole === 'medical_staff' || bulletin.author === userName) && (
                        <button
                          onClick={() => handleDeletePost(bulletin.id)}
                          className="text-gray-400 hover:text-red-600 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs" style={{ color: '#7F8C8D' }}>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(bulletin.timestamp)}
                      </span>
                      <span>Posted by {bulletin.author}</span>
                      {bulletin.expiresAt && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                          Expires: {bulletin.expiresAt.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
