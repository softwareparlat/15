import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import {
  authenticateToken,
  requireRole,
  generateToken,
  hashPassword,
  comparePassword,
  type AuthRequest
} from "./auth";
import { sendWelcomeEmail, sendContactNotification, sendPartnerCommissionNotification } from "./email";
import { createPayment, handleWebhook, updateMercadoPagoConfig, getMercadoPagoConfig } from "./mercadopago";
import {
  loginSchema,
  registerSchema,
  contactSchema,
  insertProjectSchema,
  insertTicketSchema,
} from "@shared/schema";
import { z } from "zod";
import { db, projects, paymentStages } from "./db";
import { eq, and, asc, lte } from "drizzle-orm"; // Import necessary drizzle-orm functions

// Middleware for authentication and authorization
const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  authenticateToken(req, res, () => {
    if (req.user) {
      next();
    } else {
      res.status(401).json({ message: "No autorizado" });
    }
  });
};

// Validation middleware
const validateSchema = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Datos de entrada inválidos",
          errors: error.errors,
        });
      }
      next(error);
    }
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed initial data
  await storage.seedUsers();

  // Auth Routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      const token = generateToken(user.id);
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        user: userWithoutPassword,
        token,
        message: "Inicio de sesión exitoso",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "El email ya está registrado" });
      }

      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Create partner if role is partner
      if (userData.role === "partner") {
        const referralCode = `PAR${user.id}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        await storage.createPartner({
          userId: user.id,
          referralCode,
          commissionRate: "25.00",
          totalEarnings: "0.00",
        });
      }

      // Send welcome email
      try {
        await sendWelcomeEmail(user.email, user.fullName);
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
      }

      const token = generateToken(user.id);
      const { password: _, ...userWithoutPassword } = user;

      res.status(201).json({
        user: userWithoutPassword,
        token,
        message: "Registro exitoso",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { password: _, ...userWithoutPassword } = req.user!;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Contact Routes
  app.post("/api/contact", async (req, res) => {
    try {
      const contactData = contactSchema.parse(req.body);

      // Send notification email to admin
      try {
        await sendContactNotification(contactData);
      } catch (emailError) {
        console.error("Error sending contact notification:", emailError);
      }

      res.json({ message: "Mensaje enviado correctamente. Te contactaremos pronto." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // User Routes
  app.get("/api/users", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/users/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updates = req.body;

      if (updates.password) {
        updates.password = await hashPassword(updates.password);
      }

      const user = await storage.updateUser(userId, updates);
      const { password: _, ...userWithoutPassword } = user;

      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Partner Routes
  app.get("/api/partners/me", authenticateToken, requireRole(["partner"]), async (req: AuthRequest, res) => {
    try {
      const partner = await storage.getPartner(req.user!.id);
      if (!partner) {
        return res.status(404).json({ message: "Partner no encontrado" });
      }

      const stats = await storage.getPartnerStats(partner.id);
      res.json({ ...partner, ...stats });
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/partners/referrals", authenticateToken, requireRole(["partner"]), async (req: AuthRequest, res) => {
    try {
      const partner = await storage.getPartner(req.user!.id);
      if (!partner) {
        return res.status(404).json({ message: "Partner no encontrado" });
      }

      const referrals = await storage.getReferrals(partner.id);
      res.json(referrals);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/partners", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { userId, commissionRate } = req.body;

      const existingPartner = await storage.getPartner(userId);
      if (existingPartner) {
        return res.status(400).json({ message: "El usuario ya es un partner" });
      }

      const referralCode = `PAR${userId}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const partner = await storage.createPartner({
        userId,
        referralCode,
        commissionRate: commissionRate || "25.00",
        totalEarnings: "0.00",
      });

      res.status(201).json(partner);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Projects
  app.get("/api/projects", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projects = await storage.getProjects(req.user!.id, req.user!.role);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/projects", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { name, description, price } = req.body;

      const projectData = {
        name,
        description,
        price: price.toString(), // Ensure price is a string for decimal field
        clientId: req.user!.id,
        status: "pending",
        progress: 0,
      };

      // Only admin can set different client ID
      if (req.user!.role === "admin" && req.body.clientId) {
        projectData.clientId = req.body.clientId;
      }

      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/projects/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const updates = req.body;

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Validate dates if provided
      if (updates.startDate && updates.startDate !== null) {
        const startDate = new Date(updates.startDate);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ message: "Fecha de inicio inválida" });
        }
      }

      if (updates.deliveryDate && updates.deliveryDate !== null) {
        const deliveryDate = new Date(updates.deliveryDate);
        if (isNaN(deliveryDate.getTime())) {
          return res.status(400).json({ message: "Fecha de entrega inválida" });
        }
      }

      const project = await storage.updateProject(projectId, updates);
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Project detail routes
  app.get("/api/projects/:id/messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const messages = await storage.getProjectMessages(projectId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/projects/:id/messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { message } = req.body;

      const newMessage = await storage.createProjectMessage({
        projectId,
        userId: req.user!.id,
        message,
      });

      res.status(201).json(newMessage);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/projects/:id/files", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const files = await storage.getProjectFiles(projectId);
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/projects/:id/files", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { fileName, fileUrl, fileType } = req.body;

      const newFile = await storage.createProjectFile({
        projectId,
        fileName,
        fileUrl,
        fileType,
        uploadedBy: req.user!.id,
      });

      res.status(201).json(newFile);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/projects/:id/timeline", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const timeline = await storage.getProjectTimeline(projectId);
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/projects/:id/timeline", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const timelineData = { ...req.body, projectId };

      const timeline = await storage.createProjectTimeline(timelineData);
      res.status(201).json(timeline);
    } catch (error) {
      console.error("Error creating project timeline:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/projects/:id/timeline/:timelineId", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const timelineId = parseInt(req.params.timelineId);
      const updates = req.body;

      const timeline = await storage.updateProjectTimeline(timelineId, updates);
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Ticket Routes
  app.get("/api/tickets", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const tickets = await storage.getTickets(req.user!.id);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/tickets", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { title, description, priority, projectId } = req.body;

      const ticketData = {
        title,
        description,
        priority: priority || "medium",
        userId: req.user!.id,
        projectId: projectId || null,
      };

      const ticket = await storage.createTicket(ticketData);
      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
      }
      console.error("Error creating ticket:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/tickets/:id/responses", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const { message } = req.body;

      const response = await storage.createTicketResponse({
        ticketId,
        userId: req.user!.id,
        message,
        isFromSupport: req.user!.role === "admin",
      });

      res.status(201).json(response);
    } catch (error) {
      console.error("Error creating ticket response:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/tickets/:id/responses", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const responses = await storage.getTicketResponses(ticketId);
      res.json(responses);
    } catch (error) {
      console.error("Error getting ticket responses:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Notification Routes
  app.get("/api/notifications", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const notifications = await storage.getNotifications(req.user!.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/notifications/:id/read", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      await storage.markNotificationAsRead(notificationId);
      res.json({ message: "Notificación marcada como leída" });
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Payment Stages Routes
  app.post("/api/projects/:id/payment-stages", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { stages } = req.body;

      // Verify project exists and user has access
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Proyecto no encontrado" });
      }

      // Create payment stages
      const createdStages = [];
      for (const stage of stages) {
        const stageData = {
          projectId: projectId,
          stageName: stage.name,
          stagePercentage: stage.percentage,
          amount: (parseFloat(project.price) * stage.percentage / 100),
          requiredProgress: stage.requiredProgress,
          status: stage.requiredProgress === 0 ? 'available' : 'pending'
        };
        const created = await storage.createPaymentStage(stageData);
        createdStages.push(created);
      }

      res.json(createdStages);
    } catch (error) {
      console.error("Error creating payment stages:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/projects/:id/payment-stages", requireAuth, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const stages = await storage.getPaymentStages(projectId);
      res.json(stages);
    } catch (error) {
      console.error("Error fetching payment stages:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.patch("/api/payment-stages/:id", requireAuth, async (req, res) => {
    try {
      const stageId = parseInt(req.params.id);
      const updates = req.body;
      const updated = await storage.updatePaymentStage(stageId, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating payment stage:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/payment-stages/:id/complete", requireAuth, async (req, res) => {
    try {
      const stageId = parseInt(req.params.id);
      const updated = await storage.completePaymentStage(stageId);
      res.json(updated);
    } catch (error) {
      console.error("Error completing payment stage:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Payment Routes
  app.post("/api/payments/create", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { projectId, amount, description } = req.body;

      const payment = await createPayment({
        amount,
        description,
        projectId,
        clientEmail: req.user!.email,
        clientName: req.user!.fullName,
      });

      // Save payment to database
      await storage.createPayment({
        projectId,
        amount: amount.toString(),
        status: "pending",
        mercadoPagoId: payment.id,
        paymentData: payment,
      });

      res.json(payment);
    } catch (error) {
      res.status(500).json({ message: "Error al crear el pago" });
    }
  });

  app.post("/api/payments/webhook", handleWebhook);

  // Portfolio Routes
  app.get("/api/portfolio", async (req, res) => {
    try {
      const portfolioItems = await storage.getPortfolio();
      res.json(portfolioItems);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/portfolio", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const portfolioData = req.body;
      const portfolio = await storage.createPortfolio(portfolioData);
      res.status(201).json(portfolio);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/portfolio/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const portfolioId = parseInt(req.params.id);
      const updates = req.body;
      const portfolio = await storage.updatePortfolio(portfolioId, updates);
      res.json(portfolio);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.delete("/api/portfolio/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const portfolioId = parseInt(req.params.id);
      await storage.deletePortfolio(portfolioId);
      res.json({ message: "Elemento del portfolio eliminado" });
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Client billing routes
  app.get("/api/client/billing", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Mock data for now - replace with actual database queries
      const billingData = {
        currentBalance: 0,
        totalPaid: 15750,
        pendingPayments: 2500,
        nextPaymentDue: '2024-02-15',
      };
      res.json(billingData);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/client/invoices", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const invoices = await storage.getInvoicesByClient(req.user!.id);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/client/payment-methods", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const paymentMethods = await storage.getPaymentMethodsByUser(req.user!.id);
      res.json(paymentMethods);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/client/payment-methods", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const paymentMethodData = {
        ...req.body,
        userId: req.user!.id,
      };
      const paymentMethod = await storage.createPaymentMethod(paymentMethodData);
      res.status(201).json(paymentMethod);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/client/payment-methods/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const paymentMethodId = parseInt(req.params.id);
      const updates = req.body;
      const paymentMethod = await storage.updatePaymentMethod(paymentMethodId, updates);
      res.json(paymentMethod);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.delete("/api/client/payment-methods/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const paymentMethodId = parseInt(req.params.id);
      await storage.deletePaymentMethod(paymentMethodId);
      res.json({ message: "Método de pago eliminado" });
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/client/transactions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const transactions = await storage.getTransactionsByUser(req.user!.id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Admin Routes
  app.get("/api/admin/stats", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Admin Partners Management
  app.get("/api/admin/partners", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const partners = await storage.getAllPartnersForAdmin();
      res.json(partners);
    } catch (error) {
      console.error("Error getting partners for admin:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/admin/partners/stats", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getPartnerStatsForAdmin();
      res.json(stats);
    } catch (error) {
      console.error("Error getting partner stats for admin:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/admin/partners/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const partnerId = parseInt(req.params.id);
      const updates = req.body;
      const partner = await storage.updatePartner(partnerId, updates);
      res.json(partner);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Admin Users Stats
  app.get("/api/admin/users/stats", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getUserStatsForAdmin();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/admin/projects", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const projects = await storage.getAllProjectsForAdmin();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/admin/projects/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const updates = req.body;

      console.log("Updating project:", projectId, "with data:", updates);

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Validate dates if provided
      if (updates.startDate && updates.startDate !== null) {
        const startDate = new Date(updates.startDate);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ message: "Fecha de inicio inválida" });
        }
      }

      if (updates.deliveryDate && updates.deliveryDate !== null) {
        const deliveryDate = new Date(updates.deliveryDate);
        if (isNaN(deliveryDate.getTime())) {
          return res.status(400).json({ message: "Fecha de entrega inválida" });
        }
      }

      const project = await storage.updateProject(projectId, updates);
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ 
        message: "Error interno del servidor",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  app.delete("/api/admin/projects/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const projectId = parseInt(req.params.id);

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "ID de proyecto inválido" });
      }

      // Check if project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Proyecto no encontrado" });
      }

      await storage.deleteProject(projectId);
      res.json({ message: "Proyecto eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ 
        message: "Error interno del servidor",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  });

  app.get("/api/admin/projects/stats", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getProjectStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Admin Analytics Routes
  app.get("/api/admin/analytics", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const period = req.query.period || '30';
      const analytics = await storage.getAnalyticsData(parseInt(period as string));
      res.json(analytics);
    } catch (error) {
      console.error("Error getting analytics data:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/admin/analytics/revenue", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const period = req.query.period || '30';
      const revenueData = await storage.getRevenueAnalytics(parseInt(period as string));
      res.json(revenueData);
    } catch (error) {
      console.error("Error getting revenue analytics:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/admin/analytics/users", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const period = req.query.period || '30';
      const userAnalytics = await storage.getUserAnalytics(parseInt(period as string));
      res.json(userAnalytics);
    } catch (error) {
      console.error("Error getting user analytics:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/admin/analytics/export", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const format = req.query.format || 'pdf';
      const analytics = await storage.getAnalyticsData(30);

      // TODO: Implement PDF/Excel export
      res.json({ message: `Exporting analytics as ${format}`, data: analytics });
    } catch (error) {
      console.error("Error exporting analytics:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Admin Support Routes
  app.get("/api/admin/tickets", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const tickets = await storage.getAllTicketsForAdmin();
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/admin/tickets/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const updates = req.body;
      const ticket = await storage.updateTicket(ticketId, updates);
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/admin/tickets/stats", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const stats = await storage.getTicketStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.delete("/api/admin/tickets/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      await storage.deleteTicket(ticketId);
      res.json({ message: "Ticket eliminado exitosamente" });
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/admin/mercadopago", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const config = getMercadoPagoConfig();
      // Don't expose sensitive data
      res.json({
        publicKey: config.publicKey,
        hasAccessToken: !!config.accessToken,
        hasWebhookSecret: !!config.webhookSecret,
      });
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/admin/mercadopago", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { accessToken, publicKey, webhookSecret } = req.body;

      updateMercadoPagoConfig({
        accessToken,
        publicKey,
        webhookSecret,
      });

      res.json({ message: "Configuración de MercadoPago actualizada" });
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // WebSocket Server
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("New WebSocket connection");

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log("Received WebSocket message:", data);

        // Echo back for now - in production you'd handle different message types
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "echo",
            data: data,
            timestamp: new Date().toISOString(),
          }));
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
    });

    // Send welcome message
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "welcome",
        message: "Conectado al servidor de notificaciones en tiempo real",
        timestamp: new Date().toISOString(),
      }));
    }
  });

  return httpServer;
}