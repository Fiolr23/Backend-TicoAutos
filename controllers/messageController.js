const mongoose = require("mongoose");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const Vehicle = require("../models/vehicle");

// Controlador de mensajeria.
// Cada conversacion representa un hilo por vehiculo entre propietario e interesado.
const THREAD_POPULATE = [
  {
    path: "vehicleId",
    select: "brand model year price color status images userId createdAt",
    populate: { path: "userId", select: "name lastname" },
  },
  { path: "ownerId", select: "name lastname" },
  { path: "interestedUserId", select: "name lastname" },
];

const MESSAGE_POPULATE = [
  { path: "senderId", select: "name lastname" },
  { path: "receiverId", select: "name lastname" },
];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeMessageText = (value) => value?.trim();

const normalizePagination = (query) => {
  const page = Number.parseInt(query.page, 10) || 1;
  const limit = Number.parseInt(query.limit, 10) || 10;

  if (page < 1 || limit < 1 || limit > 50) {
    return null;
  }

  return { page, limit, skip: (page - 1) * limit };
};

// Devuelve una conversacion lista para el frontend, con mensajes ordenados por fecha.
const serializeConversation = async (conversation, currentUserId) => {
  const messages = await Message.find({ conversationId: conversation._id })
    .populate(MESSAGE_POPULATE)
    .sort({ sentAt: 1 });

  return {
    ...conversation.toObject(),
    isOwner: conversation.ownerId._id.toString() === currentUserId.toString(),
    messages,
  };
};

// Reutiliza la conversacion si ya existe para ese vehiculo y esos dos usuarios.
const getOrCreateConversation = async ({ vehicle, interestedUserId }) => {
  let conversation = await Conversation.findOne({
    vehicleId: vehicle._id,
    ownerId: vehicle.userId,
    interestedUserId,
  }).populate(THREAD_POPULATE);

  if (!conversation) {
    conversation = await Conversation.create({
      vehicleId: vehicle._id,
      ownerId: vehicle.userId,
      interestedUserId,
      lastMessageAt: new Date(),
    });

    conversation = await Conversation.findById(conversation._id).populate(THREAD_POPULATE);
  }

  return conversation;
};

