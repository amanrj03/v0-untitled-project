"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import prisma from "./db"
import { checkAuth } from "./auth"

// Schemas
const testSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  subject: z.string(),
  duration: z.number().min(1),
  instructions: z.string().optional(),
  passingMarks: z.number().min(0),
  questions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "NUMERICAL", "MATRIX_MATCH"]),
      text: z.string().min(1),
      options: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          isCorrect: z.boolean(),
        }),
      ),
      correctAnswer: z.string().optional(),
      marks: z.object({
        correct: z.number(),
        incorrect: z.number(),
      }),
    }),
  ),
  status: z.enum(["DRAFT", "ACTIVE"]),
})

// Teacher dashboard data
export async function getTeacherDashboardData() {
  const auth = await checkAuth()

  if (!auth.authenticated || auth.role !== "TEACHER") {
    throw new Error("Unauthorized")
  }

  const teacherId = auth.user.id

  // Get tests created by the teacher
  const tests = await prisma.test.findMany({
    where: {
      teacherId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      subject: true,
      duration: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          questions: true,
        },
      },
    },
  })

  // Get students enrolled with the teacher
  const students = await prisma.teacherStudent.findMany({
    where: {
      teacherId,
    },
    select: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return {
    tests: tests.map((test) => ({
      id: test.id,
      title: test.title,
      subject: test.subject,
      duration: test.duration,
      totalQuestions: test._count.questions,
      createdAt: test.createdAt.toISOString(),
      status: test.status,
    })),
    students: students.map((s) => ({
      id: s.student.id,
      name: s.student.name,
      email: s.student.email,
      joinedAt: s.student.createdAt.toISOString(),
    })),
  }
}

// Create a new test
export async function createTest(data: z.infer<typeof testSchema>) {
  const auth = await checkAuth()

  if (!auth.authenticated || auth.role !== "TEACHER") {
    throw new Error("Unauthorized")
  }

  const teacherId = auth.user.id

  try {
    // Validate test data
    const validatedData = testSchema.parse(data)

    // Create test in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create test
      const test = await tx.test.create({
        data: {
          title: validatedData.title,
          description: validatedData.description || "",
          subject: validatedData.subject,
          duration: validatedData.duration,
          instructions: validatedData.instructions || "",
          passingMarks: validatedData.passingMarks,
          status: validatedData.status,
          teacherId,
        },
      })

      // Create questions
      for (const question of validatedData.questions) {
        const createdQuestion = await tx.question.create({
          data: {
            testId: test.id,
            type: question.type,
            text: question.text,
            correctMarks: question.marks.correct,
            incorrectMarks: question.marks.incorrect,
            correctAnswer: question.correctAnswer || null,
          },
        })

        // Create options if applicable
        if (
          ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "MATRIX_MATCH"].includes(question.type) &&
          question.options.length > 0
        ) {
          await tx.option.createMany({
            data: question.options.map((option) => ({
              questionId: createdQuestion.id,
              text: option.text,
              isCorrect: option.isCorrect,
            })),
          })
        }
      }

      return test
    })

    revalidatePath("/teacher/dashboard")
    revalidatePath("/teacher/tests")

    return { success: true, testId: result.id }
  } catch (error) {
    console.error("Error creating test:", error)
    return { success: false, error: "Failed to create test" }
  }
}

// Get test details
export async function getTestDetails(testId: string) {
  const auth = await checkAuth()

  if (!auth.authenticated || auth.role !== "TEACHER") {
    throw new Error("Unauthorized")
  }

  const teacherId = auth.user.id

  const test = await prisma.test.findUnique({
    where: {
      id: testId,
      teacherId,
    },
    include: {
      questions: {
        include: {
          options: true,
        },
      },
    },
  })

  if (!test) {
    throw new Error("Test not found")
  }

  return {
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    duration: test.duration,
    instructions: test.instructions,
    passingMarks: test.passingMarks,
    status: test.status,
    createdAt: test.createdAt.toISOString(),
    questions: test.questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      correctAnswer: q.correctAnswer,
      marks: {
        correct: q.correctMarks,
        incorrect: q.incorrectMarks,
      },
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.isCorrect,
      })),
    })),
  }
}

