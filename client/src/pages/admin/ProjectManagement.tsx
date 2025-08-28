import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Settings,
  MessageCircle,
  Upload,
  Edit,
  Trash2,
  Eye,
  DollarSign,
  Calendar,
  Filter,
  Search,
  AlertTriangle,
  MoreHorizontal,
} from "lucide-react";
import ProjectCommunication from "@/components/ProjectCommunication";

interface Project {
  id: number;
  name: string;
  description: string;
  price: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  progress: number;
  deliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
  clientName: string;
  clientEmail: string;
  clientId: number;
  startDate: string | null; // Added startDate
}

export default function ProjectManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [showTimelineDialog, setShowTimelineDialog] = useState(false);
  const [timelineProject, setTimelineProject] = useState<any>(null);
  const [newTimelineItem, setNewTimelineItem] = useState({
    title: "",
    description: "",
    estimatedDate: "",
    status: "pending"
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: projects, isLoading: projectsLoading, refetch } = useQuery({
    queryKey: ["/api/admin/projects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/projects");
      return await response.json();
    },
  });

  const { data: projectStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/projects/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/projects/stats");
      return await response.json();
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ projectId, updates }: { projectId: number; updates: any }) => {
      const response = await apiRequest("PUT", `/api/admin/projects/${projectId}`, updates);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects/stats"] });
      toast({
        title: "Proyecto actualizado",
        description: "El proyecto ha sido actualizado exitosamente.",
      });
      setShowEditDialog(false);
      setSelectedProject(null);
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/projects/${projectId}`);
      if (!response.ok) throw new Error("Error al eliminar proyecto");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects/stats"] });
      toast({
        title: "Proyecto eliminado",
        description: "El proyecto ha sido eliminado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Timeline queries
  const { data: projectTimeline, isLoading: timelineLoading } = useQuery({
    queryKey: ["/api/projects", timelineProject?.id, "timeline"],
    queryFn: async () => {
      if (!timelineProject?.id) return [];
      const response = await apiRequest("GET", `/api/projects/${timelineProject.id}/timeline`);
      return await response.json();
    },
    enabled: !!timelineProject?.id && showTimelineDialog,
  });

  const createTimelineMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/projects/${timelineProject.id}/timeline`, data);
      if (!response.ok) throw new Error("Error al crear elemento del timeline");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", timelineProject?.id, "timeline"] });
      setNewTimelineItem({ title: "", description: "", estimatedDate: "", status: "pending" });
      toast({
        title: "Timeline actualizado",
        description: "Se ha agregado un nuevo elemento al timeline.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar timeline",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTimelineMutation = useMutation({
    mutationFn: async ({ timelineId, updates }: { timelineId: number; updates: any }) => {
      const response = await apiRequest("PUT", `/api/projects/${timelineProject.id}/timeline/${timelineId}`, updates);
      if (!response.ok) throw new Error("Error al actualizar elemento del timeline");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", timelineProject?.id, "timeline"] });
      toast({
        title: "Timeline actualizado",
        description: "El elemento del timeline ha sido actualizado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar timeline",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "outline" as const, icon: Clock, color: "text-yellow-500" },
      in_progress: { variant: "secondary" as const, icon: Settings, color: "text-blue-500" },
      completed: { variant: "default" as const, icon: CheckCircle, color: "text-green-500" },
      cancelled: { variant: "destructive" as const, icon: XCircle, color: "text-red-500" },
    };

    const config = variants[status as keyof typeof variants];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {status === 'pending' ? 'Pendiente' :
         status === 'in_progress' ? 'En Desarrollo' :
         status === 'completed' ? 'Completado' : 'Cancelado'}
      </Badge>
    );
  };

  const handleDeleteProject = (projectId: number) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este proyecto?")) {
      deleteProjectMutation.mutate(projectId);
    }
  };

  const handleManageTimeline = (project: any) => {
    setTimelineProject(project);
    setShowTimelineDialog(true);
  };

  const handleCreateTimelineItem = () => {
    if (!newTimelineItem.title.trim()) {
      toast({
        title: "Error de validación",
        description: "El título es requerido.",
        variant: "destructive",
      });
      return;
    }
    createTimelineMutation.mutate(newTimelineItem);
  };

  const handleUpdateTimelineStatus = (timelineId: number, status: string) => {
    const updates = { 
      status,
      ...(status === 'completed' && { completedAt: new Date().toISOString() })
    };
    updateTimelineMutation.mutate({ timelineId, updates });
  };

  const filteredProjects = projects?.filter((project: Project) => {
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    const matchesSearch = 
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.clientEmail.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  }) || [];

  if (projectsLoading || statsLoading) {
    return (
      <DashboardLayout title="Gestión de Proyectos">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gestión de Proyectos">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold">{projectStats?.pending || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Settings className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">En Desarrollo</p>
                  <p className="text-2xl font-bold">{projectStats?.inProgress || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Completados</p>
                  <p className="text-2xl font-bold">{projectStats?.completed || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <XCircle className="h-8 w-8 text-red-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Cancelados</p>
                  <p className="text-2xl font-bold">{projectStats?.cancelled || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-emerald-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Ingresos Totales</p>
                  <p className="text-2xl font-bold">${projectStats?.totalRevenue || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros y Búsqueda
              </CardTitle>
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar proyectos, clientes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full md:w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="in_progress">En Desarrollo</SelectItem>
                    <SelectItem value="completed">Completados</SelectItem>
                    <SelectItem value="cancelled">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle>Todos los Proyectos ({filteredProjects.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Fecha de Inicio</TableHead> {/* Added */}
                    <TableHead>Fecha de Entrega</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project: Project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {project.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{project.clientName}</p>
                          <p className="text-sm text-muted-foreground">{project.clientEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell>${project.price}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 h-2 bg-muted rounded-full">
                            <div 
                              className="h-2 bg-primary rounded-full transition-all"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <span className="text-sm">{project.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell> {/* Added */}
                        {project.startDate ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {new Date(project.startDate).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin definir</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {project.deliveryDate ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {new Date(project.deliveryDate).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin definir</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedProject(project);
                                setShowEditDialog(true);
                              }}
                              className="cursor-pointer"
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar Proyecto
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleManageTimeline(project)}
                              className="cursor-pointer"
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              Gestionar Timeline
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedProject(project);
                                setShowDeleteDialog(true);
                              }}
                              className="cursor-pointer text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar Proyecto
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Project Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Proyecto</DialogTitle>
            </DialogHeader>
            {selectedProject && (
              <EditProjectForm
                project={selectedProject}
                onSubmit={(updates) => 
                  updateProjectMutation.mutate({ projectId: selectedProject.id, updates })
                }
                isLoading={updateProjectMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirmar Eliminación
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>¿Estás seguro de que deseas eliminar el proyecto "{selectedProject?.name}"?</p>
              <p className="text-sm text-muted-foreground mt-2">
                Esta acción no se puede deshacer y eliminará todos los datos relacionados.
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => selectedProject && deleteProjectMutation.mutate(selectedProject.id)}
                disabled={deleteProjectMutation.isPending}
              >
                {deleteProjectMutation.isPending ? "Eliminando..." : "Eliminar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Timeline Management Dialog */}
        <Dialog open={showTimelineDialog} onOpenChange={setShowTimelineDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Gestionar Timeline - {timelineProject?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Add New Timeline Item */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Agregar Nuevo Elemento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="timeline-title">Título</Label>
                      <Input
                        id="timeline-title"
                        value={newTimelineItem.title}
                        onChange={(e) => setNewTimelineItem(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Ej: Análisis y Planificación"
                      />
                    </div>
                    <div>
                      <Label htmlFor="timeline-date">Fecha Estimada</Label>
                      <Input
                        id="timeline-date"
                        type="date"
                        value={newTimelineItem.estimatedDate}
                        onChange={(e) => setNewTimelineItem(prev => ({ ...prev, estimatedDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="timeline-description">Descripción</Label>
                    <Textarea
                      id="timeline-description"
                      value={newTimelineItem.description}
                      onChange={(e) => setNewTimelineItem(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe las actividades de esta fase..."
                    />
                  </div>
                  <Button 
                    onClick={handleCreateTimelineItem}
                    disabled={createTimelineMutation.isPending}
                  >
                    {createTimelineMutation.isPending ? "Creando..." : "Agregar al Timeline"}
                  </Button>
                </CardContent>
              </Card>

              {/* Timeline Items List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Timeline Actual</CardTitle>
                </CardHeader>
                <CardContent>
                  {timelineLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-pulse h-16 bg-muted rounded"></div>
                      ))}
                    </div>
                  ) : projectTimeline?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay elementos en el timeline.</p>
                      <p className="text-sm">Agrega el primer elemento arriba.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {projectTimeline?.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1 space-y-1">
                            <h4 className="font-medium">{item.title}</h4>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {item.estimatedDate && (
                                <span>Estimado: {new Date(item.estimatedDate).toLocaleDateString()}</span>
                              )}
                              {item.completedAt && (
                                <span>Completado: {new Date(item.completedAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={
                                item.status === 'completed' ? 'default' :
                                item.status === 'in_progress' ? 'secondary' :
                                'outline'
                              }
                            >
                              {item.status === 'completed' ? 'Completado' :
                               item.status === 'in_progress' ? 'En Progreso' :
                               'Pendiente'}
                            </Badge>
                            <select
                              value={item.status}
                              onChange={(e) => handleUpdateTimelineStatus(item.id, e.target.value)}
                              className="text-xs border rounded px-2 py-1"
                              disabled={updateTimelineMutation.isPending}
                            >
                              <option value="pending">Pendiente</option>
                              <option value="in_progress">En Progreso</option>
                              <option value="completed">Completado</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>

        {/* Inside the main return statement, locate the Tabs component and modify it */}
        {selectedProject && (
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Detalles del Proyecto: {selectedProject.name}</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="details">Detalles</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="communication">Comunicación</TabsTrigger>
                  <TabsTrigger value="files">Archivos</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4 pt-4">
                  <EditProjectForm
                    project={selectedProject}
                    onSubmit={(updates) => 
                      updateProjectMutation.mutate({ projectId: selectedProject.id, updates })
                    }
                    isLoading={updateProjectMutation.isPending}
                  />
                </TabsContent>
                <TabsContent value="timeline" className="space-y-4 pt-4">
                  <Button onClick={() => handleManageTimeline(selectedProject)} className="mb-4">
                    Gestionar Timeline
                  </Button>
                </TabsContent>
                <TabsContent value="communication" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <MessageCircle className="h-5 w-5 mr-2" />
                            Comunicación con {selectedProject?.clientName}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ProjectCommunication projectId={selectedProject?.id} />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="files" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Archivos del Proyecto</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground">
                            Funcionalidad de archivos estará disponible próximamente.
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}

interface EditProjectFormProps {
  project: Project;
  onSubmit: (updates: any) => void;
  isLoading: boolean;
}

function EditProjectForm({ project, onSubmit, isLoading }: EditProjectFormProps) {
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description || "",
    price: project.price,
    status: project.status,
    progress: project.progress,
    startDate: project.startDate ? (
      project.startDate.includes('T') 
        ? project.startDate.split('T')[0] 
        : project.startDate
    ) : "",
    deliveryDate: project.deliveryDate ? (
      project.deliveryDate.includes('T') 
        ? project.deliveryDate.split('T')[0] 
        : project.deliveryDate
    ) : "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    console.log("Form data before submit:", formData);

    // Format dates correctly, ensuring we handle empty strings properly
    const submitData = {
      ...formData,
      startDate: formData.startDate && formData.startDate.trim() !== "" 
        ? new Date(formData.startDate + 'T00:00:00.000Z').toISOString() 
        : null,
      deliveryDate: formData.deliveryDate && formData.deliveryDate.trim() !== "" 
        ? new Date(formData.deliveryDate + 'T00:00:00.000Z').toISOString() 
        : null,
      progress: Math.min(Math.max(formData.progress, 0), 100), // Ensure progress is between 0-100
    };

    console.log("Submit data:", submitData);
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Project Basic Info */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Información del Proyecto</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Nombre del Proyecto *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nombre del proyecto"
              required
            />
          </div>
          <div>
            <Label htmlFor="price">Precio (USD) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Descripción del Proyecto</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe los objetivos y alcance del proyecto..."
            rows={4}
            className="resize-none"
          />
        </div>
      </div>

      {/* Project Status & Progress */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Estado y Progreso</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="status">Estado del Proyecto *</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData({ ...formData, status: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    Pendiente
                  </div>
                </SelectItem>
                <SelectItem value="in_progress">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-blue-500" />
                    En Desarrollo
                  </div>
                </SelectItem>
                <SelectItem value="completed">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Completado
                  </div>
                </SelectItem>
                <SelectItem value="cancelled">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Cancelado
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="progress">Progreso (%)</Label>
            <div className="space-y-2">
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={formData.progress}
                onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${Math.min(Math.max(formData.progress, 0), 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="status-dates">Estado y Fechas</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Configure las fechas del proyecto
            </p>
          </div>
        </div>
      </div>

      {/* Project Dates */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Fechas del Proyecto</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Fecha de Inicio</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate ? (
                formData.startDate.includes('T') 
                  ? formData.startDate.split('T')[0] 
                  : formData.startDate
              ) : ""}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Fecha de inicio del proyecto
            </p>
          </div>
          <div>
            <Label htmlFor="deliveryDate">Fecha de Entrega</Label>
            <Input
              id="deliveryDate"
              type="date"
              value={formData.deliveryDate ? (
                formData.deliveryDate.includes('T') 
                  ? formData.deliveryDate.split('T')[0] 
                  : formData.deliveryDate
              ) : ""}
              onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
              min={formData.startDate || new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Fecha estimada de finalización
            </p>
          </div>
        </div>
      </div>


      {/* Client Info (read-only) */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Información del Cliente</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nombre del Cliente</Label>
            <Input value={project.clientName} disabled className="bg-muted" />
          </div>
          <div>
            <Label>Email del Cliente</Label>
            <Input value={project.clientEmail} disabled className="bg-muted" />
          </div>
        </div>
      </div>

      {/* Project Dates (read-only) */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Fechas del Proyecto</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Fecha de Creación</Label>
            <Input 
              value={new Date(project.createdAt).toLocaleDateString()} 
              disabled 
              className="bg-muted" 
            />
          </div>
          <div>
            <Label>Última Actualización</Label>
            <Input 
              value={new Date(project.updatedAt).toLocaleDateString()} 
              disabled 
              className="bg-muted" 
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2 pt-6 border-t">
        <Button type="submit" disabled={isLoading} className="min-w-32">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Guardando...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Guardar Cambios
            </div>
          )}
        </Button>
      </div>
    </form>
  );
}