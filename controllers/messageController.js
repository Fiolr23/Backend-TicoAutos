const mongoose = require("mongoose");
const Vehicle = require("../models/vehicle");
const Question = require("../models/question");

// Populate reutilizable para traer la información relacionada de vehículo y usuarios.
const QUESTION_POPULATE = [
  {
    path: "vehicleId",
    select: "brand model year price color status images location",
  },
  { path: "ownerId", select: "name lastname email" },
  { path: "askedByUserId", select: "name lastname email" },
  { path: "answeredByUserId", select: "name lastname email" },
];

// Valida si un valor tiene formato válido de ObjectId de MongoDB.
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// Normaliza y valida los parámetros de paginación.
const normalizePagination = (query) => {
  const page = Number.parseInt(query.page, 10) || 1;
  const limit = Number.parseInt(query.limit, 10) || 10;

  if (page < 1 || limit < 1 || limit > 100) {
    return null;
  }

  return { page, limit, skip: (page - 1) * limit };
};

// Crea una nueva pregunta sobre un vehículo.
const askQuestion = async (req, res) => {
  try {
    const vehicleId = req.params.vehicleId;
    const questionText = req.body.questionText?.trim();

    if (!isValidObjectId(vehicleId)) {
      return res.status(400).json({ message: "El identificador del vehiculo no es valido." });
    }

    if (!questionText) {
      return res.status(400).json({ message: "Debes ingresar una pregunta." });
    }

    if (questionText.length > 1000) {
      return res.status(400).json({ message: "La pregunta no puede superar los 1000 caracteres." });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ message: "El vehiculo solicitado no fue encontrado." });
    }

    // Evita que el dueño pregunte sobre su propio vehículo.
    if (vehicle.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "No puedes realizar preguntas sobre tu propio vehiculo." });
    }

    // El interesado debe esperar respuesta antes de poder volver a preguntar
    // sobre el mismo vehiculo.
    const pendingQuestion = await Question.findOne({
      vehicleId,
      askedByUserId: req.user._id,
      status: "pending",
    });

    // El interesado debe esperar respuesta antes de poder volver a preguntar
    // sobre el mismo vehiculo.
    if (pendingQuestion) {
      return res.status(409).json({
        message: "Ya tienes una pregunta pendiente para este vehiculo. Debes esperar la respuesta del propietario.",
      });
    }

    // Registra la nueva pregunta.
    const question = await Question.create({
      vehicleId,
      ownerId: vehicle.userId,
      askedByUserId: req.user._id,
      questionText,
      askedAt: new Date(),
    });

    // Devuelve la pregunta con datos relacionados poblados.
    const populatedQuestion = await Question.findById(question._id).populate(QUESTION_POPULATE);

    return res.status(201).json(populatedQuestion);
  } catch (error) {
    console.error("Error creating question:", error);
    return res.status(500).json({ message: "No fue posible registrar la pregunta." });
  }
};

// Obtiene las preguntas realizadas por el usuario autenticado.
const getMyQuestions = async (req, res) => {
  try {
    const pagination = normalizePagination(req.query);

    if (!pagination) {
      return res.status(400).json({ message: "Los parametros de paginacion son invalidos." });
    }

    const { page, limit, skip } = pagination;

    // Ejecuta consulta paginada y conteo total en paralelo.
    const [results, total] = await Promise.all([
      Question.find({ askedByUserId: req.user._id })
        .populate(QUESTION_POPULATE)
        .sort({ askedAt: -1 })
        .skip(skip)
        .limit(limit),
      Question.countDocuments({ askedByUserId: req.user._id }),
    ]);

    return res.json({
      total,
      totalPages: Math.ceil(total / limit) || 1,
      page,
      limit,
      results,
    });
  } catch (error) {
    console.error("Error loading user questions:", error);
    return res.status(500).json({ message: "No fue posible cargar tus preguntas." });
  }
};

// Obtiene las preguntas recibidas por el propietario.
const getOwnerQuestions = async (req, res) => {
  try {
    const pagination = normalizePagination(req.query);

    if (!pagination) {
      return res.status(400).json({ message: "Los parametros de paginacion son invalidos." });
    }

    const filters = { ownerId: req.user._id };

    // Filtra por vehículo si se envía en query.
    if (req.query.vehicleId) {
      if (!isValidObjectId(req.query.vehicleId)) {
        return res.status(400).json({ message: "El identificador del vehiculo no es valido." });
      }

      filters.vehicleId = req.query.vehicleId;
    }

    // Filtra por estado solo si el valor es permitido.
    if (req.query.status && ["pending", "answered"].includes(req.query.status)) {
      filters.status = req.query.status;
    }

    const { page, limit, skip } = pagination;

    const [results, total] = await Promise.all([
      Question.find(filters)
        .populate(QUESTION_POPULATE)
        .sort({ askedAt: -1 })
        .skip(skip)
        .limit(limit),
      Question.countDocuments(filters),
    ]);

    return res.json({
      total,
      totalPages: Math.ceil(total / limit) || 1,
      page,
      limit,
      results,
    });
  } catch (error) {
    console.error("Error loading owner questions:", error);
    return res.status(500).json({ message: "No fue posible cargar las preguntas recibidas." });
  }
};

