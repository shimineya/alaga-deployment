import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Megaphone, X, Plus, Calendar, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface BulletinPost {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'critical';
  author: string;
  timestamp: Date;
  expiresAt?: Date;
}

interface BulletinProps {
  userRole: 'caregiver' | 'medical_staff';
  userName: string;
}

const mockBulletins: BulletinPost[] = [
  {
    id: 'b1',
    title: 'System Maintenance Scheduled',
    message: 'The Alaga system will undergo routine maintenance on December 25, 2025 from 2:00 AM to 4:00 AM. Monitoring will continue, but dashboard access may be limited.',
    type: 'info',
    author: 'System Administrator',
    timestamp: new Date(Date.now() - 86400000),
    expiresAt: new Date('2025-12-25'),
  },
  {
    id: 'b2',
    title: 'New Features: Doctor\'s Orders Module',
    message: 'We\'ve added comprehensive Doctor\'s Orders with calendar scheduling! Now medical staff can set medication timetables, turning schedules, and lab appointments directly in the patient profile.',
    type: 'success',
    author: 'Dr. Jose Reyes',
    timestamp: new Date(Date.now() - 172800000),
  },
  {
    id: 'b3',
    title: 'Reminder: Update Patient Baseline Vitals',
    message: 'Please ensure all patient baseline vitals are up-to-date for accurate anomaly detection. The One-Class SVM algorithm relies on current baseline data for optimal performance.',
    type: 'warning',
    author: 'Clinical Coordinator',
    timestamp: new Date(Date.now() - 259200000),
  },
  {
    id: 'b4',
    title: 'Holiday Staffing Schedule',
    message: 'Please review the holiday staffing schedule in the Events Calendar. If you need to adjust your shifts, contact your supervisor by December 22nd.',
    type: 'info',
    author: 'HR Department',
    timestamp: new Date(Date.now() - 345600000),
  },
];

export const Bulletin: React.FC<BulletinProps> = ({ userRole, userName }) => {
  const [bulletins, setBulletins] = useState<BulletinPost[]>(mockBulletins);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    message: '',
    type: 'info' as BulletinPost['type'],
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
      author: userName,
      timestamp: new Date(),
    };

    setBulletins([post, ...bulletins]);
    setNewPost({ title: '', message: '', type: 'info' });
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
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
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
      default:
        return '#E8F6F3';
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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
              <CardDescription>System announcements and updates</CardDescription>
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
                    focusRing: '#7DD3C0'
                  }}
                />
              </div>

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
                </select>
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
          {bulletins.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No bulletins posted yet</p>
            </div>
          ) : (
            bulletins.map((bulletin) => (
              <div
                key={bulletin.id}
                className="p-4 rounded-lg border"
                style={{ 
                  backgroundColor: getTypeColor(bulletin.type),
                  borderColor: bulletin.type === 'info' ? '#7DD3C0' : 'transparent'
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getTypeIcon(bulletin.type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium mb-1" style={{ color: '#2C3E50' }}>
                          {bulletin.title}
                        </h4>
                        <p className="text-sm" style={{ color: '#7F8C8D' }}>
                          {bulletin.message}
                        </p>
                      </div>
                      {userRole === 'medical_staff' && (
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
                        <Calendar className="w-3 h-3" />
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
