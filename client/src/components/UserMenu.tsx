import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
  BellRing,
} from "lucide-react";

export default function UserMenu() {
  const { user } = useAuth();
  const { toast } = useToast();
  const logoutMutation = useLogout();
  const { isConnected, lastMessage } = useWebSocket();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = async () => {
    try {
      toast({
        title: "Cerrando sesión...",
        description: "Redirigiendo al inicio",
      });
      await logoutMutation.mutateAsync();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cerrar sesión",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "partner":
        return "Partner";
      case "client":
        return "Cliente";
      default:
        return role;
    }
  };

  if (!user) return null;

  return (
    <div className="flex items-center space-x-4">
      {/* Notifications */}
      <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
            <Bell className="h-4 w-4" />
            {isConnected && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="p-4 border-b">
            <h4 className="font-semibold">Notificaciones</h4>
            <p className="text-sm text-muted-foreground">
              WebSocket: {isConnected ? "Conectado" : "Desconectado"}
            </p>
          </div>
          
          {lastMessage ? (
            <DropdownMenuItem className="p-4">
              <div className="flex items-start space-x-3">
                <BellRing className="h-4 w-4 mt-1 text-primary" />
                <div>
                  <p className="text-sm font-medium">{lastMessage.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {lastMessage.message || "Nueva notificación"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(lastMessage.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </DropdownMenuItem>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">No hay notificaciones</p>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center space-x-2" data-testid="button-user-menu">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {getInitials(user.fullName)}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-foreground">{user.fullName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="p-2 border-b">
            <p className="text-sm font-medium">{user.fullName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <Badge variant="secondary" className="mt-1">
              {getRoleText(user.role)}
            </Badge>
          </div>
          
          <DropdownMenuItem data-testid="menu-item-profile">
            <User className="h-4 w-4 mr-2" />
            Mi Perfil
          </DropdownMenuItem>
          
          <DropdownMenuItem data-testid="menu-item-settings">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            data-testid="menu-item-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {logoutMutation.isPending ? "Cerrando..." : "Cerrar Sesión"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