const sendMessageToVehicleOwner = async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const text = normalizeMessageText(req.body.text);

    if (!isValidObjectId(vehicleId)) {
      return res.status(400).json({ message: "Vehicle id invalido" });
    }

    if (!text || text.length < 1) {
      return res.status(400).json({ message: "El mensaje es obligatorio" });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    if (vehicle.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "No puedes enviarte mensajes a ti mismo" });
    }

    let conversation = await getOrCreateConversation({
      vehicle,
      interestedUserId: req.user._id,
    });

    // El historial se guarda mensaje por mensaje para poder reconstruir la conversacion completa.
    await Message.create({
      conversationId: conversation._id,
      vehicleId: vehicle._id,
      senderId: req.user._id,
      receiverId: vehicle.userId,
      text,
      sentAt: new Date(),
    });

    // Cuando escribe el interesado, queda un pendiente para el propietario.
    conversation.ownerUnreadCount += 1;
    conversation.interestedUnreadCount = 0;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageText = text;
    await conversation.save();

    conversation = await Conversation.findById(conversation._id).populate(THREAD_POPULATE);

    return res.status(201).json(await serializeConversation(conversation, req.user._id));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getVehicleConversation = async (req, res) => {
  try {
    const vehicleId = req.params.id;

    if (!isValidObjectId(vehicleId)) {
      return res.status(400).json({ message: "Vehicle id invalido" });
    }

    const vehicle = await Vehicle.findById(vehicleId).populate("userId", "name lastname");
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    // El propietario no necesita abrir una conversacion consigo mismo desde el detalle.
    if (vehicle.userId._id.toString() === req.user._id.toString()) {
      return res.status(200).json({
        vehicle,
        isOwner: true,
        conversation: null,
        messages: [],
      });
    }

    const conversation = await Conversation.findOne({
      vehicleId,
      ownerId: vehicle.userId._id,
      interestedUserId: req.user._id,
    }).populate(THREAD_POPULATE);

    if (!conversation) {
      return res.status(200).json({
        vehicle,
        isOwner: false,
        conversation: null,
        messages: [],
      });
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .populate(MESSAGE_POPULATE)
      .sort({ sentAt: 1 });

    // Si el interesado abre el hilo, sus pendientes se limpian.
    if (conversation.interestedUnreadCount > 0) {
      conversation.interestedUnreadCount = 0;
      await conversation.save();
    }

    return res.status(200).json({
      vehicle,
      isOwner: false,
      conversation,
      messages,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getMyConversations = async (req, res) => {
  try {
    const pagination = normalizePagination(req.query);
    if (!pagination) {
      return res.status(400).json({ message: "Los parametros page y limit son invalidos" });
    }

    const { page, limit, skip } = pagination;
    const filters = { interestedUserId: req.user._id };

    const [results, total] = await Promise.all([
      Conversation.find(filters)
        .populate(THREAD_POPULATE)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments(filters),
    ]);

    return res.status(200).json({
      total,
      totalPages: Math.ceil(total / limit) || 1,
      page,
      limit,
      results,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getOwnerInbox = async (req, res) => {
  try {
    const pagination = normalizePagination(req.query);
    if (!pagination) {
      return res.status(400).json({ message: "Los parametros page y limit son invalidos" });
    }

    const { page, limit, skip } = pagination;
    const filters = { ownerId: req.user._id };

    // Permite pedir solo conversaciones con mensajes pendientes.
    if (req.query.status === "pending") {
      filters.ownerUnreadCount = { $gt: 0 };
    }

    const [results, total, pendingTotal] = await Promise.all([
      Conversation.find(filters)
        .populate(THREAD_POPULATE)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments(filters),
      Conversation.countDocuments({ ownerId: req.user._id, ownerUnreadCount: { $gt: 0 } }),
    ]);

    return res.status(200).json({
      total,
      pendingTotal,
      totalPages: Math.ceil(total / limit) || 1,
      page,
      limit,
      results,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getConversationById = async (req, res) => {
  try {
    const conversationId = req.params.id;

    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ message: "Conversation id invalido" });
    }

    const conversation = await Conversation.findById(conversationId).populate(THREAD_POPULATE);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const currentUserId = req.user._id.toString();
    const isOwner = conversation.ownerId._id.toString() === currentUserId;
    const isInterested = conversation.interestedUserId._id.toString() === currentUserId;

    // Solo pueden abrir la conversacion las dos personas asociadas a ese vehiculo.
    if (!isOwner && !isInterested) {
      return res.status(403).json({ message: "No puedes ver esta conversacion" });
    }

    const messages = await Message.find({ conversationId })
      .populate(MESSAGE_POPULATE)
      .sort({ sentAt: 1 });

    if (isOwner && conversation.ownerUnreadCount > 0) {
      conversation.ownerUnreadCount = 0;
      await conversation.save();
    }

    if (isInterested && conversation.interestedUnreadCount > 0) {
      conversation.interestedUnreadCount = 0;
      await conversation.save();
    }

    return res.status(200).json({
      ...conversation.toObject(),
      isOwner,
      messages,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const replyToConversation = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const text = normalizeMessageText(req.body.text);

    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ message: "Conversation id invalido" });
    }

    if (!text || text.length < 1) {
      return res.status(400).json({ message: "El mensaje es obligatorio" });
    }

    const conversation = await Conversation.findById(conversationId).populate(THREAD_POPULATE);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const currentUserId = req.user._id.toString();
    const isOwner = conversation.ownerId._id.toString() === currentUserId;
    const isInterested = conversation.interestedUserId._id.toString() === currentUserId;

    if (!isOwner && !isInterested) {
      return res.status(403).json({ message: "No puedes participar en esta conversacion" });
    }

    const receiverId = isOwner ? conversation.interestedUserId._id : conversation.ownerId._id;

    await Message.create({
      conversationId: conversation._id,
      vehicleId: conversation.vehicleId._id,
      senderId: req.user._id,
      receiverId,
      text,
      sentAt: new Date(),
    });

    conversation.lastMessageAt = new Date();
    conversation.lastMessageText = text;

    // Los pendientes cambian segun quien envio el ultimo mensaje.
    if (isOwner) {
      conversation.interestedUnreadCount += 1;
      conversation.ownerUnreadCount = 0;
    } else {
      conversation.ownerUnreadCount += 1;
      conversation.interestedUnreadCount = 0;
    }

    await conversation.save();

    return res.status(201).json(await serializeConversation(conversation, req.user._id));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  sendMessageToVehicleOwner,
  getVehicleConversation,
  getMyConversations,
  getOwnerInbox,
  getConversationById,
  replyToConversation,
};
