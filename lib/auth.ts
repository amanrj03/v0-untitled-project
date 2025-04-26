"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { hash, compare } from "bcrypt"
import { sign, verify } from "jsonwebtoken"
import prisma from "./db"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

// User schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["TEACHER", "STUDENT"]),
})

// Auth functions
export async function login(email: string, password: string) {
  try {
    // Validate input
    const validatedFields = loginSchema.safeParse({ email, password })
    if (!validatedFields.success) {
      return { success: false, error: "Invalid email or password format" }
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        password: true,
        role: true,
      },
    })

    if (!user) {
      return { success: false, error: "Invalid email or password" }
    }

    // Verify password
    const passwordMatch = await compare(password, user.password)
    if (!passwordMatch) {
      return { success: false, error: "Invalid email or password" }
    }

    // Create JWT token
    const token = sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" })

    // Set cookie
    cookies().set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return { success: true, role: user.role }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, error: "An error occurred during login" }
  }
}

export async function register(name: string, email: string, password: string, role: string) {
  try {
    // Validate input
    const validatedFields = registerSchema.safeParse({ name, email, password, role })
    if (!validatedFields.success) {
      return { success: false, error: "Invalid registration data" }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return { success: false, error: "Email already in use" }
    }

    // Hash password
    const hashedPassword = await hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as "TEACHER" | "STUDENT",
      },
    })

    // Create JWT token
    const token = sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" })

    // Set cookie
    cookies().set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return { success: true, role: user.role }
  } catch (error) {
    console.error("Registration error:", error)
    return { success: false, error: "An error occurred during registration" }
  }
}

export async function logout() {
  cookies().delete("auth_token")
  redirect("/auth/login")
}

export async function checkAuth() {
  try {
    const token = cookies().get("auth_token")?.value

    if (!token) {
      return { authenticated: false }
    }

    const decoded = verify(token, JWT_SECRET) as { id: string; role: string }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, name: true, email: true },
    })

    if (!user) {
      cookies().delete("auth_token")
      return { authenticated: false }
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      role: user.role,
    }
  } catch (error) {
    cookies().delete("auth_token")
    return { authenticated: false }
  }
}

export async function getCurrentUser() {
  const auth = await checkAuth()

  if (!auth.authenticated) {
    return null
  }

  return auth.user
}