// Obtiene el historial de preguntas de un vehículo.
const getVehicleQuestions = async (req, res) => {
  try {
    const vehicleId = req.params.vehicleId;

    if (!isValidObjectId(vehicleId)) {
      return res.status(400).json({ message: "El identificador del vehiculo no es valido." });
    }

    const vehicle = await Vehicle.findById(vehicleId).populate("userId", "name lastname email");
    if (!vehicle) {
      return res.status(404).json({ message: "El vehiculo solicitado no fue encontrado." });
    }

    const isOwner = vehicle.userId._id.toString() === req.user._id.toString();
    const filters = { vehicleId };

    // El propietario ve todo el historial del vehiculo.
    // El interesado solo ve las preguntas que el mismo realizo.
    if (!isOwner) {
      filters.askedByUserId = req.user._id;
    }

    const results = await Question.find(filters)
      .populate(QUESTION_POPULATE)
      .sort({ askedAt: 1 });

    return res.json({
      vehicle,
      isOwner,
      canAsk: !isOwner && !results.some((question) => question.status === "pending"),
      results,
    });
  } catch (error) {
    console.error("Error loading vehicle questions:", error);
    return res.status(500).json({ message: "No fue posible cargar el historial de preguntas." });
  }
};

// Permite al propietario responder una pregunta.
const answerQuestion = async (req, res) => {
  try {
    const questionId = req.params.id;
    const answerText = req.body.answerText?.trim();

    if (!isValidObjectId(questionId)) {
      return res.status(400).json({ message: "El identificador de la pregunta no es valido." });
    }

    if (!answerText) {
      return res.status(400).json({ message: "Debes ingresar una respuesta." });
    }

    if (answerText.length > 1000) {
      return res.status(400).json({ message: "La respuesta no puede superar los 1000 caracteres." });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "La pregunta solicitada no fue encontrada." });
    }

    // Solo el dueño del vehículo puede responder.
    if (question.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Solo el propietario del vehiculo puede responder esta pregunta." });
    }

    // Evita responder dos veces la misma pregunta.
    if (question.status === "answered") {
      return res.status(400).json({ message: "Esta pregunta ya fue respondida anteriormente." });
    }

    // Actualiza los datos de la respuesta.
    question.answerText = answerText;
    question.answeredAt = new Date();
    question.answeredByUserId = req.user._id;
    question.status = "answered";
    await question.save();

    const populatedQuestion = await Question.findById(question._id).populate(QUESTION_POPULATE);

    return res.json(populatedQuestion);
  } catch (error) {
    console.error("Error answering question:", error);
    return res.status(500).json({ message: "No fue posible registrar la respuesta." });
  }
};

// Construye la bandeja de chats del usuario.
const getChats = async (req, res) => {
  try {
    const questions = await Question.find({
      $or: [{ askedByUserId: req.user._id }, { ownerId: req.user._id }],
    })
      .populate(QUESTION_POPULATE)
      .sort({ askedAt: -1 });

    const chatsMap = new Map();

    // Se resume el historial en una sola entrada por vehiculo para construir
    // la bandeja principal de chats.
    questions.forEach((question) => {
      const vehicle = question.vehicleId;
      const vehicleId = vehicle?._id?.toString();

      if (!vehicleId) {
        return;
      }

      const isOwner = question.ownerId?._id?.toString() === req.user._id.toString();
      const otherUser = isOwner ? question.askedByUserId : question.ownerId;
      const currentChat = chatsMap.get(vehicleId);

      // Si es la primera pregunta del vehículo, crea el resumen inicial.
      if (!currentChat) {
        chatsMap.set(vehicleId, {
          vehicle,
          isOwner,
          otherUser,
          totalMessages: 1,
          hasPendingQuestion: question.status === "pending",
          lastActivityAt: question.answeredAt || question.askedAt,
          lastQuestionText: question.questionText,
        });
        return;
      }

      currentChat.totalMessages += 1;

      if (question.status === "pending") {
        currentChat.hasPendingQuestion = true;
      }

      const currentDate = new Date(currentChat.lastActivityAt || 0);
      const questionDate = new Date(question.answeredAt || question.askedAt || 0);

      // Mantiene la actividad más reciente del chat.
      if (questionDate > currentDate) {
        currentChat.lastActivityAt = question.answeredAt || question.askedAt;
        currentChat.lastQuestionText = question.questionText;
        currentChat.otherUser = otherUser;
        currentChat.isOwner = isOwner;
      }
    });

    return res.json({
      results: Array.from(chatsMap.values()).sort(
        (current, next) => new Date(next.lastActivityAt) - new Date(current.lastActivityAt)
      ),
    });
  } catch (error) {
    console.error("Error loading chats:", error);
    return res.status(500).json({ message: "No fue posible cargar los chats." });
  }
};

module.exports = {
  answerQuestion,
  askQuestion,
  getChats,
  getMyQuestions,
  getOwnerQuestions,
  getVehicleQuestions,
};