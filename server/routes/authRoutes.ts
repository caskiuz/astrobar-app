import express from "express";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "AstroBar_local_secret_key";

// Phone login
router.post("/phone-login", async (req, res) => {
  try {
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({ error: "Phone and code are required" });
    }

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, or, like } = await import("drizzle-orm");
    const jwt = await import("jsonwebtoken");

    const phoneDigits = phone.replace(/[^\d]/g, '');
    const normalizedPhone = phoneDigits.startsWith('54') ? `+${phoneDigits}` : 
                           phoneDigits.length === 10 ? `+54${phoneDigits}` :
                           phone.startsWith('+') ? phone : `+54${phoneDigits}`;

    let user = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.phone, normalizedPhone),
          eq(users.phone, phone),
          like(users.phone, `%${phoneDigits.slice(-10)}`)
        )
      )
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // BYPASS: Si es admin y el código es 123456, dejar pasar siempre
    const isAdminBypass = user[0].role === 'admin' && code === '123456';

    if (!isAdminBypass && (!user[0].verificationCode || user[0].verificationCode !== code)) {
      const testPhones = ["+54 341 234 5678", "+54 341 456 7892", "+543414567892"];
      const isTestPhone = testPhones.some(testPhone => {
        const testDigits = testPhone.replace(/[^\d]/g, '');
        return phoneDigits.slice(-10) === testDigits.slice(-10);
      });
      
      if (process.env.NODE_ENV === "development" && code === "1234" && isTestPhone) {
        console.log("⚡ Using 1234 fallback for test phone");
      } else {
        return res.status(400).json({ error: "Código inválido" });
      }
    }

    await db
      .update(users)
      .set({ 
        verificationCode: null, 
        verificationExpires: null,
        phoneVerified: true 
      })
      .where(eq(users.id, user[0].id));

    const token = jwt.default.sign(
      { id: user[0].id, phone: user[0].phone, role: user[0].role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user[0].id,
        name: user[0].name,
        phone: user[0].phone,
        role: user[0].role,
        phoneVerified: user[0].phoneVerified,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Login alias for compatibility
router.post("/login", async (req, res) => {
  return router.handle(req, res);
});

// Development email login (FIXED)
router.post("/dev-email-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const jwt = await import("jsonwebtoken");

    let user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (password !== "password" && password !== "123456") {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    const token = jwt.default.sign(
      { id: user[0].id, phone: user[0].phone, role: user[0].role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user[0].id,
        name: user[0].name,
        email: user[0].email,
        phone: user[0].phone,
        role: user[0].role,
        phoneVerified: user[0].phoneVerified,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send code (WITH TWILIO BYPASS)
router.post("/send-code", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone required" });

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, or, like } = await import("drizzle-orm");

    const phoneDigits = phone.replace(/[^\d]/g, '');
    const normalizedPhone = phoneDigits.startsWith('54') ? `+${phoneDigits}` : `+54${phoneDigits}`;

    let user = await db.select().from(users).where(or(eq(users.phone, normalizedPhone), eq(users.phone, phone))).limit(1);

    if (user.length === 0) return res.json({ success: false, userNotFound: true });

    const code = "123456"; 
    await db.update(users).set({ verificationCode: code }).where(eq(users.id, user[0].id));

    if (process.env.TWILIO_ACCOUNT_SID) {
      try {
        const twilio = await import("twilio");
        const client = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
          body: `Tu código AstroBar: ${code}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: normalizedPhone
        });
      } catch (twilioError) {
        console.error("Twilio falló pero el código quedó en la DB:", twilioError);
      }
    }

    res.json({ success: true, message: "Código generado en DB" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 🚀 ENDPOINT ACTUALIZADO: Registrar usuario con encriptación de contraseña
router.post("/phone-signup", async (req, res) => {
  try {
    const { name, email, phone, password, role, birthDate, referralCode } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ error: "Nombre, teléfono y contraseña son requeridos" });
    }

    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, or } = await import("drizzle-orm");
    const jwt = await import("jsonwebtoken");
    const bcrypt = await import("bcrypt"); // 🔒 Importamos bcrypt para hashear

    // Normalizar el teléfono para verificar duplicados
    const phoneDigits = phone.replace(/[^\d]/g, '');
    const normalizedPhone = phoneDigits.startsWith('54') ? `+${phoneDigits}` : `+54${phoneDigits}`;

    // Verificar si el usuario ya existe por teléfono o email
    const existingUser = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.phone, normalizedPhone),
          email ? eq(users.email, email) : undefined
        )
      )
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "El teléfono o email ya se encuentra registrado" });
    }

    // 🔒 Encriptamos la contraseña con un factor de costo de 10 saltos (estándar de bcrypt)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar el nuevo usuario con la contraseña encriptada
    await db.insert(users).values({
      name,
      email: email || null,
      phone: normalizedPhone,
      password: hashedPassword, // Guardamos el hash seguro ($2a$10...)
      role: role || "customer",
      birthDate: birthDate ? new Date(birthDate).toISOString() : null,
      referralCode: referralCode || null,
      phoneVerified: false,
    });

    // Obtener el registro recién creado
    const newUser = await db
      .select()
      .from(users)
      .where(eq(users.phone, normalizedPhone))
      .limit(1);

    // Generar Token JWT para login automático inmediato
    const token = jwt.default.sign(
      { id: newUser[0].id, phone: newUser[0].phone, role: newUser[0].role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser[0].id,
        name: newUser[0].name,
        email: newUser[0].email,
        phone: newUser[0].phone,
        role: newUser[0].role,
        phoneVerified: newUser[0].phoneVerified,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;