import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import { apiRequest } from "@/lib/api";
import type { User } from "@shared/schema";
import {
  Users,
  Handshake,
  FolderOpen,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Settings,
  CreditCard,
} from "lucide-react";

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { stats, users, isLoading } = useAdmin();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreatePartnerDialog, setShowCreatePartnerDialog] = useState(false);
  const [showMercadoPagoDialog, setShowMercadoPagoDialog] = useState(false);

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: number; updates: Partial<User> }) => {
      const response = await apiRequest("PUT", `/api/users/${userId}`, updates);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast({
        title: "Usuario actualizado",
        description: "Los datos del usuario han sido actualizados exitosamente.",
      });
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar",
        description: error.message || "No se pudo actualizar el usuario",
        variant: "destructive",
      });
    },
  });

  const createPartnerMutation = useMutation({
    mutationFn: async ({ userId, commissionRate }: { userId: number; commissionRate: string }) => {
      const response = await apiRequest("POST", "/api/partners", { userId, commissionRate });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast({
        title: "Partner creado",
        description: "El usuario ha sido convertido en partner exitosamente.",
      });
      setShowCreatePartnerDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear partner",
        description: error.message || "No se pudo crear el partner",
        variant: "destructive",
      });
    },
  });

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
  };

  const handleUpdateUser = (updates: Partial<User>) => {
    if (selectedUser) {
      updateUserMutation.mutate({ userId: selectedUser.id, updates });
    }
  };

  const statsCards = [
    {
      title: "Total Usuarios",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
    {
      title: "Partners Activos",
      value: stats?.activePartners || 0,
      icon: Handshake,
      color: "bg-chart-2/10 text-chart-2",
    },
    {
      title: "Proyectos Activos",
      value: stats?.activeProjects || 0,
      icon: FolderOpen,
      color: "bg-chart-1/10 text-chart-1",
    },
    {
      title: "Ingresos del Mes",
      value: stats?.monthlyRevenue || "$0",
      icon: DollarSign,
      color: "bg-chart-4/10 text-chart-4",
    },
  ];

  if (isLoading) {
    return (
      <DashboardLayout title="Panel de Administración">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-20 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-96 bg-muted rounded"></div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Panel de Administración">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold text-foreground" data-testid={`stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-4">
          <Button onClick={() => window.location.href = "/admin/portfolio"} variant="outline" data-testid="button-manage-portfolio">
            <FolderOpen className="h-4 w-4 mr-2" />
            Gestionar Portfolio
          </Button>
          
          <Dialog open={showCreatePartnerDialog} onOpenChange={setShowCreatePartnerDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-partner">
                <Plus className="h-4 w-4 mr-2" />
                Crear Partner
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Partner</DialogTitle>
              </DialogHeader>
              <CreatePartnerForm 
                users={users?.filter(u => u.role === 'client') || []}
                onSubmit={(userId, commissionRate) => 
                  createPartnerMutation.mutate({ userId, commissionRate })
                }
                isLoading={createPartnerMutation.isPending}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={showMercadoPagoDialog} onOpenChange={setShowMercadoPagoDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-mercadopago-config">
                <CreditCard className="h-4 w-4 mr-2" />
                Configurar MercadoPago
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configuración de MercadoPago</DialogTitle>
              </DialogHeader>
              <MercadoPagoConfig />
            </DialogContent>
          </Dialog>
        </div>

        {/* Users Management Table */}
        <Card>
          <CardHeader>
            <CardTitle>Gestión de Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user) => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {user.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{user.fullName}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : user.role === 'partner' ? 'secondary' : 'outline'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'destructive'}>
                          {user.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditUser(user)}
                            data-testid={`button-edit-user-${user.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <EditUserForm
                user={selectedUser}
                onSubmit={handleUpdateUser}
                isLoading={updateUserMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

interface CreatePartnerFormProps {
  users: User[];
  onSubmit: (userId: number, commissionRate: string) => void;
  isLoading: boolean;
}

function CreatePartnerForm({ users, onSubmit, isLoading }: CreatePartnerFormProps) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [commissionRate, setCommissionRate] = useState("25.00");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserId) {
      onSubmit(selectedUserId, commissionRate);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="userId">Seleccionar Usuario</Label>
        <Select onValueChange={(value) => setSelectedUserId(parseInt(value))}>
          <SelectTrigger data-testid="select-user-partner">
            <SelectValue placeholder="Selecciona un usuario" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id.toString()}>
                {user.fullName} ({user.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="commissionRate">Tasa de Comisión (%)</Label>
        <Input
          id="commissionRate"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={commissionRate}
          onChange={(e) => setCommissionRate(e.target.value)}
          data-testid="input-commission-rate"
        />
      </div>

      <Button type="submit" disabled={!selectedUserId || isLoading} data-testid="button-submit-partner">
        {isLoading ? "Creando..." : "Crear Partner"}
      </Button>
    </form>
  );
}

interface EditUserFormProps {
  user: User;
  onSubmit: (updates: Partial<User>) => void;
  isLoading: boolean;
}

function EditUserForm({ user, onSubmit, isLoading }: EditUserFormProps) {
  const [formData, setFormData] = useState({
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="fullName">Nombre Completo</Label>
        <Input
          id="fullName"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          data-testid="input-edit-fullname"
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          data-testid="input-edit-email"
        />
      </div>

      <div>
        <Label htmlFor="role">Rol</Label>
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as any })}>
          <SelectTrigger data-testid="select-edit-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="client">Cliente</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          data-testid="checkbox-edit-active"
        />
        <Label htmlFor="isActive">Usuario Activo</Label>
      </div>

      <Button type="submit" disabled={isLoading} data-testid="button-submit-edit-user">
        {isLoading ? "Actualizando..." : "Actualizar Usuario"}
      </Button>
    </form>
  );
}

function MercadoPagoConfig() {
  const [config, setConfig] = useState({
    accessToken: "",
    publicKey: "",
    webhookSecret: "",
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (configData: typeof config) => {
      const response = await apiRequest("PUT", "/api/admin/mercadopago", configData);
      return await response.json();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfigMutation.mutate(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="accessToken">Access Token</Label>
        <Input
          id="accessToken"
          type="password"
          value={config.accessToken}
          onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
          placeholder="APP_USR-..."
          data-testid="input-mp-access-token"
        />
      </div>

      <div>
        <Label htmlFor="publicKey">Public Key</Label>
        <Input
          id="publicKey"
          value={config.publicKey}
          onChange={(e) => setConfig({ ...config, publicKey: e.target.value })}
          placeholder="APP_USR-..."
          data-testid="input-mp-public-key"
        />
      </div>

      <div>
        <Label htmlFor="webhookSecret">Webhook Secret</Label>
        <Input
          id="webhookSecret"
          type="password"
          value={config.webhookSecret}
          onChange={(e) => setConfig({ ...config, webhookSecret: e.target.value })}
          data-testid="input-mp-webhook-secret"
        />
      </div>

      <Button type="submit" disabled={updateConfigMutation.isPending} data-testid="button-submit-mp-config">
        {updateConfigMutation.isPending ? "Guardando..." : "Guardar Configuración"}
      </Button>
    </form>
  );
}
