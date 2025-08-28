import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { useProjects } from "@/hooks/useProjects";
import {
  FolderOpen,
  MessageCircle,
  Upload,
  Download,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Users,
  Send,
} from "lucide-react";

interface ProjectFile {
  id: number;
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
}

interface ProjectMessage {
  id: number;
  message: string;
  author: string;
  role: string;
  createdAt: string;
  files?: ProjectFile[];
}

interface ProjectTimeline {
  id: number;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending';
  completedAt?: string;
  estimatedDate?: string;
}

export default function ProjectsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { projects, isLoading } = useProjects();
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ projectId, message }: { projectId: number; message: string }) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/messages`, { message });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProject?.id, "messages"] });
      setNewMessage("");
      toast({
        title: "Mensaje enviado",
        description: "Tu mensaje ha sido enviado al equipo de desarrollo.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al enviar mensaje",
        description: error.message || "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedProject?.id) return;
    sendMessageMutation.mutate({ projectId: selectedProject.id, message: newMessage });
  };

  const { data: projectMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/projects", selectedProject?.id, "messages"],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const response = await apiRequest("GET", `/api/projects/${selectedProject.id}/messages`);
      return await response.json();
    },
    enabled: !!selectedProject?.id,
  });

  const { data: projectFiles, isLoading: filesLoading } = useQuery({
    queryKey: ["/api/projects", selectedProject?.id, "files"],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const response = await apiRequest("GET", `/api/projects/${selectedProject.id}/files`);
      return await response.json();
    },
    enabled: !!selectedProject?.id,
  });

  const { data: projectTimeline, isLoading: timelineLoading } = useQuery({
    queryKey: ["/api/projects", selectedProject?.id, "timeline"],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const response = await apiRequest("GET", `/api/projects/${selectedProject.id}/timeline`);
      return await response.json();
    },
    enabled: !!selectedProject?.id,
  });



  const { data: projectDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["/api/projects", selectedProject?.id, "details"],
    queryFn: async () => {
      if (!selectedProject?.id) return null;
      const response = await apiRequest("GET", `/api/projects/${selectedProject.id}/details`);
      return await response.json();
    },
    enabled: !!selectedProject?.id,
  });

  const approveMilestoneMutation = useMutation({
    mutationFn: async ({ projectId, milestoneId }: { projectId: number; milestoneId: number }) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/milestones/${milestoneId}/approve`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProject?.id, "details"] });
      toast({
        title: "Hito aprobado",
        description: "El entregable ha sido aprobado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al aprobar",
        description: error.message || "No se pudo aprobar el entregable",
        variant: "destructive",
      });
    },
  });



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'pending':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En Desarrollo';
      case 'pending':
        return 'Pendiente';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Gestión de Proyectos">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!selectedProject) {
    return (
      <DashboardLayout title="Gestión de Proyectos">
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Mis Proyectos</h1>
            <p className="text-muted-foreground">Selecciona un proyecto para ver los detalles</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map((project) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedProject(project)}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <Badge variant={getStatusColor(project.status)}>
                        {getStatusText(project.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4 line-clamp-2">
                      {project.description}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progreso</span>
                        <span className="font-medium">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} />
                    </div>
                    <div className="flex items-center mt-4 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      {project.deliveryDate
                        ? new Date(project.deliveryDate).toLocaleDateString()
                        : "Fecha por definir"
                      }
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {!projects?.length && (
            <div className="text-center py-12">
              <FolderOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No tienes proyectos</h3>
              <p className="text-muted-foreground">Solicita tu primer proyecto para comenzar</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Proyecto: ${selectedProject.name}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setSelectedProject(null)} className="mb-2">
              ← Volver a proyectos
            </Button>
            <h1 className="text-3xl font-bold">{selectedProject.name}</h1>
            <div className="flex items-center space-x-4 mt-2">
              <Badge variant={getStatusColor(selectedProject.status)}>
                {getStatusText(selectedProject.status)}
              </Badge>
              <span className="text-muted-foreground">
                Progreso: {selectedProject.progress}%
              </span>
            </div>
          </div>

          <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
            <DialogTrigger asChild>
              <Button>
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar Feedback
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar Feedback del Proyecto</DialogTitle>
              </DialogHeader>
              <FeedbackForm
                projectId={selectedProject.id}
                onClose={() => setShowFeedbackDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Project Details Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="files">Archivos</TabsTrigger>
            <TabsTrigger value="communication">Comunicación</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Descripción del Proyecto</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{selectedProject.description}</p>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Fecha de Inicio</Label>
                        <p className="text-sm text-muted-foreground">
                          {selectedProject.startDate
                            ? new Date(selectedProject.startDate).toLocaleDateString()
                            : "No definida"
                          }
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Fecha de Entrega</Label>
                        <p className="text-sm text-muted-foreground">
                          {selectedProject.deliveryDate
                            ? new Date(selectedProject.deliveryDate).toLocaleDateString()
                            : "No definida"
                          }
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Presupuesto</Label>
                        <p className="text-sm text-muted-foreground">
                          ${selectedProject.price || "No definido"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Estado del Pago</Label>
                        <Badge variant={selectedProject.paymentStatus === 'paid' ? 'default' : 'outline'}>
                          {selectedProject.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Progreso General</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary mb-2">
                        {selectedProject.progress}%
                      </div>
                      <Progress value={selectedProject.progress} className="mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Proyecto en desarrollo
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Equipo Asignado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Equipo de Desarrollo</p>
                          <p className="text-sm text-muted-foreground">3 desarrolladores</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Timeline del Proyecto</CardTitle>
              </CardHeader>
              <CardContent>
                {detailsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="animate-pulse h-16 bg-muted rounded"></div>
                    ))}
                  </div>
                ) : (
                  <ProjectTimeline projectId={selectedProject.id} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Archivos del Proyecto</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectFiles projectId={selectedProject.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communication" className="space-y-6">
              <ProjectCommunication showProjectSelector={true} />
            </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function ProjectTimeline({ projectId }: { projectId: number }) {
  const { data: timeline } = useQuery({
    queryKey: ["/api/projects", projectId, "timeline"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${projectId}/timeline`);
      return await response.json();
    },
  });

  const mockTimeline: ProjectTimeline[] = [
    {
      id: 1,
      title: "Análisis y Planificación",
      description: "Definición de requerimientos y arquitectura",
      status: 'completed',
      completedAt: '2024-01-15',
    },
    {
      id: 2,
      title: "Diseño UI/UX",
      description: "Creación de mockups y prototipos",
      status: 'completed',
      completedAt: '2024-01-28',
    },
    {
      id: 3,
      title: "Desarrollo Frontend",
      description: "Implementación de la interfaz de usuario",
      status: 'in_progress',
      estimatedDate: '2024-02-15',
    },
    {
      id: 4,
      title: "Desarrollo Backend",
      description: "APIs y lógica de negocio",
      status: 'pending',
      estimatedDate: '2024-02-28',
    },
  ];

  const timelineData = timeline || mockTimeline;

  return (
    <div className="space-y-4">
      {timelineData.map((item: ProjectTimeline) => (
        <div key={item.id} className="flex items-start space-x-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            item.status === 'completed' ? 'bg-green-100 text-green-600' :
            item.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
            'bg-gray-100 text-gray-400'
          }`}>
            {item.status === 'completed' ? <CheckCircle className="h-5 w-5" /> :
             item.status === 'in_progress' ? <Clock className="h-5 w-5" /> :
             <AlertCircle className="h-5 w-5" />}
          </div>
          <div className="flex-1">
            <h4 className="font-medium">{item.title}</h4>
            <p className="text-sm text-muted-foreground">{item.description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {item.completedAt
                ? `Completado: ${new Date(item.completedAt).toLocaleDateString()}`
                : `Estimado: ${item.estimatedDate ? new Date(item.estimatedDate).toLocaleDateString() : 'Por definir'}`
              }
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectFiles({ projectId }: { projectId: number }) {
  const { data: files } = useQuery({
    queryKey: ["/api/projects", projectId, "files"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/projects/${projectId}/files`);
      return await response.json();
    },
  });

  const mockFiles: ProjectFile[] = [
    {
      id: 1,
      name: "Requerimientos_v1.pdf",
      url: "/files/requirements.pdf",
      type: "pdf",
      uploadedAt: "2024-01-15",
      uploadedBy: "Equipo de Análisis",
    },
    {
      id: 2,
      name: "Mockups_UI.fig",
      url: "/files/mockups.fig",
      type: "figma",
      uploadedAt: "2024-01-28",
      uploadedBy: "Diseñador UX",
    },
  ];

  const filesData = files || mockFiles;

  return (
    <div className="space-y-4">
      {filesData.map((file: ProjectFile) => (
        <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div>
              <h4 className="font-medium">{file.name}</h4>
              <p className="text-sm text-muted-foreground">
                Subido por {file.uploadedBy} • {new Date(file.uploadedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Descargar
          </Button>
        </div>
      ))}

      <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Arrastra archivos aquí o haz clic para subir</p>
        <Button variant="outline" className="mt-2">
          Seleccionar Archivos
        </Button>
      </div>
    </div>
  );
}

function FeedbackForm({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement feedback submission
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="rating">Calificación (1-5)</Label>
        <Input
          id="rating"
          type="number"
          min="1"
          max="5"
          value={rating}
          onChange={(e) => setRating(parseInt(e.target.value))}
        />
      </div>
      <div>
        <Label htmlFor="feedback">Comentarios</Label>
        <Textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Comparte tu feedback sobre el proyecto..."
          rows={4}
        />
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">
          Enviar Feedback
        </Button>
      </div>
    </form>
  );
}

function ProjectCommunication({ projectId, showProjectSelector }: { projectId?: number; showProjectSelector?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { projects: allProjects, isLoading: projectsLoading } = useProjects();
  const [selectedCommunicationProject, setSelectedCommunicationProject] = useState<any>(projectId || null);
  const [newMessage, setNewMessage] = useState("");

  const sendMessageMutation = useMutation({
    mutationFn: async ({ projectId, message }: { projectId: number; message: string }) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/messages`, { message });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedCommunicationProject, "messages"] });
      setNewMessage("");
      toast({
        title: "Mensaje enviado",
        description: "Tu mensaje ha sido enviado al equipo de desarrollo.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al enviar mensaje",
        description: error.message || "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    },
  });

  const { data: projectMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/projects", selectedCommunicationProject, "messages"],
    queryFn: async () => {
      if (!selectedCommunicationProject) return [];
      const response = await apiRequest("GET", `/api/projects/${selectedCommunicationProject}/messages`);
      return await response.json();
    },
    enabled: !!selectedCommunicationProject,
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedCommunicationProject) return;
    sendMessageMutation.mutate({ projectId: selectedCommunicationProject, message: newMessage });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comunicación</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {showProjectSelector && (
            <div className="mb-4">
              <Label htmlFor="project-select">Seleccionar Proyecto</Label>
              <select
                id="project-select"
                value={selectedCommunicationProject || ""}
                onChange={(e) => setSelectedCommunicationProject(Number(e.target.value))}
                className="w-full p-2 border rounded-md mt-1"
              >
                <option value="" disabled>
                  Selecciona un proyecto
                </option>
                {allProjects?.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedCommunicationProject ? (
            <>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {messagesLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse h-16 bg-muted rounded"></div>
                    ))}
                  </div>
                ) : projectMessages?.length ? (
                  projectMessages.map((message: any) => (
                    <div key={message.id} className="flex space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {message.fullName ? message.fullName.split(' ').map((n: string) => n[0]).join('') : 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{message.fullName || 'Usuario'}</span>
                          <Badge variant="outline" className="text-xs">
                            {message.role || 'cliente'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {message.message}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay mensajes aún. ¡Inicia la conversación!</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Textarea
                  placeholder={`Escribe un mensaje sobre el proyecto seleccionado...`}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending || !selectedCommunicationProject}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendMessageMutation.isPending ? "Enviando..." : "Enviar Mensaje"}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Selecciona un proyecto para ver la comunicación.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}