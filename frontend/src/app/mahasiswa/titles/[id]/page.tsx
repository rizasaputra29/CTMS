'use client';

import axios from 'axios';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  ArrowLeft, BookOpen, Target, Layers, Info, Users, AlertTriangle, Lock, CheckCircle 
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loading } from '@/components/ui/loading';

interface TitleDetail {
  id: number;
  title: string;
  description: string;
  problem_statement: string | null;
  scope: string | null;
  specializations: string[] | null;
  quota: number;
  status: string;
  lecturer?: { id: number; name: string; email: string };
  groups?: { id: number; status: string; members: { id: number; student_id: number; is_leader: boolean; student: { id: number; name: string; email: string } }[] }[];
}

interface Group {
  id: number;
  title_id: number | null;
  status: string;
  members: { id: number; student_id: number; is_leader: boolean }[];
}

export default function MahasiswaTitleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [title, setTitle] = useState<TitleDetail | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [titleRes, groupRes] = await Promise.all([
          api.get(`/mahasiswa/titles/${params.id}`),
          api.get('/mahasiswa/group'),
        ]);
        setTitle(titleRes.data);
        setGroup(groupRes.data?.group || groupRes.data);
      } catch (error) {
        toast.error('Failed to load title details');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  const hasGroup = !!group;
  const canBid = hasGroup && !group?.title_id && group?.status === 'READY_FOR_BIDDING' && title?.status === 'open';

  const handleBid = async () => {
    if (!title || !canBid) return;
    if (!title.lecturer?.id) {
      toast.error('Data dosen pembimbing untuk judul ini tidak tersedia.');
      return;
    }

    setBidding(true);
    try {
      await api.post('/mahasiswa/bids', {
        title_id: title.id,
        priority: 1,
        proposed_supervisor_1_id: title.lecturer.id,
        proposed_supervisor_2_id: null,
      });
      toast.success('Bid submitted successfully!');
      router.push('/mahasiswa/group');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Failed to bid');
      } else {
        toast.error('Failed to submit bid');
      }
    } finally {
      setBidding(false);
    }
  };

  if (loading) return <Loading variant="section" />;

  if (!title) {
    return (
      <div className="max-w-5xl mx-auto">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Info className="h-10 w-10 text-muted-foreground mb-4" />
            <CardTitle className="text-base mb-2">Title Not Found</CardTitle>
            <CardDescription className="mb-6">The title you are looking for does not exist or has been removed.</CardDescription>
            <Button variant="outline" onClick={() => router.push('/mahasiswa/titles')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Titles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeGroups = title.groups?.filter(g => g.status !== 'REJECTED') || [];
  const isFull = activeGroups.length >= title.quota;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/mahasiswa/titles')}
          className="shrink-0 mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{title.title}</h1>
          <p className="text-muted-foreground">
            By {title.lecturer?.name || 'Unknown Lecturer'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Badge 
            variant={title.status === 'open' ? 'default' : 'secondary'}
            className={title.status === 'open' ? 'bg-success-100 text-success-500 hover:bg-success-100' : 'bg-error-100 text-error-500 hover:bg-error-100'}
          >
            {title.status === 'open' ? 'Open' : 'Closed'}
          </Badge>
          {canBid && (
            <Button onClick={handleBid} disabled={bidding} size="sm">
              {bidding && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              Bid for This Title
            </Button>
          )}
        </div>
      </div>

      {/* Status Alerts */}
      {isFull && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Quota Full</AlertTitle>
          <AlertDescription>
            This title has reached its maximum quota of {title.quota} groups. No new bids can be accepted.
          </AlertDescription>
        </Alert>
      )}
      {title.status === 'closed' && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Title Closed</AlertTitle>
          <AlertDescription>
            This title is currently closed for bidding. Please check back later or explore other titles.
          </AlertDescription>
        </Alert>
      )}
      {!hasGroup && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No Group</AlertTitle>
          <AlertDescription>
            You need to join or create a group first before you can bid on this title.
          </AlertDescription>
        </Alert>
      )}
      {hasGroup && group?.title_id && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Title Already Assigned</AlertTitle>
          <AlertDescription>
            Your group already has an assigned title. You cannot bid on additional titles.
          </AlertDescription>
        </Alert>
      )}
      {hasGroup && !group?.title_id && group?.status !== 'READY_FOR_BIDDING' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Group Not Ready</AlertTitle>
          <AlertDescription>
            Your group is not ready for bidding. Mark your group as "Ready for Bidding" to place bids.
          </AlertDescription>
        </Alert>
      )}

      {/* Card Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Description */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Description</CardTitle>
                <CardDescription>Project overview</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {title.description || 'No description provided.'}
            </p>
          </CardContent>
          <CardFooter className="border-t pt-3">
            <span className="text-xs text-muted-foreground">Title ID: {title.id}</span>
          </CardFooter>
        </Card>

        {/* Problem Statement */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Problem Statement</CardTitle>
                <CardDescription>Issue to be solved</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {title.problem_statement || 'No problem statement specified.'}
            </p>
          </CardContent>
          <CardFooter className="border-t pt-3">
            <span className="text-xs text-muted-foreground">Defines the core challenge</span>
          </CardFooter>
        </Card>

        {/* Scope */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Scope</CardTitle>
                <CardDescription>Project boundaries</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {title.scope || 'No scope specified.'}
            </p>
          </CardContent>
          <CardFooter className="border-t pt-3">
            <span className="text-xs text-muted-foreground">What is included and excluded</span>
          </CardFooter>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Details</CardTitle>
                <CardDescription>Lecturer and availability</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lecturer */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-grey-100 flex items-center justify-center shrink-0 text-sm font-semibold text-grey-500">
                {title.lecturer?.name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title.lecturer?.name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{title.lecturer?.email || 'No email'}</p>
              </div>
            </div>
            {/* Availability */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Available Slots:</span>
              <Badge 
                variant={isFull ? 'secondary' : 'default'} 
                className={isFull ? 'bg-error-100 text-error-500 hover:bg-error-100' : 'bg-success-100 text-success-500 hover:bg-success-100'}
              >
                {title.quota - activeGroups.length} / {title.quota} groups
              </Badge>
            </div>
            {/* Specializations */}
            <div>
              <span className="text-sm text-muted-foreground">Specializations:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(title.specializations || []).map(s => (
                  <Badge key={s} variant="outline">{s}</Badge>
                ))}
                {(!title.specializations || title.specializations.length === 0) && (
                  <span className="text-sm text-muted-foreground">None specified</span>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {activeGroups.length} of {title.quota} slots filled
            </span>
          </CardFooter>
        </Card>
      </div>

      {/* Assigned Groups */}
      {activeGroups.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-xl font-semibold text-foreground">Assigned Groups</h2>
            <p className="text-sm text-muted-foreground">
              {activeGroups.length} group{activeGroups.length > 1 ? 's' : ''} working on this title
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeGroups.map((group) => (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Group #{group.id}</CardTitle>
                      <CardDescription>
                        {group.members.length} member{group.members.length > 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {group.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-grey-100 flex items-center justify-center shrink-0 text-sm font-semibold text-grey-500">
                          {member.student.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{member.student.name}</p>
                            {member.is_leader && (
                              <Badge variant="secondary" className="text-xs">Leader</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{member.student.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-3">
                  <span className="text-xs text-muted-foreground">Status: {group.status}</span>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