// Update test
export async function updateTest(testId: string, data: z.infer<typeof testSchema>) {
  const auth = await checkAuth()

  if (!auth.authenticated || auth.role !== "TEACHER") {
    throw new Error("Unauthorized")
  }

  const teacherId = auth.user.id

  try {
    // Validate test data
    const validatedData = testSchema.parse(data)

    // Check if test exists and belongs to teacher
    const existingTest = await prisma.test.findUnique({
      where: {
        id: testId,
        teacherId,
      },
    })

    if (!existingTest) {
      return { success: false, error: "Test not found" }
    }

    // Update test in transaction
    await prisma.$transaction(async (tx) => {
      // Update test
      await tx.test.update({
        where: { id: testId },
        data: {
          title: validatedData.title,
          description: validatedData.description,
          subject: validatedData.subject,
          duration: validatedData.duration,
          instructions: validatedData.instructions,
          passingMarks: validatedData.passingMarks,
          status: validatedData.status,
        },
      })

      // Delete existing questions and options
      const existingQuestions = await tx.question.findMany({
        where: { testId },
        select: { id: true },
      })

      for (const question of existingQuestions) {
        await tx.option.deleteMany({
          where: { questionId: question.id },
        })
      }

      await tx.question.deleteMany({
        where: { testId },
      })

      // Create new questions
      for (const question of validatedData.questions) {
        const createdQuestion = await tx.question.create({
          data: {
            testId,
            type: question.type,
            text: question.text,
            correctMarks: question.marks.correct,
            incorrectMarks: question.marks.incorrect,
            correctAnswer: question.correctAnswer || null,
          },
        })

        // Create options if applicable
        if (
          ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "MATRIX_MATCH"].includes(question.type) &&
          question.options.length > 0
        ) {
          await tx.option.createMany({
            data: question.options.map((option) => ({
              questionId: createdQuestion.id,
              text: option.text,
              isCorrect: option.isCorrect,
            })),
          })
        }
      }
    })

    revalidatePath(`/teacher/tests/${testId}`)
    revalidatePath("/teacher/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error updating test:", error)
    return { success: false, error: "Failed to update test" }
  }
}

// Invite student
export async function inviteStudent(email: string) {
  const auth = await checkAuth()

  if (!auth.authenticated || auth.role !== "TEACHER") {
    throw new Error("Unauthorized")
  }

  const teacherId = auth.user.id

  try {
    // Check if student exists
    const student = await prisma.user.findFirst({
      where: {
        email,
        role: "STUDENT",
      },
    })

    if (!student) {
      return { success: false, error: "Student not found" }
    }

    // Check if already enrolled
    const existingRelation = await prisma.teacherStudent.findUnique({
      where: {
        teacherId_studentId: {
          teacherId,
          studentId: student.id,
        },
      },
    })

    if (existingRelation) {
      return { success: false, error: "Student already enrolled" }
    }

    // Create relation
    await prisma.teacherStudent.create({
      data: {
        teacherId,
        studentId: student.id,
      },
    })

    revalidatePath("/teacher/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error inviting student:", error)
    return { success: false, error: "Failed to invite student" }
  }
}

// Remove student
export async function removeStudent(studentId: string) {
  const auth = await checkAuth()

  if (!auth.authenticated || auth.role !== "TEACHER") {
    throw new Error("Unauthorized")
  }

  const teacherId = auth.user.id

  try {
    await prisma.teacherStudent.delete({
      where: {
        teacherId_studentId: {
          teacherId,
          studentId,
        },
      },
    })

    revalidatePath("/teacher/dashboard")

    return { success: true }
  } catch (error) {
    console.error("Error removing student:", error)
    return { success: false, error: "Failed to remove student" }
  }
}
