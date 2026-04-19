'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface GroupMember {
  student_id: number;
  student_name: string;
  student_nim: string;
  has_completed: boolean;
  ta_status: string;
}

interface GroupProgress {
  group_id: number;
  group_name: string;
  group_code: string;
  period_name: string;
  total_members: number;
  completed_count: number;
  completion_percentage: number;
  members: GroupMember[];
}

export default function PeerReviewDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupProgress[]>([]);
  const [selectedPeriod] = useState<string>('all');
  const [sendingReminder, setSendingReminder] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = selectedPeriod !== 'all' ? { period_id: selectedPeriod } : {};
      const res = await api.get('/admin/peer-review-dashboard/groups', { params });
      setGroups(res.data);
    } catch {
      toast.error('Failed to load peer review data');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sendReminder = async (groupId: number) => {
    try {
      setSendingReminder(groupId);
      await api.post(`/admin/peer-review-dashboard/send-reminder/${groupId}`);
      toast.success('Reminder sent successfully');
    } catch {
      toast.error('Failed to send reminder');
    } finally {
      setSendingReminder(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'TA_ACTIVE':
        return <Badge className="bg-green-100 text-green-800">TA Active</Badge>;
      case 'TA_DONE':
        return <Badge className="bg-blue-100 text-blue-800">TA Done</Badge>;
      case 'TA_BLOCKED':
      default:
        return <Badge variant="secondary">Blocked</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Peer Review Dashboard</h1>
          <p className="text-muted-foreground">Monitor peer review completion and TA status across groups.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fully Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {groups.filter(g => g.completion_percentage === 100).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {groups.filter(g => g.completion_percentage > 0 && g.completion_percentage < 100).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Not Started</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">
              {groups.filter(g => g.completion_percentage === 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups List */}
      <div className="space-y-4">
        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No groups found with EXPO_DONE status.</p>
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.group_id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{group.group_name}</CardTitle>
                    <CardDescription>
                      {group.group_code} • {group.period_name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={group.completion_percentage === 100 ? 'default' : 'outline'}
                      className={group.completion_percentage === 100 ? 'bg-green-100 text-green-800' : ''}
                    >
                      {group.completed_count}/{group.total_members} Completed
                    </Badge>
                    {group.completion_percentage < 100 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendReminder(group.group_id)}
                        disabled={sendingReminder === group.group_id}
                      >
                        {sendingReminder === group.group_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <Progress value={group.completion_percentage} className="h-2" />
                  <p className="text-sm text-muted-foreground mt-1">
                    {group.completion_percentage}% Complete
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>NIM</TableHead>
                      <TableHead>Peer Review</TableHead>
                      <TableHead>TA Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.members.map((member) => (
                      <TableRow key={member.student_id}>
                        <TableCell className="font-medium">{member.student_name}</TableCell>
                        <TableCell>{member.student_nim}</TableCell>
                        <TableCell>
                          {member.has_completed ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">Completed</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-yellow-600">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-sm">Pending</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(member.ta_status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
