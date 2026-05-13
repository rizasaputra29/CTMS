'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { TemplateDialog } from './components/TemplateDialog';
import { TemplateList } from './components/TemplateList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Template {
  id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AssessmentBankPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [activeTab, setActiveTab] = useState('active');

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/assessment-templates');
      setTemplates(res.data || []);
    } catch (error) {
      toast.error('Failed to load assessment templates');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = async (template: Template) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/assessment-templates/${template.id}`);
      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to delete template');
    }
  };

  const handleToggleActive = async (template: Template) => {
    try {
      await api.put(`/admin/assessment-templates/${template.id}`, {
        ...template,
        is_active: !template.is_active,
      });
      toast.success(template.is_active ? 'Template archived' : 'Template activated');
      fetchTemplates();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update template');
    }
  };

  const handleSave = async (data: Partial<Template>) => {
    try {
      if (editingTemplate) {
        await api.put(`/admin/assessment-templates/${editingTemplate.id}`, data);
        toast.success('Template updated successfully');
      } else {
        await api.post('/admin/assessment-templates', data);
        toast.success('Template created successfully');
      }
      setDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to save template');
    }
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = 
      template.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTab = activeTab === 'all' 
      ? true 
      : activeTab === 'active' 
        ? template.is_active 
        : !template.is_active;
    
    return matchesSearch && matchesTab;
  });

  const activeCount = templates.filter(t => t.is_active).length;
  const archivedCount = templates.filter(t => !t.is_active).length;

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assessment Bank</h1>
            <p className="text-muted-foreground mt-1">
              Manage master assessment component templates (CPMK/CPL) that can be used across periods.
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Template
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Archived</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{archivedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active">
            Active
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-2">{activeCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archived
            {archivedCount > 0 && (
              <Badge variant="secondary" className="ml-2">{archivedCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">
            All
            {templates.length > 0 && (
              <Badge variant="secondary" className="ml-2">{templates.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>Component Templates</CardTitle>
              <CardDescription>
                {activeTab === 'active' && 'Templates available for use in period configuration'}
                {activeTab === 'archived' && 'Inactive templates not available for selection'}
                {activeTab === 'all' && 'All assessment component templates'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-12 border rounded-lg border-dashed">
                  <p className="text-muted-foreground">
                    {searchQuery 
                      ? 'No templates match your search'
                      : activeTab === 'archived' 
                        ? 'No archived templates'
                        : 'No templates available. Create your first template to get started.'
                    }
                  </p>
                  {!searchQuery && activeTab !== 'archived' && (
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={handleCreate}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Template
                    </Button>
                  )}
                </div>
              ) : (
                <TemplateList
                  templates={filteredTemplates}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
        onSave={handleSave}
      />
    </div>
  );
}
