const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const normalizeEmail = (email) => email?.toLowerCase().trim();

const validateRegisterPayload = (body) => {
  const name = body.name?.trim();
  const lastname = body.lastname?.trim();
  const email = normalizeEmail(body.email);
  const password = body.password;

  if (!name || !lastname || !email || !password) {
    return {
      ok: false,
      message: "Nombre, apellido, correo y contrasena son requeridos",
    };
  }

  if (name.length < 2 || lastname.length < 2) {
    return {
      ok: false,
      message: "Nombre y apellido deben tener al menos 2 caracteres",
    };
  }

  if (!isValidEmail(email)) {
    return { ok: false, message: "Correo invalido" };
  }

  if (password.length < 6) {
    return {
      ok: false,
      message: "La contrasena debe tener al menos 6 caracteres",
    };
  }

  return {
    ok: true,
    data: { name, lastname, email, password },
  };
};

const validateLoginPayload = (body) => {
  const email = normalizeEmail(body.email);
  const password = body.password;

  if (!email || !password) {
    return { ok: false, message: "Email and password are required" };
  }

  if (!isValidEmail(email)) {
    return { ok: false, message: "Invalid email or password" };
  }

  return {
    ok: true,
    data: { email, password },
  };
};

module.exports = {
  validateLoginPayload,
  validateRegisterPayload,
};
