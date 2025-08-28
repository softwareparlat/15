
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { CreditCard, Clock, CheckCircle, DollarSign } from "lucide-react";

interface PaymentStage {
  id: number;
  projectId: number;
  stageName: string;
  stagePercentage: number;
  amount: string;
  requiredProgress: number;
  status: string;
  paymentLink?: string;
  mercadoPagoId?: string;
  dueDate?: string;
  paidDate?: string;
  createdAt: string;
}

interface PaymentStagesManagementProps {
  projectId: number;
  projectProgress: number;
}

export default function PaymentStagesManagement({ 
  projectId, 
  projectProgress 
}: PaymentStagesManagementProps) {
  const [stages, setStages] = useState<PaymentStage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStages();
  }, [projectId]);

  const fetchStages = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/payment-stages`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setStages(data);
      }
    } catch (error) {
      console.error("Error fetching payment stages:", error);
    }
  };

  const generatePaymentLink = async (stageId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/payment-stages/${stageId}/generate-link`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        fetchStages(); // Refresh data
      }
    } catch (error) {
      console.error("Error generating payment link:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsPaid = async (stageId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/payment-stages/${stageId}/complete`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        fetchStages(); // Refresh data
      }
    } catch (error) {
      console.error("Error marking as paid:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendiente", variant: "secondary" as const },
      available: { label: "Disponible", variant: "default" as const },
      paid: { label: "Pagado", variant: "success" as const },
      overdue: { label: "Vencido", variant: "destructive" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      variant: "secondary" as const,
    };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "available":
        return <CreditCard className="h-4 w-4 text-blue-500" />;
      case "overdue":
        return <Clock className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Etapas de Pago
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Progreso del Proyecto: {projectProgress}%
          </div>
          <Progress value={projectProgress} className="w-full" />
          
          <div className="space-y-4">
            {stages.map((stage) => (
              <div
                key={stage.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(stage.status)}
                  <div>
                    <div className="font-medium">{stage.stageName}</div>
                    <div className="text-sm text-muted-foreground">
                      {stage.stagePercentage}% - ${parseFloat(stage.amount).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Requerido: {stage.requiredProgress}% progreso
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(stage.status)}
                  
                  {stage.status === "available" && !stage.paymentLink && (
                    <Button
                      size="sm"
                      onClick={() => generatePaymentLink(stage.id)}
                      disabled={loading}
                    >
                      Generar Link
                    </Button>
                  )}

                  {stage.paymentLink && stage.status === "available" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(stage.paymentLink, "_blank")}
                      >
                        Ver Link
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => markAsPaid(stage.id)}
                        disabled={loading}
                      >
                        Marcar Pagado
                      </Button>
                    </div>
                  )}

                  {stage.status === "paid" && stage.paidDate && (
                    <div className="text-xs text-muted-foreground">
                      Pagado: {new Date(stage.paidDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
